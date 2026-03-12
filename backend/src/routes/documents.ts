import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { getPresignedUrl } from '../config/minio';
import * as documentService from '../services/documentService';

const router = Router();

router.get('/', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const documents = await documentService.getPublishedDocuments(user.id);
    res.json({ data: documents });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const doc = await documentService.getDocumentById(req.params.id, user.id);
    if (!doc) {
      res.status(404).json({ error: 'Документ не найден', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/file', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const doc = await documentService.getDocumentById(req.params.id, user.id);
    if (!doc) {
      res.status(404).json({ error: 'Документ не найден', code: 'NOT_FOUND' });
      return;
    }

    const url = await getPresignedUrl(doc.fileKey);
    await writeAuditLog({ userId: user.id, action: 'VIEW_DOC', entityId: doc.id, req });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/acknowledge', isAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    await documentService.acknowledgeDocument(user.id, req.params.id);
    await writeAuditLog({ userId: user.id, action: 'ACK_DOC', entityId: req.params.id, req });
    res.json({ message: 'Ознакомление подтверждено' });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

export default router;
