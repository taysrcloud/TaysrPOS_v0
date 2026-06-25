import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// /connector/api/business-details
router.get('/business-details', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const locations = await prisma.location.findMany({ where: { companyId } });

    res.json({
      data: [{
        id: company?.id,
        name: company?.name,
        currency_symbol: 'MAD',
        currency_id: 1,
        locations: locations.map(loc => ({
          id: loc.id,
          name: loc.name,
          city: '',
          state: '',
          country: 'Morocco',
          landmark: loc.address || '',
          mobile: '',
        })),
        pos_settings: JSON.stringify({
          disable_discount: 0,
          disable_order_tax: 0,
        })
      }]
    });
  } catch (error) {
    next(error);
  }
});

// /connector/api/taxonomy?type=product
router.get('/taxonomy', async (req: AuthRequest, res, next) => {
  try {
    const type = req.query.type;
    if (type !== 'product') return res.json({ data: [] });
    // For now we map distinct categories from products since we don't have a Taxonomy/Category model
    const companyId = req.user!.companyId;
    const products = await prisma.product.findMany({
      where: { companyId },
      select: { categoryId: true },
      distinct: ['categoryId']
    });

    const data = products.map((p, index) => ({
      id: index + 1,
      name: `Categorie ${p.categoryId || 'General'}`,
      short_code: `CAT${p.categoryId || 'GEN'}`,
      parent_id: 0,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// /connector/api/product
router.get('/product', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const products = await prisma.product.findMany({
      where: { companyId },
    });

    const data = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      type: 'single',
      category: { name: 'General', id: 1 },
      brand: { name: '', id: null },
      tax: null,
      product_locations: [],
      image_url: p.imageUrl || '',
      product_variations: [{
        id: p.id,
        name: 'DUMMY',
        variations: [{
          id: p.id,
          name: p.name,
          sub_sku: p.sku,
          sell_price_inc_tax: Number(p.salePrice),
          default_sell_price: Number(p.salePrice),
        }]
      }]
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// POST /connector/api/product
router.post('/product', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const body = req.body;
    
    // Minimal mapping
    const product = await prisma.product.create({
      data: {
        companyId,
        name: body.name || 'Nouveau Produit',
        sku: body.sku || `SKU-${Date.now()}`,
        salePrice: body.single_dpp || body.single_dsp || 0,
        purchasePrice: body.single_dpp || 0,
        type: 'RETAIL',
        barcode: body.barcode_type || 'C128',
      }
    });

    res.json({ data: { id: product.id, name: product.name, sku: product.sku } });
  } catch (error) {
    next(error);
  }
});

// GET /connector/api/contactapi?type=customer
router.get('/contactapi', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const type = req.query.type === 'customer' ? 'CUSTOMER' : 'SUPPLIER'; // Approx

    const contacts = await prisma.contact.findMany({
      where: { companyId, type: type === 'CUSTOMER' ? 'CUSTOMER' : undefined }
    });

    const data = contacts.map(c => ({
      id: c.id,
      name: c.fullName,
      supplier_business_name: c.fullName,
      mobile: c.phone || '',
      email: c.email || '',
      balance: Number(c.balance),
      credit_limit: Number(c.creditLimit),
      city: '',
      state: '',
      country: '',
      landmark: c.address || '',
      custom_field1: '',
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// POST /connector/api/contactapi
router.post('/contactapi', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const body = req.body;

    const contact = await prisma.contact.create({
      data: {
        companyId,
        fullName: body.first_name ? `${body.first_name} ${body.last_name || ''}`.trim() : (body.name || 'Inconnu'),
        type: body.type === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        phone: body.mobile,
      }
    });

    res.json({ data: { id: contact.id, name: contact.fullName, mobile: contact.phone } });
  } catch (error) {
    next(error);
  }
});

// POST /connector/api/sell
router.post('/sell', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const body = req.body;

    let customerId = body.contact_id;
    if (!customerId) {
      const walkIn = await prisma.contact.findFirst({ where: { companyId, name: 'Client comptoir' } });
      customerId = walkIn?.id || null;
    }

    const sale = await prisma.sale.create({
      data: {
        companyId,
        customerId: customerId || undefined,
        locationId: body.location_id || null,
        userId: req.user!.userId,
        status: 'FINAL', // Hanout-express syncs finalized sales
        paymentStatus: body.payment && body.payment.length > 0 ? 'PAID' : 'UNPAID',
        total: body.final_total || 0,
        subTotal: body.final_total || 0, // Ignoring tax details for now
        ticketNumber: `MOB-${Date.now()}`,
        items: {
          create: (body.products || []).map((p: any) => ({
            productId: p.product_id,
            variationId: p.variation_id !== p.product_id ? p.variation_id : null,
            quantity: p.quantity,
            unitPrice: p.unit_price_inc_tax || p.unit_price,
            lineTotal: p.quantity * (p.unit_price_inc_tax || p.unit_price)
          }))
        }
      }
    });

    // Optionally handle payment logs
    if (body.payment && Array.isArray(body.payment)) {
      for (const pay of body.payment) {
        await prisma.payment.create({
          data: {
            saleId: sale.id,
            amount: pay.amount,
            method: pay.method === 'cash' ? 'CASH' : (pay.method === 'card' ? 'CARD' : 'MIXED'),
          }
        });
      }
    }

    res.json({ data: { id: sale.id, invoice_no: sale.ticketNumber } });
  } catch (error) {
    next(error);
  }
});

// POST /connector/api/contactapi-payment
router.post('/contactapi-payment', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.user!.companyId;
    const body = req.body;
    // Simple implementation: updates contact balance and returns ok.
    const contact = await prisma.contact.findUnique({ where: { id: body.contact_id } });
    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { balance: Number(contact.balance) - Number(body.amount) }
      });
    }

    res.json({ success: true, msg: 'Payment added successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
