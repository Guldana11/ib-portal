import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import { writeAuditLog } from '../middleware/audit';
import { isAuthenticated } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();

const hasGoogleOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const isDev = process.env.NODE_ENV === 'development';

if (hasGoogleOAuth) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get(
    '/google/callback',
    (req: Request, res: Response, next) => {
      passport.authenticate('google', (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          const reason = info?.message || 'auth_failed';
          return res.redirect(`${process.env.FRONTEND_URL || ''}/login?error=${reason}`);
        }
        req.login(user, async (loginErr) => {
          if (loginErr) return next(loginErr);
          await writeAuditLog({ userId: user.id, action: 'LOGIN', req });
          res.redirect(process.env.FRONTEND_URL || '/');
        });
      })(req, res, next);
    }
  );
}

if (!hasGoogleOAuth) {
  router.get('/google', (_req: Request, res: Response) => {
    res.redirect('/auth/dev-login');
  });
}

if (isDev) {
  router.get('/dev-login', async (req: Request, res: Response) => {
    const email = (req.query.email as string) || 'admin@crystalspring.kz';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден', code: 'NOT_FOUND' });
      return;
    }
    req.login(user, (err) => {
      if (err) {
        res.status(500).json({ error: 'Ошибка входа', code: 'LOGIN_ERROR' });
        return;
      }
      res.redirect(process.env.FRONTEND_URL || '/');
    });
  });

  router.get('/dev-users', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
      orderBy: { role: 'asc' },
    });
    const html = `<!DOCTYPE html>
<html><head><title>Dev Login</title>
<style>body{font-family:sans-serif;max-width:500px;margin:60px auto;padding:20px}
a{display:block;padding:12px 16px;margin:8px 0;background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;text-decoration:none;color:#1e40af}
a:hover{background:#e0e7ff}h1{color:#1e3a5f}span{color:#666;font-size:13px}</style></head>
<body><h1>Dev Login</h1><p>Выберите пользователя:</p>
${users.map(u => `<a href="/auth/dev-login?email=${u.email}"><strong>${u.name}</strong><br/><span>${u.email} — ${u.role}</span></a>`).join('')}
</body></html>`;
    res.send(html);
  });
}

router.post('/logout', isAuthenticated, async (req: Request, res: Response) => {
  const user = req.user as any;
  if (user) {
    await writeAuditLog({ userId: user.id, action: 'LOGOUT', req });
  }
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка выхода', code: 'LOGOUT_ERROR' });
      return;
    }
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: 'Ошибка выхода', code: 'LOGOUT_ERROR' });
        return;
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Вы вышли из системы' });
    });
  });
});

router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: 'Требуется авторизация', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const user = req.user as any;
  res.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
});

export default router;
