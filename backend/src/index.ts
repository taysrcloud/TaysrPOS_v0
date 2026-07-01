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
import platformRoutes from './routes/platform.routes.js';
import { requireAuth } from './middleware/auth.js';

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/platform', platformRoutes);
app.use('/oauth', oauthRoutes);
app.use('/connector/api', requireAuth, connectorRoutes);

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
  app.get(/^(?!\/api|\/oauth|\/connector\/api).*/, (_req, res) => {
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


