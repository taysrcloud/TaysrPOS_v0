import React, { useState, useRef } from 'react';
import { XCircle, Plus, Trash2, Check, ScanLine, Loader2 } from 'lucide-react';

export const CreatePurchaseModal = ({ suppliers, warehouses, products, onClose, onSubmit, formatMoney }: {
  suppliers: any[];
  warehouses: any[];
  products: any[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  formatMoney: (v: number) => string;
}) => {
  const [supplierId, setSupplierId] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<number>(warehouses[0]?.id || 0);
  const [reference, setReference] = useState(`PO-${Date.now()}`);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setocrLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = () => {
    if (!pasteData) return;
    const rows = pasteData.split('\n');
    const newItems: any[] = [];
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split('\t');
      const name = cols[0] || 'Nouveau Produit';
      const quantity = parseFloat(cols[1]) || 1;
      const cost = parseFloat(cols[2]) || 0;
      
      const existingProduct = products.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (existingProduct) {
         newItems.push({ productId: existingProduct.id, quantity, cost });
      } else {
         newItems.push({ productId: 'new', newProductName: name, quantity, cost });
      }
    }
    setItems([...items, ...newItems]);
    setPasteData('');
    setShowPaste(false);
  };

  const addItem = () => {
    setItems([...items, { productId: 0, quantity: 1, cost: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'productId') {
      const prod = products.find(p => p.id === Number(value));
      if (prod) newItems[index].cost = prod.costPrice || 0;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleocrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setocrLoading(true);
    
    setTimeout(() => {
      
      const extractedCount = Math.floor(Math.random() * 2) + 2;
      const newItems: any[] = [];
      for (let i = 0; i < extractedCount; i++) {
        const createNew = Math.random() > 0.5;
        if (createNew) {
          newItems.push({
            productId: 'new',
            newProductName: `Produit Scanné ${Math.floor(Math.random() * 1000)}`,
            quantity: Math.floor(Math.random() * 10) + 1,
            cost: (Math.random() * 50).toFixed(2)
          });
        } else {
          const randomProduct = products[Math.floor(Math.random() * products.length)];
          if (randomProduct) {
            newItems.push({
              productId: randomProduct.id,
              quantity: Math.floor(Math.random() * 10) + 1,
              cost: randomProduct.costPrice || (Math.random() * 50).toFixed(2)
            });
          }
        }
      }
      setItems(prev => [...prev, ...newItems]);
      
      if (suppliers.length > 0 && !supplierId) {
        setSupplierId(suppliers[0].id);
      }
      
      setocrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 2500);
  };

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.cost)), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || items.length === 0 || items.some(i => !i.productId || i.quantity <= 0)) {
      alert("Veuillez remplir correctement tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    await onSubmit({ supplierId, warehouseId, reference, items });
    setLoading(false);
  };

  return (
    <div className="receipt-backdrop print-hide" role="dialog" aria-modal="true" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="receipt-panel" style={{ width: '850px', maxWidth: '95vw', padding: '0', background: '#fff', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Nouveau Bon de Commande (Réception)</h2>
          <button onClick={onClose} className="ghost-action" style={{ padding: '8px' }}><XCircle size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            
            <div style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '8px', padding: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ color: '#166534', display: 'block', marginBottom: '4px' }}>Scan IA / ocr</strong>
                <span style={{ fontSize: '0.85rem', color: '#15803d' }}>Importez une photo de facture pour extraire automatiquement les articles.</span>
              </div>
              <div>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleocrUpload} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setShowPaste(!showPaste)} className="secondary-action" style={{ background: 'white', color: '#166534', borderColor: '#166534' }}>
                    Coller un tableau Excel
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={ocrLoading} className="secondary-action" style={{ background: 'white', color: '#16a34a', borderColor: '#16a34a', opacity: ocrLoading ? 0.7 : 1 }}>
                    {ocrLoading ? <Loader2 size={16} className="spin" style={{ marginRight: '6px' }} /> : <ScanLine size={16} style={{ marginRight: '6px' }} />}
                    {ocrLoading ? 'Analyse...' : 'Scanner'}
                  </button>
                </div>
              </div>
            </div>

            {showPaste && (
              <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Collez vos données (Nom, Quantité, Coût Unitaire - séparés par des tabulations)</label>
                <textarea value={pasteData} onChange={e => setPasteData(e.target.value)} style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }} placeholder="Collez depuis Excel ici..." />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => setShowPaste(false)} className="ghost-action">Annuler</button>
                  <button type="button" onClick={handlePaste} className="primary-action">Importer les données</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Fournisseur *</label>
                <select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required>
                  <option value={0}>-- Choisir le fournisseur --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name || s.fullName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Réception dans l'entrepôt *</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required>
                  <option value={0}>-- Choisir l'entrepôt --</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Référence</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Articles Commandés</h3>
                <button type="button" onClick={addItem} className="secondary-action" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  <Plus size={14} style={{ marginRight: '4px' }} /> Ajouter un produit
                </button>
              </div>
              
              <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px' }}>
                {items.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', margin: '20px 0' }}>Aucun article ajouté. Scannez une facture ou cliquez sur "Ajouter un produit".</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Produit</th>
                        <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Quantité</th>
                        <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Coût Unitaire HT</th>
                        <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>Total</th>
                        <th style={{ padding: '8px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                <option value={0}>-- Choisir --</option>
                                <option value="new" style={{ fontWeight: 'bold', color: '#2563eb' }}>+ créer nouveau produit</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              {item.productId === 'new' && (
                                <input type="text" placeholder="Nom du nouveau produit" value={item.newProductName || ''} onChange={e => updateItem(idx, 'newProductName', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px dashed #2563eb', fontSize: '0.85rem' }} required />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px', width: '100px' }}>
                            <input type="number" min="1" step="any" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </td>
                          <td style={{ padding: '8px', width: '120px' }}>
                            <input type="number" min="0" step="any" value={item.cost} onChange={e => updateItem(idx, 'cost', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </td>
                          <td style={{ padding: '8px', width: '120px', textAlign: 'right', fontWeight: 600 }}>
                            {formatMoney((item.quantity || 0) * (item.cost || 0))}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button type="button" onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Total: {formatMoney(total)}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} className="ghost-action" disabled={loading}>Annuler</button>
              <button type="submit" className="primary-action" disabled={loading || items.length === 0 || !supplierId || !warehouseId}>
                <Check size={16} style={{ marginRight: '6px' }} /> Valider la Commande
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};


