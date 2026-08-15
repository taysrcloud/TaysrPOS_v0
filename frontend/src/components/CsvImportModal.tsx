import React, { useState } from 'react';
import { XCircle, UploadCloud } from 'lucide-react';
import { apiFetch } from '../main';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
  mode: 'products' | 'stock';
};

export function CsvImportModal({ onClose, onSuccess, mode }: Props) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError('');
    const rows = csvText.trim().split('\n').map(row => row.split(',').map(cell => cell.trim()));
    if (rows.length < 2) {
      setError('CSV must contain a header row and at least one data row.');
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase());
    const dataRows = rows.slice(1);
    
    setLoading(true);
    try {
      if (mode === 'products') {
        // expect: name, sku, price, cost, barcode, categoryName, brandName
        const products = dataRows.map(row => {
          const item: any = {};
          headers.forEach((h, i) => {
            if (h === 'name') item.name = row[i];
            if (h === 'sku') item.sku = row[i];
            if (h === 'price') item.price = Number(row[i]);
            if (h === 'cost') item.cost = Number(row[i]);
            if (h === 'barcode') item.barcode = row[i];
            if (h === 'category' || h === 'categoryname') item.categoryName = row[i];
            if (h === 'brand' || h === 'brandname') item.brandName = row[i];
          });
          return item;
        });

        const res = await apiFetch('/api/imports/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products })
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        // expect: sku, quantity, locationId
        const stockItems = dataRows.map(row => {
          const item: any = {};
          headers.forEach((h, i) => {
            if (h === 'sku') item.sku = row[i];
            if (h === 'quantity') item.quantity = Number(row[i]);
            if (h === 'locationid') item.locationId = Number(row[i]);
          });
          return item;
        });

        const res = await apiFetch('/api/imports/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stockItems })
        });
        if (!res.ok) throw new Error(await res.text());
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '12px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Importer {mode === 'products' ? 'Produits' : 'Stock'} (CSV)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={24} color="#64748b" /></button>
        </div>
        <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
          {mode === 'products' ? 
            'Format attendu: name, sku, price, cost, barcode, categoryName, brandName' : 
            'Format attendu: sku, quantity, locationId'
          }
        </div>
        {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
        <textarea
          style={{ width: '100%', height: '200px', padding: '0.5rem', fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #ccc' }}
          placeholder="Coller le contenu CSV ici avec les en-têtes..."
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            className="primary-action" 
            onClick={handleImport}
            disabled={loading || !csvText.trim()}
          >
            <UploadCloud size={16} style={{ marginRight: '0.5rem' }} /> {loading ? 'Importation...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
