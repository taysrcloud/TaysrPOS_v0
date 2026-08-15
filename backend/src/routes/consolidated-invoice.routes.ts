import express from 'express';
import prisma from '../utils/prisma.js';

const router = express.Router();

// POST /api/invoices/consolidated
router.post('/', async (req, res) => {
  const { customerId, saleIds, periodStart, periodEnd } = req.body;
  const companyId = (req as any).user.companyId;

  try {
    const customer = await prisma.contact.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.companyId !== companyId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!customer.ice) {
      return res.status(400).json({ error: 'Customer must have an ICE for consolidated invoices' });
    }

    const sales = await prisma.sale.findMany({
      where: {
        id: { in: saleIds },
        companyId,
        customerId,
        status: 'FINAL',
        consolidatedInvoiceId: null,
      },
    });

    if (sales.length === 0) {
      return res.status(400).json({ error: 'No valid sales found for consolidation' });
    }

    const total = sales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
    const taxTotal = sales.reduce((sum: number, sale: any) => sum + Number(sale.taxTotal), 0);

    const consolidatedInvoice = await prisma.consolidatedInvoice.create({
      data: {
        companyId,
        customerId,
        reference: `CI-${Date.now()}`,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        total,
        taxTotal,
        sales: {
          connect: sales.map((s: any) => ({ id: s.id })),
        },
      },
    });

    res.status(201).json(consolidatedInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/invoices/consolidated
router.get('/', async (req, res) => {
  const companyId = (req as any).user.companyId;

  try {
    const invoices = await prisma.consolidatedInvoice.findMany({
      where: { companyId },
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/invoices/consolidated/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;
  const companyId = (req as any).user.companyId;

  try {
    const invoice = await prisma.consolidatedInvoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        company: true,
        sales: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.companyId !== companyId) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // HTML A4 summary response for the test/frontend to render or parse
    const html = `
      <html>
        <head><title>Consolidated Invoice ${invoice.reference}</title></head>
        <body>
          <h1>Consolidated Invoice ${invoice.reference}</h1>
          <p>Company: ${invoice.company.name}</p>
          <p>Customer: ${invoice.customer.fullName} (ICE: ${invoice.customer.ice})</p>
          <p>Period: ${invoice.periodStart.toISOString()} - ${invoice.periodEnd.toISOString()}</p>
          <p>Total: ${invoice.total}</p>
          <p>Tax Total: ${invoice.taxTotal}</p>
          <ul>
            ${invoice.sales.map((s: any) => `<li>Sale ${s.id}: ${s.total}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
