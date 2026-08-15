// Runtime smoke test for backend/src/utils/pdf.ts. tsc cannot catch pdfkit
// runtime failures (undefined field access, bad coordinates, font loading) -
// this exercises the real generator against synthetic data and writes to
// disk instead of an Express Response, so it needs no database or server.
// Run: npx tsx backend/scripts/verify-pdf-generation.ts
import fs from 'fs';
import path from 'path';
import { generateInvoicePDF, generateReceiptPDF, type PdfCompany } from '../src/utils/pdf.js';

const fakeCompany: PdfCompany = {
  name: 'Boutique Test',
  legalName: 'Boutique Test SARL',
  address: '12 Rue des Fleurs',
  city: 'Casablanca',
  ice: '001234567000045',
  ifNumber: '12345678',
  rc: '98765',
  receiptFooter: 'Merci de votre visite !',
};

const fakeSale = {
  ticket: 'TCK-0001',
  createdAt: '12/08/2026 14:30',
  customer: 'Client Test',
  method: 'CASH',
  subtotal: 100,
  taxTotal: 20,
  discountTotal: 5,
  total: 115,
  lines: [
    { name: 'Produit A', quantity: 2, unitPrice: 25, tvaRate: 20, lineTotal: 50 },
    { name: 'Produit B (Rouge, L)', quantity: 1, unitPrice: 50, tvaRate: 20, lineTotal: 50 },
  ],
};

const assertPdf = (filePath: string, label: string) => {
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error(`${label}: output does not start with %PDF- header`);
  }
  if (buffer.length < 500) {
    throw new Error(`${label}: output suspiciously small (${buffer.length} bytes)`);
  }
  console.log(`${label}: OK (${buffer.length} bytes) -> ${filePath}`);
};

const outDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'pdf-verify-'));

const invoicePath = path.join(outDir, 'invoice.pdf');
const invoiceStream = fs.createWriteStream(invoicePath);
generateInvoicePDF(fakeSale, invoiceStream as any, fakeCompany);
invoiceStream.on('finish', () => {
  assertPdf(invoicePath, 'Invoice PDF');

  const receiptPath = path.join(outDir, 'receipt.pdf');
  const receiptStream = fs.createWriteStream(receiptPath);
  generateReceiptPDF(fakeSale, receiptStream as any, fakeCompany);
  receiptStream.on('finish', () => {
    assertPdf(receiptPath, 'Receipt PDF');
    fs.rmSync(outDir, { recursive: true, force: true });
    console.log('All PDF generators verified.');
  });
});
