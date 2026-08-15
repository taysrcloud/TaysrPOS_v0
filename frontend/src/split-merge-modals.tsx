import React, { useState } from 'react';

export const SplitSaleModal = ({ sale, formatMoney, onClose, onSplit }: { sale: any, formatMoney: (n: number) => string, onClose: () => void, onSplit: (selectedItems: any[]) => void }) => {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  return (
    <div className="receipt-backdrop" style={{ zIndex: 9999 }}>
      <section className="panel" style={{ width: '500px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Séparer l'addition ({sale.ticket})</h2>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>Sélectionnez les articles à déplacer vers un nouveau ticket :</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
          {sale.lines?.map((line: any, idx: number) => {
            const isSelected = selectedItems.includes(line);
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '8px', cursor: 'pointer', background: isSelected ? '#eff6ff' : '#fff' }} onClick={() => {
                if (isSelected) setSelectedItems(selectedItems.filter(i => i !== line));
                else setSelectedItems([...selectedItems, line]);
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="checkbox" checked={isSelected} readOnly />
                  <span>{line.quantity}x {line.name || line.product?.name}</span>
                </div>
                <strong>{formatMoney(line.unitPrice * line.quantity)}</strong>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="ghost-action" onClick={onClose}>Annuler</button>
          <button className="primary-action" disabled={selectedItems.length === 0} onClick={() => onSplit(selectedItems)}>
            Créer un nouveau ticket
          </button>
        </div>
      </section>
    </div>
  );
};

export const MergeTableModal = ({ tableData, availableTables, formatMoney, onClose, onMerge }: { tableData: any, availableTables: any[], formatMoney: (n: number) => string, onClose: () => void, onMerge: (sourceSaleId: number) => void }) => {
  return (
    <div className="receipt-backdrop" style={{ zIndex: 9999 }}>
      <section className="panel" style={{ width: '400px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Fusionner vers {tableData.tNum}</h2>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>Sélectionnez la table à importer :</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
          {availableTables.filter(t => t.isOccupied && t.tId !== tableData.tId).map(t => (
            <div key={t.tId} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => onMerge(t.sale.id)}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{t.tNum}</strong>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t.sale.lines?.length || 0} articles</span>
              </div>
              <strong style={{ color: '#3b82f6' }}>{formatMoney(t.sale.total)}</strong>
            </div>
          ))}
          {availableTables.filter(t => t.isOccupied && t.tId !== tableData.tId).length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>Aucune autre table occupée.</p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="ghost-action" onClick={onClose}>Annuler</button>
        </div>
      </section>
    </div>
  );
};
