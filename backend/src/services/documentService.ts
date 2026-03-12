import prisma from '../config/database';

export async function getPublishedDocuments(userId: string) {
  const documents = await prisma.document.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    include: {
      acknowledgments: {
        where: { userId },
      },
    },
  });

  return documents.map((doc) => {
    const latestAck = doc.acknowledgments.find((a) => a.version === doc.version);
    const hasAnyAck = doc.acknowledgments.length > 0;

    let ackStatus: 'acknowledged' | 'outdated' | 'pending';
    if (latestAck) {
      ackStatus = 'acknowledged';
    } else if (hasAnyAck) {
      ackStatus = 'outdated';
    } else {
      ackStatus = 'pending';
    }

    const { acknowledgments, ...docData } = doc;
    return { ...docData, ackStatus };
  });
}

export async function getDocumentById(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      acknowledgments: {
        where: { userId },
      },
    },
  });

  if (!doc) return null;

  const latestAck = doc.acknowledgments.find((a) => a.version === doc.version);
  const hasAnyAck = doc.acknowledgments.length > 0;

  let ackStatus: 'acknowledged' | 'outdated' | 'pending';
  if (latestAck) {
    ackStatus = 'acknowledged';
  } else if (hasAnyAck) {
    ackStatus = 'outdated';
  } else {
    ackStatus = 'pending';
  }

  const { acknowledgments, ...docData } = doc;
  return { ...docData, ackStatus };
}

export async function acknowledgeDocument(userId: string, documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw { status: 404, code: 'NOT_FOUND', message: 'Документ не найден' };
  if (!doc.isPublished) throw { status: 404, code: 'NOT_FOUND', message: 'Документ не опубликован' };

  const existing = await prisma.documentAcknowledgment.findUnique({
    where: {
      userId_documentId_version: { userId, documentId, version: doc.version },
    },
  });

  if (existing) {
    throw { status: 409, code: 'ALREADY_ACKNOWLEDGED', message: 'Вы уже ознакомились с этой версией документа' };
  }

  return prisma.documentAcknowledgment.create({
    data: { userId, documentId, version: doc.version },
  });
}

export async function getAllDocuments() {
  return prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { acknowledgments: true } },
    },
  });
}
