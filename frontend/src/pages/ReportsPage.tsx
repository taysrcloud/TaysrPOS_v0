import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, Banknote, Download, CreditCard, ClipboardList, ReceiptText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from '../recharts-stub';
import { PageHeader } from '../components/PageHeader';
import { formatMoney, methodLabel, matchesPeriod, apiFetch, type SaleRecord, type PaymentMethod } from '../main';
import { usePos } from '../context/PosContext';

export const ReportsPage = () => {
  const {
    sales, products, visibleProducts, lowStockProducts, locations,
    reportsTab, setReportsTab, reportPeriod, setReportPeriod,
    dashboardLocationFilter, setDashboardLocationFilter, getSaleDueAmount,
  } = usePos();

  const [trialBalanceData, setTrialBalanceData] = useState<any[]>([]);
  const [trialBalanceSummary, setTrialBalanceSummary] = useState<any>(null);
  const [commissionReportData, setCommissionReportData] = useState<any[]>([]);

  const [accountingSubTab, setAccountingSubTab] = useState<'trial' | 'ledger' | 'pnl' | 'tax'>('trial');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [accStartDate, setAccStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [accEndDate, setAccEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');


  useEffect(() => {
    if (reportsTab === 'comptabilite') {
      if (accountingSubTab === 'trial') {
        apiFetch('/api/accounting/trial-balance')
          .then(res => res.json())
          .then(data => {
            if (data.trialBalance) {
              setTrialBalanceData(data.trialBalance);
              setTrialBalanceSummary(data.summary);
            }
          })
          .catch(console.error);
      } else if (accountingSubTab === 'ledger' && selectedAccountId) {
        apiFetch(`/api/accounting/ledger/${selectedAccountId}?startDate=${accStartDate}&endDate=${accEndDate}`)
          .then(res => res.json())
          .then(data => setLedgerData(data))
          .catch(console.error);
      } else if (accountingSubTab === 'pnl') {
        apiFetch(`/api/accounting/pnl?startDate=${accStartDate}&endDate=${accEndDate}${dashboardLocationFilter !== 'ALL' ? `&locationId=${dashboardLocationFilter}` : ''}`)
          .then(res => res.json())
          .then(data => setPnlData(data))
          .catch(console.error);
      } else if (accountingSubTab === 'tax') {
        apiFetch(`/api/accounting/tax-report?startDate=${accStartDate}&endDate=${accEndDate}`)
          .then(res => res.json())
          .then(data => setTaxData(data))
          .catch(console.error);
      }
    } else if (reportsTab === 'commissions') {
      apiFetch('/api/commission-agents/report')
        .then(res => res.json())
        .then(data => {
          if (data.report) {
            setCommissionReportData(data.report);
          }
        })
        .catch(console.error);
    }
  }, [reportsTab, accountingSubTab, accStartDate, accEndDate, selectedAccountId, dashboardLocationFilter]);

  const filterByPeriod = (list: SaleRecord[]) => list.filter(s => matchesPeriod(s.createdAtISO ?? s.createdAt, reportPeriod));

  const exportCSV = (data: SaleRecord[]) => {
    const header = 'Ticket,Date,Client,Methode,Statut,Total\n';
    const rows = data.map(s => `${s.ticket},"${s.createdAt}","${s.customer}",${methodLabel[s.method]},${s.status},${s.total.toFixed(2)}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-ventes-${reportPeriod}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paidSales = filterByPeriod(sales.filter(s => s.status === 'Payee'));

  // Aggregation calculations
  const salesByDate = {} as Record<string, number>;
  const profitByDate = {} as Record<string, number>;
  const salesByCashier = {} as Record<string, { name: string; sales: number; count: number }>;

  let totalMargin = 0;
  let totalNet = 0;
  let totalTax = 0;
  let totalGross = 0;

  paidSales.forEach(sale => {
    const day = sale.createdAt.split(' ')[0] || sale.createdAt;
    salesByDate[day] = (salesByDate[day] || 0) + sale.total;

    const cashier = sale.cashierName || 'Inconnu';
    if (!salesByCashier[cashier]) salesByCashier[cashier] = { name: cashier, sales: 0, count: 0 };
    salesByCashier[cashier].sales += sale.total;
    salesByCashier[cashier].count += 1;

    totalGross += sale.total;

    let saleCost = 0;
    let saleTax = 0;
    let saleNet = 0;
    if (sale.lines && sale.lines.length > 0) {
      sale.lines.forEach(line => {
        const product = products.find(p => p.id === line.productId);
        const currentPrice = line.unitPrice ?? (product?.salePrice || 0);
        const cost = product?.purchasePrice || 0;
        const taxRate = product?.tvaRate || 0;
        const netPrice = currentPrice / (1 + taxRate / 100);

        saleCost += cost * line.quantity;
        saleNet += netPrice * line.quantity;
        saleTax += (currentPrice - netPrice) * line.quantity;
      });
    } else {
      // Fallback for mock data without lines
      saleNet = sale.total / 1.2;
      saleCost = saleNet * 0.7; // assume 30% margin
      saleTax = sale.total - saleNet;
    }

    profitByDate[day] = (profitByDate[day] || 0) + (saleNet - saleCost);
    totalMargin += (saleNet - saleCost);
    totalNet += saleNet;
    totalTax += saleTax;
  });

  const activeDays = Object.keys(salesByDate).sort();
  const salesVsProfitData = activeDays.map(day => ({
    name: day === 'Aujourd' ? "Aujourd'hui" : day,
    Ventes: Number(salesByDate[day].toFixed(2)),
    Profit: Number(profitByDate[day].toFixed(2))
  }));

  const cashierPerformance = Object.values(salesByCashier).sort((a, b) => b.sales - a.sales);

  const salesByMethod = paidSales.reduce((acc, sale) => {
    acc[sale.method] = (acc[sale.method] || 0) + sale.total;
    return acc;
  }, {} as Partial<Record<PaymentMethod, number>>);

  const productCounts = paidSales.reduce((acc, sale) => {
    sale.lines?.forEach(line => {
      acc[line.name] = (acc[line.name] || 0) + line.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const topProductsData = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantite]) => ({ name, quantite }));

  const renderTabNav = () => (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
      <button
        onClick={() => setReportsTab('synthese')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'synthese' ? '#0f172a' : 'transparent', color: reportsTab === 'synthese' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <BarChart3 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Synthèse
      </button>
      <button
        onClick={() => setReportsTab('ventes')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'ventes' ? '#0f172a' : 'transparent', color: reportsTab === 'ventes' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <TrendingUp size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Ventes
      </button>
      <button
        onClick={() => setReportsTab('produits')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'produits' ? '#0f172a' : 'transparent', color: reportsTab === 'produits' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <Package size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Produits
      </button>
      <button
        onClick={() => setReportsTab('paiements')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'paiements' ? '#0f172a' : 'transparent', color: reportsTab === 'paiements' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <Banknote size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Paiements
      </button>
      <button
        onClick={() => setReportsTab('comptabilite')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'comptabilite' ? '#0f172a' : 'transparent', color: reportsTab === 'comptabilite' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <ReceiptText size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Comptabilité
      </button>
      <button
        onClick={() => setReportsTab('commissions')}
        style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'commissions' ? '#0f172a' : 'transparent', color: reportsTab === 'commissions' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
        <ClipboardList size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Commissions
      </button>
    </div>
  );

  return (
    <section style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        icon={BarChart3}
        title="Tableau de bord"
        subtitle="Tableau de bord financier"
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={dashboardLocationFilter}
              onChange={e => setDashboardLocationFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 500, color: '#334155' }}
            >
              <option value="ALL">Tous les magasins</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
            <button
              className="ghost-action"
              onClick={() => exportCSV(paidSales)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Download size={16} /> Exporter CSV
            </button>
          </div>
        }
      />

      {renderTabNav()}
      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem', gap: '0.5rem', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '0 1rem', color: '#64748b', fontWeight: 600, fontSize: '0.9rem', borderRight: '1px solid #e2e8f0' }}>Période</div>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'today', label: "Aujourd'hui" },
          { id: 'week', label: 'Cette semaine' },
          { id: 'month', label: 'Ce mois' },
          { id: 'year', label: 'Cette année' },
        ].map(period => (
          <button
            key={period.id}
            onClick={() => setReportPeriod(period.id as any)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: reportPeriod === period.id ? '#f1f5f9' : 'transparent',
              color: reportPeriod === period.id ? '#0f172a' : '#64748b',
              fontWeight: reportPeriod === period.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {period.label}
          </button>
        ))}
      </div>

      {reportsTab === 'synthese' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #3b82f6', padding: '1.5rem' }}>
              <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Chiffre d'Affaire (TTC)</p>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#0f172a' }}>{formatMoney(totalGross)}</h3>
            </div>
            <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #10b981', padding: '1.5rem' }}>
              <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Marge Brute Estimée</p>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#10b981' }}>{formatMoney(totalMargin)}</h3>
            </div>
            <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #f59e0b', padding: '1.5rem' }}>
              <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Panier Moyen</p>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#f59e0b' }}>{formatMoney(paidSales.length > 0 ? totalGross / paidSales.length : 0)}</h3>
            </div>
            <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #8b5cf6', padding: '1.5rem' }}>
              <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Tickets Encaissés</p>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#0f172a' }}>{paidSales.length}</h3>
            </div>
          </div>

          <div className="panel wide-panel">
            <div className="panel-title compact"><div><p>Tendances</p><h2>Ventes & Profit par Jour</h2></div></div>
            <div style={{ minHeight: '300px', marginTop: '1rem', padding: '1rem 0' }}>
              {salesVsProfitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={salesVsProfitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="Ventes" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Line yAxisId="left" type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune donnée de vente disponible.</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            <div className="panel">
              <div className="panel-title compact"><div><p>Palmarès</p><h2>Top Articles Vendus</h2></div></div>
              <div style={{ minHeight: '250px', marginTop: '1rem', padding: '1rem 0' }}>
                {topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart layout="vertical" data={topProductsData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={150} tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="quantite" name="Quantité" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune donnée disponible.</div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-title compact"><div><p>Équipe</p><h2>Performance Caissiers</h2></div></div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-head" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <span>Caissier</span>
                  <span>Tickets</span>
                  <span>Ventes (TTC)</span>
                </div>
                {cashierPerformance.map(cashier => (
                  <div className="cart-row" key={cashier.name} style={{ gridTemplateColumns: '1fr auto auto' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{cashier.name}</span>
                    <span style={{ color: '#64748b', textAlign: 'center' }}>{cashier.count}</span>
                    <span style={{ fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{formatMoney(cashier.sales)}</span>
                  </div>
                ))}
                {cashierPerformance.length === 0 && <div className="pos-empty">Aucune donnée disponible.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportsTab === 'ventes' && (
        <div className="panel wide-panel">
          <div className="panel-title compact"><div><p>Détails</p><h2>Journal des Ventes</h2></div></div>
          <div className="cart-table" style={{ marginTop: '1rem' }}>
            <div className="cart-head">
              <span>Réf Ticket</span>
              <span>Date</span>
              <span>Client</span>
              <span>Mode Paiement</span>
              <span>Total</span>
            </div>
            {paidSales.map(sale => (
              <div className="cart-row" key={sale.id}>
                <span><strong>{sale.ticket}</strong></span>
                <span>{sale.createdAt}</span>
                <span>{sale.customer}</span>
                <span><span style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>{methodLabel[sale.method]}</span></span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{formatMoney(getSaleDueAmount(sale))}</span>
              </div>
            ))}
            {paidSales.length === 0 && <div className="pos-empty">Aucune vente enregistrée.</div>}
          </div>
        </div>
      )}

      {reportsTab === 'produits' && (
        <div className="workspace-grid" style={{ padding: 0 }}>
          <div className="panel">
            <div className="panel-title compact"><div><p>Palmarès</p><h2>Top Articles (Quantités)</h2></div></div>
            <div className="cart-table" style={{ marginTop: '1rem' }}>
              <div className="cart-head"><span>Produit</span><span>Qte Vendue</span></div>
              {topProductsData.map((item) => (
                <div className="cart-row" key={item.name} style={{ gridTemplateColumns: '1fr auto' }}>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 700 }}>{item.quantite}x</span>
                </div>
              ))}
              {topProductsData.length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun article vendu</span>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title compact"><div><p>Indicateurs</p><h2>Qualité Stock</h2></div></div>
            <div className="summary-list" style={{ marginTop: '1rem' }}>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: '#64748b' }}>Articles au catalogue</span>
                <strong style={{ fontSize: '1.5rem', display: 'block', marginTop: '0.25rem' }}>{visibleProducts.length}</strong>
              </div>
              <div style={{ padding: '1rem', background: lowStockProducts.length > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '8px' }}>
                <span style={{ color: lowStockProducts.length > 0 ? '#ef4444' : '#16a34a' }}>Alertes stock bas</span>
                <strong style={{ fontSize: '1.5rem', display: 'block', marginTop: '0.25rem', color: lowStockProducts.length > 0 ? '#ef4444' : '#16a34a' }}>{lowStockProducts.length}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportsTab === 'paiements' && (
        <div className="panel" style={{ maxWidth: '600px' }}>
          <div className="panel-title compact"><div><p>Flux Financier</p><h2>Répartition des paiements</h2></div></div>
          <div className="cart-table" style={{ marginTop: '1rem' }}>
            <div className="cart-head" style={{ gridTemplateColumns: '1fr auto' }}><span>Méthode</span><span>Montant Encaissé</span></div>
            {(Object.entries(salesByMethod) as [PaymentMethod, number][]).map(([method, total]) => (
              <div className="cart-row" key={method} style={{ gridTemplateColumns: '1fr auto' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  {method === 'CASH' && <Banknote size={16} color="#10b981" />}
                  {method === 'CARD' && <CreditCard size={16} color="#3b82f6" />}
                  {method === 'CREDIT' && <ClipboardList size={16} color="#f59e0b" />}
                  {method === 'MULTI' && <ReceiptText size={16} color="#8b5cf6" />}
                  {methodLabel[method]}
                </span>
                <strong style={{ color: '#0f172a' }}>{formatMoney(total)}</strong>
              </div>
            ))}
            {Object.keys(salesByMethod).length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun encaissement</span>}
          </div>
        </div>
      )}

      {reportsTab === 'comptabilite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
            {['trial', 'ledger', 'pnl', 'tax'].map(tab => (
              <button
                key={tab}
                onClick={() => setAccountingSubTab(tab as any)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: accountingSubTab === tab ? '#0f172a' : 'transparent', color: accountingSubTab === tab ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                {tab === 'trial' ? 'Balance de Vérification' : tab === 'ledger' ? 'Grand Livre' : tab === 'pnl' ? 'Compte de Résultat (P&L)' : 'Rapport TVA'}
              </button>
            ))}
          </div>

          {accountingSubTab !== 'trial' && (
            <div style={{ display: 'flex', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>Période :</div>
              <input type="date" value={accStartDate} onChange={e => setAccStartDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
              <span style={{ color: '#64748b' }}>au</span>
              <input type="date" value={accEndDate} onChange={e => setAccEndDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
              
              {accountingSubTab === 'ledger' && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#334155' }}>Compte :</div>
                  <select value={selectedAccountId} onChange={e => setSelectedAccountId(Number(e.target.value) || '')} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <option value="">Sélectionnez un compte...</option>
                    {trialBalanceData.map(acc => <option key={acc.id} value={acc.id}>{acc.name} {acc.accountNumber ? `(${acc.accountNumber})` : ''}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {accountingSubTab === 'trial' && (
            <div className="panel" style={{ maxWidth: '1000px' }}>
              <div className="panel-title compact">
                <div><p>Balance Général</p><h2>Balance de Vérification (Comptabilité)</h2></div>
              </div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                  <span>Compte</span>
                  <span>Débit</span>
                  <span>Crédit</span>
                  <span>Solde Net</span>
                  <span>Type</span>
                </div>
                {trialBalanceData.map(acc => (
                  <div className="cart-row" key={acc.id} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                    <span style={{ fontWeight: 600 }}>{acc.name} {acc.accountNumber ? `(${acc.accountNumber})` : ''}</span>
                    <span style={{ color: '#0284c7' }}>{formatMoney(acc.totalDebit)}</span>
                    <span style={{ color: '#e11d48' }}>{formatMoney(acc.totalCredit)}</span>
                    <strong style={{ color: acc.netBalance >= 0 ? '#16a34a' : '#dc2626' }}>{formatMoney(acc.netBalance)}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{acc.accountType}</span>
                  </div>
                ))}
                {trialBalanceData.length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun compte comptable</span>}
              </div>
              {trialBalanceSummary && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '2rem', fontWeight: 600 }}>
                  <div>Total Débit: <span style={{ color: '#0284c7' }}>{formatMoney(trialBalanceSummary.totalDebit)}</span></div>
                  <div>Total Crédit: <span style={{ color: '#e11d48' }}>{formatMoney(trialBalanceSummary.totalCredit)}</span></div>
                </div>
              )}
            </div>
          )}

          {accountingSubTab === 'ledger' && ledgerData && (
            <div className="panel" style={{ maxWidth: '1000px' }}>
              <div className="panel-title compact">
                <div><p>Grand Livre</p><h2>Compte: {ledgerData.account.name}</h2></div>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '2rem', fontWeight: 600 }}>
                <div>Solde d'ouverture: <span style={{ color: ledgerData.openingBalance >= 0 ? '#16a34a' : '#dc2626' }}>{formatMoney(ledgerData.openingBalance)}</span></div>
                <div>Solde de clôture (Période): <span style={{ color: ledgerData.currentBalance >= 0 ? '#16a34a' : '#dc2626' }}>{formatMoney(ledgerData.currentBalance)}</span></div>
              </div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-head" style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                  <span>Date</span>
                  <span>Référence / Note</span>
                  <span>Débit</span>
                  <span>Crédit</span>
                </div>
                {ledgerData.transactions.map((tx: any) => (
                  <div className="cart-row" key={tx.id} style={{ gridTemplateColumns: '1fr 2fr 1fr 1fr' }}>
                    <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                    <span>{tx.reference || '-'} {tx.note ? `(${tx.note})` : ''}</span>
                    <span style={{ color: '#0284c7' }}>{tx.type === 'DEBIT' ? formatMoney(tx.amount) : '-'}</span>
                    <span style={{ color: '#e11d48' }}>{tx.type === 'CREDIT' ? formatMoney(tx.amount) : '-'}</span>
                  </div>
                ))}
                {ledgerData.transactions.length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucune transaction sur cette période</span>}
              </div>
            </div>
          )}

          {accountingSubTab === 'pnl' && pnlData && (
            <div className="panel" style={{ maxWidth: '1000px' }}>
              <div className="panel-title compact">
                <div><p>Compte de Résultat</p><h2>P&L (Profits & Pertes)</h2></div>
              </div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr', fontWeight: 600 }}>
                  <span>Chiffre d'Affaires Net</span>
                  <span style={{ color: '#0f172a', textAlign: 'right' }}>{formatMoney(pnlData.totalSales)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span>Coût des Marchandises Vendues (COGS)</span>
                  <span style={{ color: '#e11d48', textAlign: 'right' }}>- {formatMoney(pnlData.costOfGoodsSold)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr', fontWeight: 700, background: '#f8fafc' }}>
                  <span>Marge Brute</span>
                  <span style={{ color: pnlData.grossProfit >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>{formatMoney(pnlData.grossProfit)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span>Total des Dépenses (Charges)</span>
                  <span style={{ color: '#e11d48', textAlign: 'right' }}>- {formatMoney(pnlData.totalExpenses)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr', fontWeight: 800, background: '#f1f5f9', fontSize: '1.1rem' }}>
                  <span>Bénéfice Net</span>
                  <span style={{ color: pnlData.netProfit >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>{formatMoney(pnlData.netProfit)}</span>
                </div>
              </div>
            </div>
          )}

          {accountingSubTab === 'tax' && taxData && (
            <div className="panel" style={{ maxWidth: '1000px' }}>
              <div className="panel-title compact">
                <div><p>Déclaration de TVA</p><h2>Rapport TVA</h2></div>
              </div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span>TVA Collectée (Sur Ventes)</span>
                  <span style={{ color: '#0284c7', textAlign: 'right', fontWeight: 600 }}>{formatMoney(taxData.tvaCollected)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span>TVA Déductible (Sur Achats/Dépenses)</span>
                  <span style={{ color: '#16a34a', textAlign: 'right', fontWeight: 600 }}>- {formatMoney(taxData.tvaDeductible)}</span>
                </div>
                <div className="cart-row" style={{ gridTemplateColumns: '1fr 1fr', fontWeight: 800, background: '#f8fafc', fontSize: '1.1rem' }}>
                  <span>TVA Nette à Payer</span>
                  <span style={{ color: taxData.netTvaPayable >= 0 ? '#dc2626' : '#16a34a', textAlign: 'right' }}>{formatMoney(taxData.netTvaPayable)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {reportsTab === 'commissions' && (
        <div className="panel" style={{ maxWidth: '1000px' }}>
          <div className="panel-title compact">
            <div><p>Commissions Vendeurs</p><h2>Rapport de Commission des Agents</h2></div>
          </div>
          <div className="cart-table" style={{ marginTop: '1rem' }}>
            <div className="cart-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
              <span>Agent</span>
              <span>Taux (%)</span>
              <span>Ventes</span>
              <span>Total Ventes</span>
              <span>Commission Due</span>
            </div>
            {commissionReportData.map(agent => (
              <div className="cart-row" key={agent.agentId} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                <span style={{ fontWeight: 600 }}>{agent.agentName}</span>
                <span>{agent.commissionRate}%</span>
                <span>{agent.salesCount} ticket(s)</span>
                <span>{formatMoney(agent.totalSalesAmount)}</span>
                <strong style={{ color: '#16a34a' }}>{formatMoney(agent.commissionEarned)}</strong>
              </div>
            ))}
            {commissionReportData.length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun agent enregistre</span>}
          </div>
        </div>
      )}
    </section>
  );
};
