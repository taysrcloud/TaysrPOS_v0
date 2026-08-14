import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import productRoutes from './routes/product.routes.js';
import saleRoutes from './routes/sale.routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'TaysrPOS v0 API',
    status: 'ok',
    version: '0.1.0',
    modules: ['retail', 'restaurant', 'inventory', 'cash-register'],
  });
});

import locationRoutes from './routes/location.routes.js';
import contactRoutes from './routes/contact.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import registerRoutes from './routes/register.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import connectorRoutes from './routes/connector.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import authRoutes from './routes/auth.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import platformRoutes from './routes/platform.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import accountingRoutes from './routes/accounting.routes.js';
import commissionRoutes from './routes/commission.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import currencyRoutes from './routes/currency.routes.js';
import deviceRoutes from './routes/device.routes.js';
import syncRoutes from './routes/sync.routes.js';
import receiptRoutes from './routes/receipt.routes.js';
import warrantyRoutes from './routes/warranty.routes.js';
import variationTemplateRoutes from './routes/variation-template.routes.js';
import discountRoutes from './routes/discount.routes.js';
import consolidatedInvoiceRoutes from './routes/consolidated-invoice.routes.js';
import { requireAuth, requireModule, requireDevice } from './middleware/auth.js';

app.use('/api/products', requireAuth, productRoutes);
app.use('/api/sales', requireAuth, saleRoutes);
app.use('/api/locations', requireAuth, locationRoutes);
app.use('/api/contacts', requireAuth, contactRoutes);
app.use('/api/expenses', requireAuth, expenseRoutes);
app.use('/api/purchases', requireAuth, purchaseRoutes);
app.use('/api/register', requireAuth, registerRoutes);
app.use('/api/restaurant', requireAuth, requireModule('RESTAURANT'), restaurantRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/invoices/consolidated', requireAuth, consolidatedInvoiceRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/pricing', requireAuth, pricingRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/commission-agents', requireAuth, commissionRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/dashboard-config', requireAuth, dashboardRoutes);
app.use('/api/currencies', requireAuth, currencyRoutes);
app.use('/api/warranties', requireAuth, warrantyRoutes);
app.use('/api/variation-templates', requireAuth, variationTemplateRoutes);
app.use('/api/discounts', requireAuth, discountRoutes);
app.use('/api/platform', platformRoutes);
app.use('/oauth', oauthRoutes);
app.use('/connector/api', requireAuth, connectorRoutes);
// Track G: Hanout Express device auth + sync, separate from the user-JWT
// paths above - see TRACE.md 2026-08-13 entry for the full contract (sourced
// from the actual taysrcloud/TaysrHanout Retrofit interfaces, not the legacy
// UltimatePOS Connector module connector.routes.ts above was aimed at).
app.use('/device', deviceRoutes);
app.use('/sync', requireDevice, syncRoutes);
app.use('/receipt', requireDevice, receiptRoutes);

app.get('/api/catalog/modules', (_req, res) => {
  res.json({
    enabled: ['retail', 'restaurant'],
    planned: [
      'products',
      'customers',
      'suppliers',
      'stock',
      'pos-sales',
      'restaurant-floor',
      'kitchen-orders',
      'cash-register',
      'reports',
    ],
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

if (existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api|\/oauth|\/connector\/api|\/device|\/sync|\/receipt).*/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!error) return next();
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large.' });
  }
  console.error('Unhandled POS v0 API error:', error);
  return res.status(500).json({ message: 'Server error' });
});

const port = Number(process.env.PORT || 4400);
app.listen(port, () => {
  console.log(`TaysrPOS v0 API listening on ${port}`);
});


