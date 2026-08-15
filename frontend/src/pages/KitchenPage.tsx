import { Utensils, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { usePos } from '../context/PosContext';

export const KitchenPage = () => {
  const { draftSales, sales, currentLocationId, products, kitchenFilter, setKitchenFilter, markKitchenReady } = usePos();

  const kitchenSales = [...draftSales, ...sales].filter(s =>
    (!s.locationId || s.locationId === currentLocationId) &&
    (s.status === 'Suspendue' || s.status === 'Payee') &&
    s.kitchenStatus !== 'READY' &&
    s.lines?.some(l => products.find(p => p.id === l.productId)?.isKitchenItem)
  ).sort((a, b) => b.id - a.id); // Newest first

  let filteredKitchenSales = kitchenSales;
  if (kitchenFilter === 'drinks') {
    filteredKitchenSales = kitchenSales.map(sale => ({
      ...sale,
      lines: sale.lines?.filter(l => {
        const p = products.find(prod => prod.id === l.productId);
        return p?.isKitchenItem && p.category === 'Boissons';
      })
    })).filter(sale => sale.lines && sale.lines.length > 0);
  } else if (kitchenFilter === 'food') {
    filteredKitchenSales = kitchenSales.map(sale => ({
      ...sale,
      lines: sale.lines?.filter(l => {
        const p = products.find(prod => prod.id === l.productId);
        return p?.isKitchenItem && p.category !== 'Boissons';
      })
    })).filter(sale => sale.lines && sale.lines.length > 0);
  }

  const readyCount = [...draftSales, ...sales].filter(s => s.kitchenStatus === 'READY').length;

  return (
    <section style={{ padding: '1.5rem', background: '#e2e8f0', minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
      {/* Left Side: Orders Grid */}
      <div className="panel wide-panel" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-title compact" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem', padding: '1.5rem 1.5rem 0' }}>
          <div>
            <p style={{ color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>KDS - Kitchen Display System</p>
            <h2 style={{ color: '#f8fafc', fontSize: '1.75rem' }}>Bons de préparation</h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ background: '#1e293b', padding: '0.5rem 1rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
              {filteredKitchenSales.length} {filteredKitchenSales.length > 1 ? 'Commandes affichées' : 'Commande affichée'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '0 1.5rem 1.5rem', overflowY: 'auto' }}>
          {filteredKitchenSales.length === 0 ? (
            <div style={{ width: '100%', padding: '4rem', textAlign: 'center', color: '#64748b' }}>
              <Utensils size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#94a3b8' }}>Aucune commande à préparer</h3>
              <p>En attente de nouveaux tickets ou changez les filtres...</p>
            </div>
          ) : (
            filteredKitchenSales.map((sale, idx) => {
              const isUrgent = idx > 5; // Simulate urgency for older tickets
              const ticketItems = (sale.lines || []).filter(l => products.find(p => p.id === l.productId)?.isKitchenItem);

              return (
                <div key={sale.id} style={{
                  flex: '1 1 300px',
                  maxWidth: '400px',
                  background: isUrgent ? '#450a0a' : '#1e293b',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `6px solid ${isUrgent ? '#ef4444' : '#3b82f6'}`,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ padding: '1.25rem', borderBottom: `1px dashed ${isUrgent ? '#7f1d1d' : '#334155'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.5rem', color: '#fff', letterSpacing: '0.05em' }}>{sale.ticket}</strong>
                      <span style={{ background: isUrgent ? '#ef4444' : '#3b82f6', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                        {sale.status === 'Payee' ? 'PAYÉ' : 'EN COURS'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: isUrgent ? '#fca5a5' : '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> {sale.createdAt}</span>
                      <span style={{ color: '#fbbf24', fontSize: '0.95rem', fontWeight: 600 }}>{sale.referenceNote || 'Table / Comptoir'}</span>
                    </div>
                  </div>

                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {ticketItems.map(line => (
                      <div key={line.productId} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        background: isUrgent ? '#7f1d1d' : '#0f172a',
                        padding: '0.75rem',
                        borderRadius: '8px'
                      }}>
                        <strong style={{
                          background: '#fff',
                          color: '#0f172a',
                          minWidth: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          fontSize: '1rem'
                        }}>{line.quantity}</strong>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.2 }}>{line.name}</div>
                          {line.note && <em style={{ color: '#fcd34d', fontSize: '0.9rem', display: 'block', marginTop: '0.25rem', fontWeight: 500 }}>âeeï{line.note}</em>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '1.25rem', borderTop: `1px solid ${isUrgent ? '#7f1d1d' : '#334155'}` }}>
                    <button className="primary-action" onClick={() => markKitchenReady(sale.id)} style={{
                      width: '100%',
                      padding: '1rem',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer'
                    }}>
                      <CheckCircle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/>
                      Marquer Prêt
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Side: Supervision Cuisine */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="dashboard-sidebar-block" style={{ padding: '1.5rem', background: '#0f172a', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#e2e8f0', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>Service en cours</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', background: '#1e293b', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{kitchenSales.length}</span><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>En attente</span></div>
            <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{readyCount}</span><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Terminées</span></div>
          </div>

          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtres de Catégories</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
            <button onClick={() => setKitchenFilter('all')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'all' ? '#3b82f6' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Tout afficher</span></button>
            <button onClick={() => setKitchenFilter('food')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'food' ? '#f59e0b' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Plats uniquement</span></button>
            <button onClick={() => setKitchenFilter('drinks')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'drinks' ? '#0ea5e9' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Boissons uniquement</span></button>
          </div>

          {kitchenSales.length > 5 && (
            <div style={{ background: '#450a0a', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 700, marginBottom: '0.5rem' }}><AlertTriangle size={18} /> Alertes</div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#fecaca' }}>{kitchenSales.length - 5} commandes en attente depuis longtemps !</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
