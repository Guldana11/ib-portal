import prisma from '../config/database';

export async function getTestsForUser(userId: string) {
  const tests = await prisma.test.findMany({
    where: { isActive: true },
    include: {
      document: { select: { id: true, title: true, titleKk: true, version: true } },
      attempts: {
        where: { userId },
        orderBy: { startedAt: 'desc' },
      },
    },
  });

  const acks = await prisma.documentAcknowledgment.findMany({
    where: { userId },
  });

  return tests.map((test) => {
    const docAck = acks.find(
      (a) => a.documentId === test.documentId && a.version === test.document.version
    );

    if (!docAck) {
      const { attempts, ...testData } = test;
      return { ...testData, status: 'no_ack' as const, attemptsUsed: 0 };
    }

    const completedAttempts = test.attempts.filter((a) => a.completedAt);
    const passedAttempt = completedAttempts.find((a) => a.isPassed);

    let status: 'available' | 'passed' | 'failed' | 'expired';
    if (passedAttempt) {
      const passedDate = passedAttempt.completedAt!;
      const expiryDate = new Date(passedDate.getTime() + test.periodDays * 24 * 60 * 60 * 1000);
      status = new Date() > expiryDate ? 'expired' : 'passed';
    } else if (completedAttempts.length >= test.maxAttempts) {
      status = 'failed';
    } else {
      status = 'available';
    }

    const { attempts, ...testData } = test;
    return { ...testData, status, attemptsUsed: completedAttempts.length };
  });
}

export async function getTestWithQuestions(testId: string) {
  return prisma.test.findUnique({
    where: { id: testId },
    include: {
      document: { select: { id: true, title: true, titleKk: true, version: true } },
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          options: {
            orderBy: { orderIndex: 'asc' },
            select: { id: true, text: true, orderIndex: true },
          },
        },
      },
    },
  });
}

export async function getInProgressAttempt(userId: string, testId: string) {
  return prisma.testAttempt.findFirst({
    where: { userId, testId, completedAt: null },
    select: { id: true, startedAt: true },
  });
}

export async function cancelAttempt(userId: string, testId: string, attemptId: string) {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, userId, testId, completedAt: null },
  });
  if (!attempt) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Попытка не найдена' };
  }
  await prisma.$transaction([
    prisma.testAnswer.deleteMany({ where: { attemptId } }),
    prisma.testAttempt.delete({ where: { id: attemptId } }),
  ]);
}

export async function startTest(userId: string, testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { document: true },
  });

  if (!test || !test.isActive) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Тест не найден' };
  }

  const ack = await prisma.documentAcknowledgment.findFirst({
    where: { userId, documentId: test.documentId, version: test.document.version },
  });

  if (!ack) {
    throw { status: 403, code: 'NO_ACKNOWLEDGMENT', message: 'Сначала ознакомьтесь с документом' };
  }

  const existingInProgress = await prisma.testAttempt.findFirst({
    where: { userId, testId, completedAt: null },
  });

  if (existingInProgress) {
    throw {
      status: 409,
      code: 'TEST_IN_PROGRESS',
      message: 'У вас есть незавершённая попытка',
      attemptId: existingInProgress.id,
      startedAt: existingInProgress.startedAt,
    };
  }

  const completedAttempts = await prisma.testAttempt.count({
    where: { userId, testId, completedAt: { not: null } },
  });

  if (completedAttempts >= test.maxAttempts) {
    throw { status: 409, code: 'MAX_ATTEMPTS_REACHED', message: 'Исчерпаны все попытки' };
  }

  return prisma.testAttempt.create({
    data: { userId, testId },
  });
}

export async function submitTest(
  userId: string,
  testId: string,
  attemptId: string,
  answers: { questionId: string; selectedIds: string[] }[]
) {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, userId, testId, completedAt: null },
  });

  if (!attempt) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Попытка не найдена или уже завершена' };
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        include: { options: true },
      },
    },
  });

  if (!test) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Тест не найден' };
  }

  let correctCount = 0;
  const totalQuestions = test.questions.length;
  const answerResults: {
    questionId: string;
    isCorrect: boolean;
    explanation: string | null;
    correctOptionIds: string[];
  }[] = [];

  for (const question of test.questions) {
    const userAnswer = answers.find((a) => a.questionId === question.id);
    const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const selectedIds = userAnswer?.selectedIds || [];

    const isCorrect =
      correctOptionIds.length === selectedIds.length &&
      correctOptionIds.every((id) => selectedIds.includes(id));

    if (isCorrect) correctCount++;

    answerResults.push({
      questionId: question.id,
      isCorrect,
      explanation: question.explanation,
      correctOptionIds,
    });
  }

  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isPassed = score >= test.passingScore;

  await prisma.$transaction([
    prisma.testAnswer.createMany({
      data: answers.map((a) => ({
        attemptId,
        questionId: a.questionId,
        selectedIds: a.selectedIds,
      })),
    }),
    prisma.testAttempt.update({
      where: { id: attemptId },
      data: { score, isPassed, completedAt: new Date() },
    }),
  ]);

  return { score, isPassed, correctCount, totalQuestions, answers: answerResults };
}

export async function getTestHistory(userId: string, testId: string) {
  return prisma.testAttempt.findMany({
    where: { userId, testId, completedAt: { not: null } },
    select: {
      id: true,
      score: true,
      isPassed: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { startedAt: 'desc' },
  });
}
