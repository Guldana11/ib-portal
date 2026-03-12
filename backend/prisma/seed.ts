import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crystalspring.kz' },
    update: {},
    create: {
      email: 'admin@crystalspring.kz',
      name: 'Администратор',
      googleId: 'seed-admin-google-id',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: 'employee1@crystalspring.kz' },
    update: {},
    create: {
      email: 'employee1@crystalspring.kz',
      name: 'Иванов Иван',
      googleId: 'seed-employee1-google-id',
      role: Role.EMPLOYEE,
      isActive: true,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'employee2@crystalspring.kz' },
    update: {},
    create: {
      email: 'employee2@crystalspring.kz',
      name: 'Петрова Мария',
      googleId: 'seed-employee2-google-id',
      role: Role.EMPLOYEE,
      isActive: true,
    },
  });

  console.log('Seed completed:', { admin: admin.email, employee1: employee1.email, employee2: employee2.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
