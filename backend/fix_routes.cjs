const fs = require('fs');

const fixProductRoutes = () => {
  let content = fs.readFileSync('src/routes/product.routes.ts', 'utf8');
  
  // Remove ensureDemoCompany definition
  content = content.replace(/const ensureDemoCompany = async \(\) => \{[\s\S]*?return \{ company, unit, warehouse \};\n\};\n/g, '');
  
  // Replace router.get('/', async (req, res) => {
  content = content.replace(/router\.get\('\/', async \(req, res\) => \{/g, "router.get('/', requireAuth, async (req: any, res: any) => {");
  
  // Inside get('/'): const { company } = await ensureDemoCompany();
  content = content.replace(/const \{ company \} = await ensureDemoCompany\(\);/g, "const companyId = req.user.companyId;\n    const company = { id: companyId };");
  
  // Inside post('/'): const { company, unit: defaultUnit, warehouse } = await ensureDemoCompany();
  const replacementPost = `const companyId = req.user.companyId;
    const company = { id: companyId };
    let defaultUnit = await prisma.unit.findFirst({ where: { companyId } });
    if (!defaultUnit) defaultUnit = await prisma.unit.create({ data: { companyId, name: 'Piece', shortName: 'pcs' } });
    let warehouse = await prisma.warehouse.findFirst({ where: { companyId, isMain: true } });
    if (!warehouse) warehouse = await prisma.warehouse.create({ data: { companyId, name: 'Magasin principal', isMain: true } });`;
  
  content = content.replace(/const \{ company, unit: defaultUnit, warehouse \} = await ensureDemoCompany\(\);/g, replacementPost);
  
  fs.writeFileSync('src/routes/product.routes.ts', content);
};

const fixSaleRoutes = () => {
  let content = fs.readFileSync('src/routes/sale.routes.ts', 'utf8');
  
  // Remove ensureDemoCompany
  content = content.replace(/const ensureDemoCompany = async \(\) => \{[\s\S]*?return \{ company, location, warehouse \};\n\};\n/g, '');
  
  // Replace router.get('/', async (req, res) => {
  content = content.replace(/router\.get\('\/', async \(req, res\) => \{/g, "router.get('/', requireAuth, async (req: any, res: any) => {");
  
  // Replace router.get('/cash-sessions', async (req, res) => {
  content = content.replace(/router\.get\('\/cash-sessions', async \(req, res\) => \{/g, "router.get('/cash-sessions', requireAuth, async (req: any, res: any) => {");

  // Inside get('/', get('/cash-sessions', post('/'):
  const replacement = `const companyId = req.user.companyId;
    const company = { id: companyId };
    let location = await prisma.location.findFirst({ where: { companyId } });
    if (!location) location = await prisma.location.create({ data: { companyId, name: 'Magasin principal', isActive: true } });
    let warehouse = await prisma.warehouse.findFirst({ where: { companyId, isMain: true } });
    if (!warehouse) warehouse = await prisma.warehouse.create({ data: { companyId, name: 'Magasin principal', isMain: true } });`;

  content = content.replace(/const \{ company \} = await ensureDemoCompany\(\);/g, "const companyId = req.user.companyId;\n    const company = { id: companyId };");
  content = content.replace(/const \{ company, location, warehouse \} = await ensureDemoCompany\(\);/g, replacement);
  
  fs.writeFileSync('src/routes/sale.routes.ts', content);
};

fixProductRoutes();
fixSaleRoutes();
console.log('Fixed routes');
