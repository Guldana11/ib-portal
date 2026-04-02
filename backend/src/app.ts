import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import cors from 'cors';
import cron from 'node-cron';
import passport from './config/passport';
import { ensureBucket } from './config/minio';
import prisma from './config/database';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import testRoutes from './routes/tests';
import adminRoutes from './routes/admin';
import { sendOverdueTestReminders } from './services/notificationService';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const isDev = process.env.NODE_ENV === 'development';

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Sessions
const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? 'lax' : 'strict',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '28800000', 10),
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('=== GLOBAL ERROR HANDLER ===');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);

  if (err.message?.includes('Допускаются только')) {
    res.status(400).json({ error: err.message, code: 'INVALID_FILE_TYPE' });
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'Файл слишком большой (максимум 50 МБ)', code: 'FILE_TOO_LARGE' });
    return;
  }

  res.status(500).json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' });
});

// Cron jobs
// Clean audit logs older than 90 days — every Sunday at 3:00
cron.schedule('0 3 * * 0', async () => {
  try {
    await prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "createdAt" < NOW() - INTERVAL '90 days'`;
    console.log('Audit logs cleaned');
  } catch (err) {
    console.error('Failed to clean audit logs:', err);
  }
});

// Send overdue test reminders — every Monday at 9:00
cron.schedule('0 9 * * 1', async () => {
  try {
    await sendOverdueTestReminders();
    console.log('Overdue test reminders sent');
  } catch (err) {
    console.error('Failed to send reminders:', err);
  }
});

// Start server
async function start() {
  try {
    await ensureBucket();
    console.log('MinIO bucket ready');
  } catch (err) {
    console.warn('MinIO not available, continuing without file storage:', (err as Error).message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();

export default app;
