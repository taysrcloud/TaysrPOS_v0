const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

const startIndex = content.indexOf('  const renderSettings = () => (');
const endIndex = content.indexOf('  const renderRegisters = () => {');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + content.slice(endIndex);
  
  const importStatement = `import { SettingsPage } from './pages/Settings';\n`;
  const importsIndex = content.indexOf('import { InvoiceSettingsPanel');
  if (importsIndex !== -1) {
    content = content.slice(0, importsIndex) + importStatement + content.slice(importsIndex);
  }
  
  const callReplacement = `<SettingsPage
      companySettings={companySettings} setCompanySettings={setCompanySettings} setStatus={setStatus}
      settingsTab={settingsTab} setSettingsTab={setSettingsTab} locations={locations} setLocations={setLocations}
      currentLocationId={currentLocationId} setCurrentLocationId={setCurrentLocationId} apiFetch={apiFetch}
      restaurantEnabled={restaurantEnabled} rolePermissions={rolePermissions} saveRolePermissions={saveRolePermissions}
      defaultRolePermissions={defaultRolePermissions} allModuleLabels={allModuleLabels} baseModules={baseModules}
      enabledModules={enabledModules}
    />`;
    
  content = content.replace(/return renderSettings\(\);/g, `return (${callReplacement});`);
  
  fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', content, 'utf8');
  console.log('Successfully extracted SettingsPage from main.tsx');
} else {
  console.error('Could not find renderSettings or renderRegisters');
}
