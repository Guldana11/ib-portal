import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { isAuthenticated, isAdmin } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { uploadFile, getPresignedUrl, deleteFile } from '../config/minio';
import prisma from '../config/database';
import * as notificationService from '../services/notificationService';

const router = Router();
router.use(isAuthenticated, isAdmin);

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',                                                          // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',     // .docx
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Допускаются только PDF и Word файлы (.pdf, .doc, .docx)'));
    }
  },
});

async function convertToPdf(buffer: Buffer, filename: string): Promise<Buffer> {
  const libre = require('libreoffice-convert');
  const { promisify } = require('util');
  const convert = promisify(libre.convert);
  const pdfBuf = await convert(buffer, '.pdf', undefined);
  return Buffer.from(pdfBuf);
}

function isWordFile(mimetype: string): boolean {
  return mimetype !== 'application/pdf' && ALLOWED_MIMES.includes(mimetype);
}

// ===== DOCUMENTS =====

const createDocSchema = z.object({
  title: z.string().min(1),
  titleKk: z.string().optional(),
  category: z.string().min(1),
  version: z.string().default('1.0'),
  description: z.string().optional(),
  descriptionKk: z.string().optional(),
});

const updateDocSchema = z.object({
  title: z.string().min(1).optional(),
  titleKk: z.string().optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  descriptionKk: z.string().optional(),
  isPublished: z.preprocess((v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }, z.boolean().optional()),
  version: z.string().optional(),
});

router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { acknowledgments: true, tests: true } },
      },
    });
    res.json({ data: docs });
  } catch (err) {
    next(err);
  }
});

