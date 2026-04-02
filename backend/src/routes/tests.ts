import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import * as testService from '../services/testService';
import { notifyTestCompleted } from '../services/notificationService';

const router = Router();

const submitSchema = z.object({
  attemptId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIds: z.array(z.string()),
    })
  ),
});

router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const tests = await testService.getTestsForUser(user.id);
    res.json({ data: tests });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await testService.getTestWithQuestions(req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Тест не найден', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/in-progress', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const attempt = await testService.getInProgressAttempt(user.id, req.params.id);
    res.json({ data: attempt });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const attempt = await testService.startTest(user.id, req.params.id);
    await writeAuditLog({ userId: user.id, action: 'START_TEST', entityId: req.params.id, req });
    res.json({ data: { attemptId: attempt.id } });
  } catch (err: any) {
    if (err.code === 'TEST_IN_PROGRESS') {
      res.status(409).json({
        error: err.message,
        code: err.code,
        attemptId: err.attemptId,
        startedAt: err.startedAt,
      });
      return;
    }
    if (err.status) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

router.delete('/:id/cancel-attempt', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const { attemptId } = req.query;
    if (!attemptId || typeof attemptId !== 'string') {
      res.status(400).json({ error: 'attemptId обязателен', code: 'VALIDATION_ERROR' });
      return;
    }
    await testService.cancelAttempt(user.id, req.params.id, attemptId);
    res.json({ message: 'Попытка отменена' });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

router.post('/:id/submit', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const parsed = submitSchema.parse(req.body);
    const result = await testService.submitTest(user.id, req.params.id, parsed.attemptId, parsed.answers);

    await writeAuditLog({
      userId: user.id,
      action: 'COMPLETE_TEST',
      entityId: req.params.id,
      metadata: { score: result.score, isPassed: result.isPassed },
      req,
    });

    notifyTestCompleted(user.id, req.params.id, result.score, result.isPassed, result.correctCount, result.totalQuestions).catch(console.error);

    res.json({ data: result });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Неверный формат данных', code: 'VALIDATION_ERROR' });
      return;
    }
    next(err);
  }
});

router.get('/:id/history', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const history = await testService.getTestHistory(user.id, req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

export default router;
