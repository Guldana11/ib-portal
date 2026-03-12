import { Request, Response, NextFunction } from 'express';

export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ error: 'Требуется авторизация', code: 'NOT_AUTHENTICATED' });
}

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as any;
  if (user && user.role === 'ADMIN') {
    return next();
  }
  res.status(403).json({ error: 'Недостаточно прав', code: 'FORBIDDEN' });
}