router.post('/documents', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'fileKk', maxCount: 1 }]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[POST /documents] body:', req.body);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.file?.[0];
    const fileKk = files?.fileKk?.[0];
    console.log('[POST /documents] file:', file ? { name: file.originalname, size: file.size, mime: file.mimetype } : 'NO FILE');
    console.log('[POST /documents] fileKk:', fileKk ? { name: fileKk.originalname, size: fileKk.size, mime: fileKk.mimetype } : 'NO FILE');
    const parsed = createDocSchema.parse(req.body);
    if (!file) {
      res.status(400).json({ error: 'Файл обязателен', code: 'INVALID_FILE_TYPE' });
      return;
    }

    let pdfBuffer: Buffer;
    let pdfSize: number;
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');

    if (isWordFile(file.mimetype)) {
      try {
        pdfBuffer = await convertToPdf(file.buffer, file.originalname);
        pdfSize = pdfBuffer.length;
      } catch (convErr) {
        console.error('PDF conversion failed:', convErr);
        res.status(500).json({ error: 'Не удалось сконвертировать файл в PDF. Убедитесь что LibreOffice установлен.', code: 'CONVERSION_ERROR' });
        return;
      }
    } else {
      pdfBuffer = file.buffer;
      pdfSize = file.size;
    }

    const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const fileKey = `documents/${uid}.pdf`;

    await uploadFile(fileKey, pdfBuffer, pdfSize, 'application/pdf');

    // Казахская версия файла
    let fileKeyKk: string | undefined;
    let fileNameKk: string | undefined;
    let fileSizeKk: number | undefined;

    if (fileKk) {
      let pdfBufferKk: Buffer;
      if (isWordFile(fileKk.mimetype)) {
        pdfBufferKk = await convertToPdf(fileKk.buffer, fileKk.originalname);
        fileSizeKk = pdfBufferKk.length;
      } else {
        pdfBufferKk = fileKk.buffer;
        fileSizeKk = fileKk.size;
      }
      const uidKk = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-kk`;
      fileKeyKk = `documents/${uidKk}.pdf`;
      fileNameKk = Buffer.from(fileKk.originalname, 'latin1').toString('utf-8');
      await uploadFile(fileKeyKk, pdfBufferKk, fileSizeKk, 'application/pdf');
    }

    const user = req.user as any;
    const doc = await prisma.document.create({
      data: {
        title: parsed.title,
        titleKk: parsed.titleKk,
        category: parsed.category,
        version: parsed.version,
        description: parsed.description,
        descriptionKk: parsed.descriptionKk,
        fileKey,
        fileName: originalName,
        fileSize: pdfSize,
        fileKeyKk,
        fileNameKk,
        fileSizeKk,
        createdBy: user.email,
      },
    });

    await writeAuditLog({ userId: user.id, action: 'UPLOAD_DOC', entityId: doc.id, req });
    console.log('[POST /documents] success, doc id:', doc.id);
    res.status(201).json({ data: doc });
  } catch (err: any) {
    console.error('[POST /documents] ERROR:', err.name, err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
    if (err.name === 'ZodError') {
      console.error('[POST /documents] Zod details:', JSON.stringify(err.errors));
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.patch('/documents/:id', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'fileKk', maxCount: 1 }]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.file?.[0];
    const fileKk = files?.fileKk?.[0];
    console.log('[PATCH /documents/:id] id:', req.params.id, 'body:', req.body);
    console.log('[PATCH /documents/:id] file:', file ? { name: file.originalname, size: file.size, mime: file.mimetype } : 'NO FILE');
    console.log('[PATCH /documents/:id] fileKk:', fileKk ? { name: fileKk.originalname, size: fileKk.size, mime: fileKk.mimetype } : 'NO FILE');
    const parsed = updateDocSchema.parse(req.body);
    const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Документ не найден', code: 'NOT_FOUND' });
      return;
    }

    const oldVersion = existing.version;
    const updateData: any = { ...parsed };

    if (file) {
      let pdfBuffer: Buffer;
      let pdfSize: number;

      if (isWordFile(file.mimetype)) {
        try {
          pdfBuffer = await convertToPdf(file.buffer, file.originalname);
          pdfSize = pdfBuffer.length;
        } catch (convErr) {
          console.error('PDF conversion failed:', convErr);
          res.status(500).json({ error: 'Не удалось сконвертировать файл в PDF', code: 'CONVERSION_ERROR' });
          return;
        }
      } else {
        pdfBuffer = file.buffer;
        pdfSize = file.size;
      }

      const fileKey = `documents/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.pdf`;
      await uploadFile(fileKey, pdfBuffer, pdfSize, 'application/pdf');
      updateData.fileKey = fileKey;
      updateData.fileName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
      updateData.fileSize = pdfSize;
    }

    if (fileKk) {
      let pdfBufferKk: Buffer;
      let pdfSizeKk: number;

      if (isWordFile(fileKk.mimetype)) {
        try {
          pdfBufferKk = await convertToPdf(fileKk.buffer, fileKk.originalname);
          pdfSizeKk = pdfBufferKk.length;
        } catch (convErr) {
          console.error('PDF conversion (KK) failed:', convErr);
          res.status(500).json({ error: 'Не удалось сконвертировать казахский файл в PDF', code: 'CONVERSION_ERROR' });
          return;
        }
      } else {
        pdfBufferKk = fileKk.buffer;
        pdfSizeKk = fileKk.size;
      }

      const fileKeyKk = `documents/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-kk.pdf`;
      await uploadFile(fileKeyKk, pdfBufferKk, pdfSizeKk, 'application/pdf');
      updateData.fileKeyKk = fileKeyKk;
      updateData.fileNameKk = Buffer.from(fileKk.originalname, 'latin1').toString('utf-8');
      updateData.fileSizeKk = pdfSizeKk;
    }

    if (parsed.isPublished === true && !existing.isPublished) {
      updateData.publishedAt = new Date();
    }

    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data: updateData,
    });

    const user = req.user as any;
    await writeAuditLog({ userId: user.id, action: 'UPDATE_DOC', entityId: doc.id, req });

    if (parsed.isPublished === true && !existing.isPublished) {
      notificationService.notifyNewDocument(doc.id).catch(console.error);
    }

    if (parsed.version && parsed.version !== oldVersion) {
      notificationService.notifyDocumentUpdated(doc.id, oldVersion).catch(console.error);
    }

    console.log('[PATCH /documents/:id] success, doc id:', doc.id);
    res.json({ data: doc });
  } catch (err: any) {
    console.error('[PATCH /documents/:id] ERROR:', err.name, err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
    if (err.name === 'ZodError') {
      console.error('[PATCH /documents/:id] Zod details:', JSON.stringify(err.errors));
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { tests: { select: { id: true } } },
    });
    if (!doc) {
      res.status(404).json({ error: 'Документ не найден', code: 'NOT_FOUND' });
      return;
    }

    const testIds = doc.tests.map((t) => t.id);

    await prisma.$transaction([
      prisma.testAnswer.deleteMany({ where: { attempt: { testId: { in: testIds } } } }),
      prisma.testAttempt.deleteMany({ where: { testId: { in: testIds } } }),
      prisma.test.deleteMany({ where: { documentId: doc.id } }),
      prisma.documentAcknowledgment.deleteMany({ where: { documentId: doc.id } }),
      prisma.document.delete({ where: { id: doc.id } }),
    ]);

    deleteFile(doc.fileKey).catch(console.error);

    const user = req.user as any;
    await writeAuditLog({ userId: user.id, action: 'DELETE_DOC', entityId: doc.id, req });

    res.json({ message: 'Документ удалён' });
  } catch (err) {
    next(err);
  }
});

// ===== TESTS =====

const createTestSchema = z.object({
  documentId: z.string(),
  title: z.string().min(1),
  titleKk: z.string().optional(),
  description: z.string().optional(),
  passingScore: z.number().min(1).max(100).default(80),
  timeLimit: z.number().nullable().optional(),
  maxAttempts: z.number().min(1).default(3),
  periodDays: z.number().min(1).default(365),
});

const updateTestSchema = z.object({
  title: z.string().min(1).optional(),
  titleKk: z.string().optional(),
  description: z.string().optional(),
  passingScore: z.number().min(1).max(100).optional(),
  timeLimit: z.number().nullable().optional(),
  maxAttempts: z.number().min(1).optional(),
  periodDays: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().min(1),
        orderIndex: z.number(),
        explanation: z.string().nullable().optional(),
        options: z.array(
          z.object({
            id: z.string().optional(),
            text: z.string().min(1),
            isCorrect: z.boolean(),
            orderIndex: z.number(),
          })
        ),
      })
    )
    .optional(),
});

router.get('/tests/:documentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.findFirst({
      where: { documentId: req.params.documentId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            options: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
});

router.post('/tests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createTestSchema.parse(req.body);
    const test = await prisma.test.create({ data: parsed });
    res.status(201).json({ data: test });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.put('/tests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTestSchema.parse(req.body);
    const { questions, ...testData } = parsed;

    const test = await prisma.test.update({
      where: { id: req.params.id },
      data: testData,
    });

    if (questions) {
      await prisma.question.deleteMany({ where: { testId: test.id } });

      for (const q of questions) {
        await prisma.question.create({
          data: {
            testId: test.id,
            text: q.text,
            orderIndex: q.orderIndex,
            explanation: q.explanation,
            options: {
              create: q.options.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                orderIndex: o.orderIndex,
              })),
            },
          },
        });
      }
    }

    const updated = await prisma.test.findUnique({
      where: { id: test.id },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: { options: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });

    res.json({ data: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.delete('/tests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.test.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
});

// ===== USERS =====

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { acknowledgments: true, testAttempts: true },
        },
      },
    });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'ADMIN', 'EXTERNAL']).default('EMPLOYEE'),
  isActive: z.boolean().default(true),
});

router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует', code: 'ALREADY_EXISTS' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        role: parsed.role,
        isActive: parsed.isActive,
        googleId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });

    res.status(201).json({ data: user });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['EMPLOYEE', 'ADMIN', 'EXTERNAL']).optional(),
});

router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateUserSchema.parse(req.body);

    if (parsed.email) {
      const existing = await prisma.user.findFirst({
        where: { email: parsed.email, id: { not: req.params.id } },
      });
      if (existing) {
        res.status(409).json({ error: 'Пользователь с таким email уже существует', code: 'ALREADY_EXISTS' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed,
    });
    res.json({ data: user });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден', code: 'NOT_FOUND' });
      return;
    }

    const currentUser = req.user as any;
    if (user.id === currentUser.id) {
      res.status(400).json({ error: 'Нельзя удалить самого себя', code: 'SELF_DELETE' });
      return;
    }

    await prisma.$transaction([
      prisma.testAnswer.deleteMany({ where: { attempt: { userId: user.id } } }),
      prisma.testAttempt.deleteMany({ where: { userId: user.id } }),
      prisma.documentAcknowledgment.deleteMany({ where: { userId: user.id } }),
      prisma.auditLog.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    await writeAuditLog({
      userId: currentUser.id,
      action: 'DELETE_USER',
      entityId: user.id,
      metadata: { email: user.email },
      req,
    });

    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    next(err);
  }
});

const resetAttemptsSchema = z.object({
  testId: z.string(),
});

router.post('/users/:id/reset-attempts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetAttemptsSchema.parse(req.body);
    await prisma.testAttempt.deleteMany({
      where: { userId: req.params.id, testId: parsed.testId },
    });

    const admin = req.user as any;
    await writeAuditLog({
      userId: admin.id,
      action: 'RESET_ATTEMPTS',
      entityId: req.params.id,
      metadata: { testId: parsed.testId },
      req,
    });

    res.json({ message: 'Попытки сброшены' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

// ===== REPORTS =====

router.get('/reports/compliance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId, userId, status, testStatus, dateFrom, dateTo } = req.query;

    const users = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        isActive: true,
        ...(userId ? { id: userId as string } : {}),
      },
      include: {
        acknowledgments: true,
        testAttempts: {
          where: { completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
          include: { test: { select: { documentId: true } } },
        },
      },
    });

    const documents = await prisma.document.findMany({
      where: {
        isPublished: true,
        ...(documentId ? { id: documentId as string } : {}),
      },
    });

    const rows: any[] = [];
    for (const user of users) {
      for (const doc of documents) {
        const ack = user.acknowledgments.find(
          (a) => a.documentId === doc.id && a.version === doc.version
        );

        const ackStatus = ack ? 'acknowledged' : 'pending';

        if (status && status !== ackStatus) continue;

        const relevantAttempts = user.testAttempts.filter(
          (a) => (a as any).test?.documentId === doc.id
        );
        const passedAttempt = relevantAttempts.find((a) => a.isPassed);
        const currentTestStatus = passedAttempt ? 'passed' : relevantAttempts.length > 0 ? 'failed' : 'not_taken';

        if (testStatus && testStatus !== currentTestStatus) continue;

        if (dateFrom || dateTo) {
          const ackDate = ack?.createdAt;
          if (ackDate) {
            if (dateFrom && ackDate < new Date(dateFrom as string)) continue;
            if (dateTo && ackDate > new Date(dateTo as string)) continue;
          }
        }

        rows.push({
          userName: user.name,
          userEmail: user.email,
          documentTitle: doc.title,
          documentTitleKk: doc.titleKk || null,
          documentVersion: doc.version,
          ackStatus,
          ackDate: ack?.createdAt || null,
          testStatus: currentTestStatus,
          testScore: passedAttempt?.score ?? relevantAttempts[0]?.score ?? null,
          testDate: passedAttempt?.completedAt ?? relevantAttempts[0]?.completedAt ?? null,
        });
      }
    }

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId, status, testStatus, dateFrom, dateTo } = req.query;

    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      include: { acknowledgments: true, testAttempts: { where: { completedAt: { not: null } } } },
    });

    const documents = await prisma.document.findMany({
      where: { isPublished: true, ...(documentId ? { id: documentId as string } : {}) },
    });

    const csvRows = ['Сотрудник,Email,Документ,Версия,Ознакомлен,Дата ознакомления,Тест сдан,Балл,Дата теста'];

    for (const user of users) {
      for (const doc of documents) {
        const ack = user.acknowledgments.find((a) => a.documentId === doc.id && a.version === doc.version);
        const passedAttempt = user.testAttempts.find((a) => a.isPassed);

        csvRows.push(
          [
            user.name,
            user.email,
            doc.title,
            doc.version,
            ack ? 'Да' : 'Нет',
            ack ? ack.createdAt.toLocaleDateString('ru-RU') : '',
            passedAttempt ? 'Да' : 'Нет',
            passedAttempt?.score ?? '',
            passedAttempt?.completedAt?.toLocaleDateString('ru-RU') ?? '',
          ].join(',')
        );
      }
    }

    const csv = '\ufeff' + csvRows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="compliance_${date}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

const sendEmailSchema = z.object({
  to: z.string().email(),
  filters: z.object({
    documentId: z.string().optional(),
    status: z.string().optional(),
    testStatus: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).optional(),
});

router.post('/reports/send-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = sendEmailSchema.parse(req.body);

    if (!process.env.SMTP_HOST) {
      res.status(400).json({ error: 'SMTP не настроен. Обратитесь к администратору.', code: 'SMTP_NOT_CONFIGURED' });
      return;
    }

    const f = parsed.filters;

    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      include: {
        acknowledgments: f?.documentId ? { where: { documentId: f.documentId } } : true,
        testAttempts: { where: { completedAt: { not: null } }, orderBy: { completedAt: 'desc' } },
      },
    });

    const documents = await prisma.document.findMany({
      where: { isPublished: true, ...(f?.documentId ? { id: f.documentId } : {}) },
    });

    const csvRows = ['Сотрудник,Email,Документ,Версия,Ознакомлен,Дата ознакомления,Тест сдан,Балл'];
    for (const user of users) {
      for (const doc of documents) {
        const ack = user.acknowledgments.find((a) => a.documentId === doc.id && a.version === doc.version);
        const ackStatus = ack ? 'acknowledged' : 'pending';
        if (f?.status && f.status !== ackStatus) continue;

        const passedAttempt = user.testAttempts.find((a) => a.isPassed);
        const currentTestStatus = passedAttempt ? 'passed' : user.testAttempts.length > 0 ? 'failed' : 'not_taken';
        if (f?.testStatus && f.testStatus !== currentTestStatus) continue;

        if (f?.dateFrom || f?.dateTo) {
          const ackDate = ack?.createdAt;
          if (ackDate) {
            if (f.dateFrom && ackDate < new Date(f.dateFrom)) continue;
            if (f.dateTo && ackDate > new Date(f.dateTo)) continue;
          }
        }

        csvRows.push([
          user.name,
          user.email,
          doc.title,
          doc.version,
          ack ? 'Да' : 'Нет',
          ack ? ack.createdAt.toLocaleDateString('ru-RU') : '',
          passedAttempt ? 'Да' : 'Нет',
          passedAttempt?.score ?? '',
        ].join(','));
      }
    }

    const csv = '\ufeff' + csvRows.join('\n');
    const date = new Date().toLocaleDateString('ru-RU');

    const { default: transporter } = await import('../config/mailer');
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: parsed.to,
      subject: `[Crystal Spring ИБ] Отчёт по соответствию — ${date}`,
      text: `Во вложении CSV-отчёт по состоянию ознакомления сотрудников с документами и результатам тестирования на ${date}.`,
      attachments: [{ filename: `compliance_${date}.csv`, content: csv }],
    });

    res.json({ message: 'Отчёт отправлен' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

// ===== NOTIFICATIONS =====

const remindSchema = z.object({
  testId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
});

router.post('/notifications/remind', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = remindSchema.parse(req.body);
    await notificationService.sendTestReminders(parsed.testId, parsed.userIds);
    res.json({ message: 'Напоминания отправлены' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

// ===== DASHBOARD STATS =====

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeEmployees = await prisma.user.count({ where: { role: { not: 'ADMIN' }, isActive: true } });
    const totalEmployees = await prisma.user.count({ where: { role: { not: 'ADMIN' } } });
    const publishedDocs = await prisma.document.count({ where: { isPublished: true } });
    const totalAcks = await prisma.documentAcknowledgment.count();
    const totalTests = await prisma.test.count({ where: { isActive: true } });
    const passedAttempts = await prisma.testAttempt.count({ where: { isPassed: true } });
    const totalAttempts = await prisma.testAttempt.count({ where: { completedAt: { not: null } } });

    // % ознакомления по каждому документу
    const documents = await prisma.document.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, titleKk: true, version: true },
    });

    const docAckStats = [];
    for (const doc of documents) {
      const ackCount = await prisma.documentAcknowledgment.count({
        where: { documentId: doc.id, version: doc.version },
      });
      docAckStats.push({
        documentId: doc.id,
        title: doc.title,
        titleKk: doc.titleKk || null,
        ackCount,
        ackPercent: activeEmployees > 0 ? Math.round((ackCount / activeEmployees) * 100) : 0,
      });
    }

    // Сотрудники с просроченным сроком переобучения
    const tests = await prisma.test.findMany({
      where: { isActive: true },
      include: { document: { select: { title: true, titleKk: true } } },
    });

    const employees = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' }, isActive: true },
      include: {
        testAttempts: {
          where: { isPassed: true },
          orderBy: { completedAt: 'desc' },
          include: { test: { select: { id: true, periodDays: true } } },
        },
      },
    });

    const overdueList: { userName: string; userEmail: string; testTitle: string; testTitleKk: string | null; expiredAt: string | null }[] = [];
    const now = new Date();
    for (const emp of employees) {
      for (const test of tests) {
        const lastPassed = emp.testAttempts.find((a) => a.test.id === test.id);
        if (!lastPassed || !lastPassed.completedAt) {
          overdueList.push({
            userName: emp.name,
            userEmail: emp.email,
            testTitle: test.title,
            testTitleKk: test.titleKk || null,
            expiredAt: null,
          });
        } else {
          const expiryDate = new Date(lastPassed.completedAt.getTime() + test.periodDays * 24 * 60 * 60 * 1000);
          if (now > expiryDate) {
            overdueList.push({
              userName: emp.name,
              userEmail: emp.email,
              testTitle: test.title,
              testTitleKk: test.titleKk || null,
              expiredAt: expiryDate.toISOString(),
            });
          }
        }
      }
    }

    res.json({
      data: {
        totalEmployees,
        activeEmployees,
        publishedDocs,
        totalAcks,
        totalTests,
        passedAttempts,
        totalAttempts,
        testPassRate: totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
        docAckStats,
        overdueList,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
