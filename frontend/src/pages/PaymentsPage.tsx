import { Banknote } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { formatMoney, RecordTable } from '../main';
import { usePos } from '../context/PosContext';

export const PaymentsPage = () => {
  const { sales, paymentFilter, setPaymentFilter, getSaleDueAmount, setReceiptSale, setInvoiceSale, resumeSale, openSaleSettlement } = usePos();
  const rows = sales
    .filter(sale => paymentFilter === 'ALL' || sale.status === paymentFilter)
    .sort((left, right) => {
      const leftDue = getSaleDueAmount(left);
      const rightDue = getSaleDueAmount(right);
      if (left.status === 'Credit' && right.status !== 'Credit') return -1;
      if (right.status === 'Credit' && left.status !== 'Credit') return 1;
      if (rightDue !== leftDue) return rightDue - leftDue;
      return right.id - left.id;
    });
  const outstandingTotal = rows.reduce((sum, sale) => sum + getSaleDueAmount(sale), 0);
  const creditCount = rows.filter(sale => sale.status === 'Credit').length;
  return (
    <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader
          icon={Banknote}
          title="Paiements"
          subtitle="Encaissements et crédits"
          action={<strong style={{ fontSize: '1.2rem', color: '#16a34a' }}>Total: {formatMoney(rows.reduce((sum, sale) => sum + sale.total, 0))}</strong>}
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem 1.5rem' }}>
        <div className="filter-row inline">{(['ALL', 'Payee', 'Credit'] as const).map(value => <button key={value} className={paymentFilter === value ? 'selected' : ''} onClick={() => setPaymentFilter(value)}>{value === 'ALL' ? 'Tous' : value}</button>)}</div>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{rows.length}</span>
            <span className="toolbar-stat-label">Transactions</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{creditCount}</span>
            <span className="toolbar-stat-label">Credits ouverts</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{formatMoney(outstandingTotal)}</span>
            <span className="toolbar-stat-label">Reste a encaisser</span>
          </div>
        </div>
      </div>
      <RecordTable sales={rows} onOpenReceipt={setReceiptSale} onOpenInvoice={setInvoiceSale} onResumeSale={resumeSale} onSettleSale={openSaleSettlement} />
    </section>
  );
};
