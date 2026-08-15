import React, { useState } from 'react';
import { XCircle, Check } from 'lucide-react';

export const TransferStockModal = ({ warehouses, products, onClose, onTransfer }: {
  warehouses: any[];
  products: any[];
  onClose: () => void;
  onTransfer: (data: any) => Promise<void>;
}) => {
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(warehouses[0]?.id || 0);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<number>(warehouses[1]?.id || 0);
  const [productId, setProductId] = useState<number>(products[0]?.id || 0);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceWarehouseId === destinationWarehouseId) {
      alert("L'emplacement source et destination doivent être différents.");
      return;
    }
    if (!quantity || Number(quantity) <= 0) return;

    setLoading(true);
    await onTransfer({ sourceWarehouseId, destinationWarehouseId, productId, quantity: Number(quantity), notes });
    setLoading(false);
  };

  return (
    <div className="receipt-backdrop print-hide" role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
      <div className="receipt-panel" style={{ width: '500px', padding: '0', background: '#fff' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Transférer du Stock</h2>
          <button onClick={onClose} className="ghost-action" style={{ padding: '8px' }}><XCircle size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>De l'emplacement</label>
              <select value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Vers l'emplacement</label>
              <select value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <option value={0}>-- Choisir --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Produit</label>
            <select value={productId} onChange={(e) => setProductId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value={0}>-- Choisir le produit --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock actuel: {p.stock || 0})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Quantité à transférer</label>
            <input type="number" step="1" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Notes (Optionnel)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Raison du transfert..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="ghost-action" disabled={loading}>Annuler</button>
            <button type="submit" className="primary-action" disabled={loading || !sourceWarehouseId || !destinationWarehouseId || !productId || !quantity}>
              <Check size={16} style={{ marginRight: '6px' }} /> Confirmer le Transfert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
