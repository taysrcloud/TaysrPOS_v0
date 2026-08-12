import { Lock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { formatMoney } from '../main';
import { usePos } from '../context/PosContext';

export const RegistersPage = () => {
  const { registerLogs, currentLocationId } = usePos();
  const localLogs = registerLogs.filter(log => !log.locationId || log.locationId === currentLocationId);
  return (
    <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader
          icon={Lock}
          title="Historique des Caisses"
          subtitle="Suivi des ouvertures et clôtures de caisse"
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1.5rem 1.5rem' }}>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{localLogs.length}</span>
            <span className="toolbar-stat-label">Sessions</span>
          </div>
        </div>
      </div>
      <div className="data-table">
        <div className="data-head" style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr' }}>
          <span>ID</span><span>Ouverture</span><span>Clôture</span><span>Caissier</span><span>Attendu</span><span>Déclaré</span><span>Écart</span>
        </div>
        {localLogs.map(log => (
          <div className="data-row" style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr' }} key={log.id}>
            <span>#{log.id}</span>
            <span>{log.openedAt}</span>
            <span>{log.closedAt}</span>
            <span>{log.cashierName}</span>
            <span>{formatMoney(log.expectedCash)}</span>
            <span>{formatMoney(log.actualCash)}</span>
            <span className={log.difference === 0 ? 'badge ok' : log.difference > 0 ? 'badge ok' : 'badge warn'}>
              {formatMoney(log.difference)}
            </span>
          </div>
        ))}
        {localLogs.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun historique disponible.</div>
        )}
      </div>
    </section>
  );
};
