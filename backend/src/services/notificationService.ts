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
