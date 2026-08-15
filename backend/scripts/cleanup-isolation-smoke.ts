import { getDefaultPrisma } from '../src/utils/prisma.js';
const prisma = getDefaultPrisma();
const companies = await prisma.company.findMany({ where: { accountId: { startsWith: 'SMOKE-isolation-' } }, select: { id: true, accountId: true } });
for (const company of companies) {
  await prisma.attendance.deleteMany({ where: { companyId: company.id } });
  await prisma.company.delete({ where: { id: company.id } });
}
console.log(JSON.stringify({ removed: companies.length, accounts: companies.map(item => item.accountId) }, null, 2));
await prisma.$disconnect();
