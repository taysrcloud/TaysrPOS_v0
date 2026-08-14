import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { apiFetch } from '../main';

interface BarcodePrintModalProps {
  products: Array<{ id: number; name: string; barcode?: string | null; sku: string }>;
  onClose: () => void;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({ products, onClose }) => {
  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    products.forEach(p => { init[p.id] = 1; });
    return init;
  });

  const handlePrint = async () => {
    const ids = products.map(p => p.id).join(',');
    const q = products.map(p => quantities[p.id] || 1).join(',');
    const url = `/api/products/barcodes/print?ids=${ids}&quantities=${q}`;

    try {
      const res = await apiFetch(url);
      if (!res.ok) {
        alert("Erreur lors de la génération des étiquettes");
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      alert("Erreur lors de la génération des étiquettes");
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content" style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Imprimer les Étiquettes Codes-barres</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
          {products.map(product => (
            <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <strong style={{ display: 'block', color: '#1e293b' }}>{product.name}</strong>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{product.barcode || product.sku}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#475569' }}>Quantité:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantities[product.id] || 1}
                  onChange={e => setQuantities({ ...quantities, [product.id]: Math.max(1, Number(e.target.value) || 1) })}
                  style={{ width: '60px', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} className="ghost-action" style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Annuler</button>
          <button onClick={handlePrint} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={18} /> Générer les Étiquettes
          </button>
        </div>
      </div>
    </div>
  );
};
