import PDFDocument from 'pdfkit';
import { Response } from 'express';

const formatMoney = (amount: number) => {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
};

export const generateInvoicePDF = (sale: any, res: Response) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // Header
  doc.fontSize(20).text('FACTURE', { align: 'right' });
  doc.fontSize(10).text(`N° ${sale.ticket}`, { align: 'right' });
  doc.text(`Date: ${sale.createdAt}`, { align: 'right' });
  doc.moveDown();

  // Company Info
  doc.fontSize(14).text('TaysrPOS Demo', { align: 'left' });
  doc.fontSize(10).text('Casablanca, Maroc');
  doc.text('ICE: 000000000000000');
  doc.text('RC: 123456');
  doc.moveDown(2);

  // Client Info
  doc.text(`Client: ${sale.customer}`);
  doc.moveDown(2);

  // Table Header
  const tableTop = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Description', 50, tableTop);
  doc.text('Qté', 300, tableTop, { width: 50, align: 'right' });
  doc.text('P.U', 350, tableTop, { width: 70, align: 'right' });
  doc.text('TVA', 420, tableTop, { width: 50, align: 'right' });
  doc.text('Total', 470, tableTop, { width: 70, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).stroke();
  doc.font('Helvetica');

  let y = tableTop + 25;

  // Table Rows
  sale.lines.forEach((line: any) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.text(line.name, 50, y, { width: 240 });
    doc.text(line.quantity.toString(), 300, y, { width: 50, align: 'right' });
    doc.text(formatMoney(line.unitPrice), 350, y, { width: 70, align: 'right' });
    doc.text(`${line.tvaRate}%`, 420, y, { width: 50, align: 'right' });
    doc.text(formatMoney(line.lineTotal), 470, y, { width: 70, align: 'right' });
    y += 20;
  });

  doc.moveTo(50, y).lineTo(540, y).stroke();
  y += 15;

  // Summary
  doc.font('Helvetica-Bold');
  doc.text('Total HT:', 350, y, { width: 100, align: 'right' });
  doc.text(formatMoney(sale.subtotal), 450, y, { width: 90, align: 'right' });
  y += 20;

  doc.text('TVA:', 350, y, { width: 100, align: 'right' });
  doc.text(formatMoney(sale.taxTotal), 450, y, { width: 90, align: 'right' });
  y += 20;

  if (sale.discountTotal > 0) {
    doc.text('Remise:', 350, y, { width: 100, align: 'right' });
    doc.text(`-${formatMoney(sale.discountTotal)}`, 450, y, { width: 90, align: 'right' });
    y += 20;
  }

  doc.fontSize(12);
  doc.text('NET À PAYER:', 300, y, { width: 150, align: 'right' });
  doc.text(formatMoney(sale.total), 450, y, { width: 90, align: 'right' });

  doc.end();
};

export const generateReceiptPDF = (sale: any, res: Response) => {
  // 80mm is ~226 points wide
  const doc = new PDFDocument({ margin: 10, size: [226, 800] });
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(14).text('TaysrPOS', { align: 'center' });
  doc.font('Helvetica').fontSize(10).text('Casablanca', { align: 'center' });
  doc.text('ICE: 000000000000000', { align: 'center' });
  doc.moveDown();

  doc.text(`Ticket: ${sale.ticket}`, { align: 'center' });
  doc.text(sale.createdAt, { align: 'center' });
  doc.text('------------------------------------------', { align: 'center' });

  doc.font('Helvetica-Bold');
  doc.text('QTE  PRIX', 10, doc.y, { align: 'right' });
  doc.font('Helvetica');

  sale.lines.forEach((line: any) => {
    doc.text(line.name, 10, doc.y, { width: 140, align: 'left', lineBreak: false });
    const priceStr = `${line.quantity}x ${line.unitPrice}`;
    doc.text(priceStr, 150, doc.y, { width: 66, align: 'right' });
    doc.moveDown(0.5);
  });

  doc.text('------------------------------------------', { align: 'center' });
  doc.font('Helvetica-Bold');
  doc.text(`TOTAL: ${formatMoney(sale.total)}`, { align: 'right' });
  doc.font('Helvetica');

  doc.moveDown();
  doc.text(`Client: ${sale.customer}`, { align: 'center' });
  doc.text(`Payé par: ${sale.method}`, { align: 'center' });
  doc.moveDown(2);
  doc.text('Merci de votre visite !', { align: 'center' });

  doc.end();
};
