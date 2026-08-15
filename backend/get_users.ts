import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev?schema=public' } }
});

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, username: true, role: true }
  });
  console.log("TaysrPOS Users:");
  console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
