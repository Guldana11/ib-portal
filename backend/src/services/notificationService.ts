import { sendMail } from '../config/mailer';
import prisma from '../config/database';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendBulk(mailList: MailOptions[]): Promise<void> {
  for (const mail of mailList) {
    await sendMail(mail.to, mail.subject, mail.text, mail.html);
    await new Promise((r) => setTimeout(r, 150));
  }
}

export async function notifyNewDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const users = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE' },
  });

  const mailList: MailOptions[] = users.map((user) => ({
    to: user.email,
    subject: `[Crystal Spring ИБ] Новый документ для ознакомления: ${doc.title}`,
    text: `Уважаемый(ая) ${user.name},\n\nОпубликован новый документ по информационной безопасности:\n«${doc.title}» (версия ${doc.version})\n\nПожалуйста, ознакомьтесь с документом в течение 5 рабочих дней:\n${FRONTEND_URL}/documents/${doc.id}\n\nС уважением,\nСлужба информационной безопасности ТОО «Crystal Spring»`,
    html: `<p>Уважаемый(ая) ${user.name},</p>
<p>Опубликован новый документ по информационной безопасности:<br/>
<strong>«${doc.title}»</strong> (версия ${doc.version})</p>
<p>Пожалуйста, ознакомьтесь с документом в течение 5 рабочих дней:<br/>
<a href="${FRONTEND_URL}/documents/${doc.id}">Открыть документ</a></p>
<p>С уважением,<br/>Служба информационной безопасности ТОО «Crystal Spring»</p>`,
  }));

  await sendBulk(mailList);
}

export async function notifyDocumentUpdated(documentId: string, oldVersion: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const usersWithOldAck = await prisma.documentAcknowledgment.findMany({
    where: { documentId, version: oldVersion },
    include: { user: true },
  });

  const mailList: MailOptions[] = usersWithOldAck
    .filter((a) => a.user.isActive)
    .map((ack) => ({
      to: ack.user.email,
      subject: `[Crystal Spring ИБ] Документ обновлён, требуется повторное ознакомление`,
      text: `Уважаемый(ая) ${ack.user.name},\n\nДокумент «${doc.title}» обновлён до версии ${doc.version}.\nВаше предыдущее ознакомление (версия ${oldVersion}) больше не актуально.\n\nОзнакомьтесь с обновлённой версией:\n${FRONTEND_URL}/documents/${doc.id}\n\nС уважением,\nСлужба информационной безопасности ТОО «Crystal Spring»`,
      html: `<p>Уважаемый(ая) ${ack.user.name},</p>
<p>Документ <strong>«${doc.title}»</strong> обновлён до версии ${doc.version}.<br/>
Ваше предыдущее ознакомление (версия ${oldVersion}) больше не актуально.</p>
<p>Ознакомьтесь с обновлённой версией:<br/>
<a href="${FRONTEND_URL}/documents/${doc.id}">Открыть документ</a></p>
<p>С уважением,<br/>Служба информационной безопасности ТОО «Crystal Spring»</p>`,
    }));

  await sendBulk(mailList);
}

export async function sendTestReminders(testId?: string, userIds?: string[]): Promise<void> {
  const tests = await prisma.test.findMany({
    where: testId ? { id: testId, isActive: true } : { isActive: true },
    include: { document: true },
  });

  for (const test of tests) {
    let users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'EMPLOYEE',
        ...(userIds ? { id: { in: userIds } } : {}),
      },
      include: {
        testAttempts: {
          where: { testId: test.id, isPassed: true },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    const mailList: MailOptions[] = [];

    for (const user of users) {
      const lastPassed = user.testAttempts[0];
      let needsReminder = false;
      let reminderType: 'never' | 'expired' = 'never';
      let lastPassedDate = '';

      if (!lastPassed) {
        needsReminder = true;
        reminderType = 'never';
      } else if (lastPassed.completedAt) {
        const expiryDate = new Date(
          lastPassed.completedAt.getTime() + test.periodDays * 24 * 60 * 60 * 1000
        );
        if (new Date() > expiryDate) {
          needsReminder = true;
          reminderType = 'expired';
          lastPassedDate = lastPassed.completedAt.toLocaleDateString('ru-RU');
        }
      }

      if (needsReminder) {
        const statusText =
          reminderType === 'never'
            ? 'Вы ещё не проходили данный тест.'
            : `Последняя успешная сдача: ${lastPassedDate}. Срок действия истёк.`;

        mailList.push({
          to: user.email,
          subject: `[Crystal Spring ИБ] Напоминание: требуется сдать тест по ИБ`,
          text: `Уважаемый(ая) ${user.name},\n\nНапоминаем о необходимости пройти тест:\n«${test.title}» (к документу «${test.document.title}»)\n\n${statusText}\n\nПройти тест: ${FRONTEND_URL}/tests/${test.id}\n\nС уважением,\nСлужба информационной безопасности ТОО «Crystal Spring»`,
          html: `<p>Уважаемый(ая) ${user.name},</p>
<p>Напоминаем о необходимости пройти тест:<br/>
<strong>«${test.title}»</strong> (к документу «${test.document.title}»)</p>
<p>${statusText}</p>
<p><a href="${FRONTEND_URL}/tests/${test.id}">Пройти тест</a></p>
<p>С уважением,<br/>Служба информационной безопасности ТОО «Crystal Spring»</p>`,
        });
      }
    }

    await sendBulk(mailList);
  }
}

export async function sendOverdueTestReminders(): Promise<void> {
  await sendTestReminders();
}

export async function notifyTestCompleted(
  userId: string,
  testId: string,
  score: number,
  isPassed: boolean,
  correctCount: number,
  totalQuestions: number
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { document: true },
  });
  if (!user || !test) return;

  const totalAttempts = await prisma.testAttempt.count({
    where: { userId, testId, completedAt: { not: null } },
  });
  const attemptsLeft = Math.max(0, test.maxAttempts - totalAttempts);

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
  });

  const status = isPassed ? '✅ Сдал(а)' : '❌ Не сдал(а)';

  const mailList: MailOptions[] = admins.map((admin) => ({
    to: admin.email,
    subject: `[Crystal Spring ИБ] ${user.name} завершил(а) тест: ${test.title}`,
    text: `Сотрудник ${user.name} (${user.email}) завершил тест:\n«${test.title}» (к документу «${test.document.title}»)\n\nРезультат: ${status}\nВерных ответов: ${correctCount} из ${totalQuestions}\nБалл: ${score}%\nОставшиеся попытки: ${attemptsLeft} из ${test.maxAttempts}\n\nПодробности: ${FRONTEND_URL}/admin/reports`,
    html: `<p>Сотрудник <strong>${user.name}</strong> (${user.email}) завершил тест:</p>
<p><strong>«${test.title}»</strong> (к документу «${test.document.title}»)</p>
<table style="border-collapse:collapse;margin:12px 0;">
  <tr><td style="padding:4px 12px 4px 0;">Результат:</td><td><strong>${status}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;">Верных ответов:</td><td><strong>${correctCount} из ${totalQuestions}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;">Балл:</td><td><strong>${score}%</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;">Осталось попыток:</td><td><strong>${attemptsLeft} из ${test.maxAttempts}</strong></td></tr>
</table>
<p><a href="${FRONTEND_URL}/admin/reports">Открыть отчёт</a></p>
<p>С уважением,<br/>ИБ-Портал ТОО «Crystal Spring»</p>`,
  }));

  await sendBulk(mailList);
}
