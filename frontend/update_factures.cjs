const fs = require('fs');
let content = fs.readFileSync('src/main.tsx', 'utf-8');

// 1. Add selectedFacture state
content = content.replace(
    /(const \[invoices, setInvoices\] = useState<any\[\]>\(\[\]\);)/,
    '$1\n  const [selectedFacture, setSelectedFacture] = useState<any>(null);'
);

// 2. Update Imprimer button
content = content.replace(
    '<button className="row-action" onClick={() => { /* TODO: Print Invoice */ }}>Imprimer</button>',
    '<button className="row-action" onClick={() => setSelectedFacture(inv)}>Imprimer</button>'
);

// 3. Add FacturePanel below InvoicePanel rendering
content = content.replace(
    /(\{invoiceSale && <InvoicePanel.*?\/>\})/,
    '$1\n        {selectedFacture && <FacturePanel facture={selectedFacture} settings={companySettings} onClose={() => setSelectedFacture(null)} />}'
);

// 4. Define FacturePanel component at the end of the file
const facturePanelCode = `
const FacturePanel = ({ facture, settings, onClose }: { facture: any; settings: any; onClose: () => void }) => {
  const [mode, setMode] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
  
  const allItems = facture.sales.flatMap((sale: any) => sale.items || []);
  const consolidatedItems = Object.values(allItems.reduce((acc: any, item: any) => {
    const key = \`\${item.productId}-\${item.variationId || ''}\`;
    if (!acc[key]) {
      acc[key] = { name: item.name, quantity: 0, unitPrice: item.unitPrice };
    }
    acc[key].quantity += item.quantity;
    return acc;
  }, {}));

  return (
  <div className="receipt-backdrop print-a4" role="dialog" aria-modal="true">
    <section className="invoice-panel">
      <div className="invoice-container">
        {/* Header */}
        <div className="invoice-header-row">
          <div className="invoice-brand">
            {settings.showLogo && settings.logoUrl && <img src={settings.logoUrl} alt="Logo" />}
            <h1>{settings.companyName}</h1>
            <p>{settings.companyAddress}</p>
            <p>{settings.companyPhone}</p>
            <p>ICE: {settings.companyIce || '_________________'}</p>
          </div>
          <div className="invoice-title">
            <h2>FACTURE GLOBALE</h2>
            <p>N° {facture.number}</p>
            <div className="no-print" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={\`ghost-action \${mode === 'SUMMARY' ? 'selected' : ''}\`} onClick={() => setMode('SUMMARY')} style={{ padding: '0.25rem 0.5rem', border: mode === 'SUMMARY' ? '1px solid #cbd5e1' : 'none', borderRadius: '4px' }}>Résumée</button>
              <button type="button" className={\`ghost-action \${mode === 'DETAILED' ? 'selected' : ''}\`} onClick={() => setMode('DETAILED')} style={{ padding: '0.25rem 0.5rem', border: mode === 'DETAILED' ? '1px solid #cbd5e1' : 'none', borderRadius: '4px' }}>Détaillée</button>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="invoice-meta-row">
          <div className="invoice-meta-col">
            <span>Date</span>
            <strong>{new Date(facture.createdAt).toLocaleDateString('fr-FR')}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Client</span>
            <strong>{facture.customer?.name || '______________________'}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Nb. Tickets</span>
            <strong>{facture.sales.length} ticket(s)</strong>
          </div>
        </div>

        {/* Table */}
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Qté</th>
              <th className="right">Prix Unitaire</th>
              <th className="right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {mode === 'DETAILED' ? (
              facture.sales.map((sale: any) => (
                <React.Fragment key={sale.id}>
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={4} style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                      Ticket {sale.ticketNumber || sale.ticket || sale.id} du {new Date(sale.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                  {(sale.items || []).map((line: any, idx: number) => (
                    <tr key={\`\${sale.id}-\${idx}\`}>
                      <td>{line.name}</td>
                      <td className="right">{line.quantity}</td>
                      <td className="right">{formatMoney(line.unitPrice)}</td>
                      <td className="right">{formatMoney(line.unitPrice * line.quantity)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            ) : (
              (consolidatedItems as any[]).map((line: any, idx: number) => (
                <tr key={idx}>
                  <td>{line.name}</td>
                  <td className="right">{line.quantity}</td>
                  <td className="right">{formatMoney(line.unitPrice)}</td>
                  <td className="right">{formatMoney(line.unitPrice * line.quantity)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>Total HT:</span>
            <span>{formatMoney(facture.total - facture.taxTotal)}</span>
          </div>
          <div className="invoice-total-row">
            <span>TVA:</span>
            <span>{formatMoney(facture.taxTotal)}</span>
          </div>
          <div className="invoice-total-row grand-total">
            <span>Net à payer TTC:</span>
            <span>{formatMoney(facture.total)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          {settings.invoiceFooter?.split('\\n').map((line: string, i: number) => <p key={i}>{line}</p>)}
        </div>
      </div>
      <div className="receipt-actions no-print">
        <button type="button" className="primary-action" onClick={() => window.print()}><FileText size={18} /> Imprimer</button>
        <button type="button" className="ghost-action" onClick={onClose}><XCircle size={18} /> Fermer</button>
      </div>
    </section>
  </div>
  );
};
`;

content += "\n" + facturePanelCode;
fs.writeFileSync('src/main.tsx', content, 'utf-8');
console.log("Updated main.tsx");
