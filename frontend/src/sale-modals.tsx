import React, { useState } from 'react';
import { XCircle, RotateCcw, Loader2 } from 'lucide-react';
import type { SaleRecord } from './main';

// Partial-return UI for POST /sales/:id/return, an endpoint that has existed
// and worked server-side since Track A (2026-08-12) but no frontend ever
// called - handleReturnSale in main.tsx was previously a pure local-state
// mutation with zero API call. Works directly off the sale prop's own
// `lines` (id/quantity/returnedQty), no separate detail fetch needed.
export const SaleReturnModal = ({ sale, apiFetch, formatMoney, onClose, onReturned }: {
  sale: SaleRecord;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  formatMoney: (v: number) => string;
  onClose: () => void;
  onReturned: (updatedSale: SaleRecord) => void;
}) => {
  const returnableLines = (sale.lines || []).filter(line => line.quantity - (line.returnedQty || 0) > 0);
  const [qty, setQty] = useState<Record<number, string>>(
    Object.fromEntries(returnableLines.map(line => [line.id!, '0']))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const items = returnableLines
      .map(line => ({ saleItemId: line.id!, quantity: Number(qty[line.id!] || 0) }))
      .filter(entry => entry.quantity > 0);
    if (items.length === 0) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch(`/api/sales/${sale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Le retour a echoue.');
      }
      const updated = await res.json();
      onReturned(updated);
    } catch (err: any) {
      setError(err.message || 'Le retour a echoue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="receipt-backdrop print-hide" role="dialog" aria-modal="true" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="receipt-panel" style={{ width: '600px', maxWidth: '95vw', padding: '0', background: '#fff', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Retour - {sale.ticket}</h2>
          <button onClick={onClose} className="ghost-action" style={{ padding: '8px' }}><XCircle size={20} /></button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && <p style={{ color: '#ef4444', marginBottom: '12px' }}>{error}</p>}
          {returnableLines.length === 0 ? (
            <p style={{ color: '#64748b' }}>Rien a retourner sur ce ticket.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Produit</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Vendu</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Deja retourne</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>A retourner</th>
                </tr>
              </thead>
              <tbody>
                {returnableLines.map(line => {
                  const remaining = line.quantity - (line.returnedQty || 0);
                  return (
                    <tr key={line.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>{line.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{line.quantity}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{line.returnedQty || 0}</td>
                      <td style={{ padding: '8px', width: '100px' }}>
                        <input type="number" min="0" max={remaining} step="any"
                          value={qty[line.id!] ?? '0'}
                          onChange={e => setQty(prev => ({ ...prev, [line.id!]: e.target.value }))}
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {returnableLines.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <button type="button" onClick={onClose} className="ghost-action" disabled={submitting}>Annuler</button>
            <button type="button" onClick={submit} className="secondary-action" disabled={submitting} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              {submitting ? <Loader2 size={16} className="spin" style={{ marginRight: '6px' }} /> : <RotateCcw size={16} style={{ marginRight: '6px' }} />}
              Confirmer le retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
