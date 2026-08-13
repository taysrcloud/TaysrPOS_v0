import { useState } from 'react';
import {
  ArrowLeft, ArrowRightLeft, Banknote, Calculator, ChefHat, Clock, Edit2, FileText,
  ImageIcon, Lock, Mail, Maximize2, Monitor, Package, Pause, Percent, Plus, ReceiptText, RotateCcw,
  Search, ShoppingCart, Store, Trash2, Users, Wallet, XCircle,
} from 'lucide-react';
import { formatMoney } from '../main';
import type { DenominationCounts, PaymentMethod, Product, SaleRecord } from '../main';
import { usePos } from '../context/PosContext';

export const RegisterPage = () => {
  const {
    apiFetch, setStatus, locations, restaurantEnabled, currentLocationId, setCurrentLocationId,
    selectedTable, setSelectedTable, clearCart, setPage, isFullscreen, setIsFullscreen,
    customer, setCustomer, openContactModal, productSearchInputRef, search, setSearch,
    cart, setCart, addToCart, updateCartQty, categories, showRecent, sales, resumeSale,
    setReceiptSale, rolePermissions, currentUser, orderDiscountInputRef, discountRate, setDiscountRate,
    cartSubtotal, cartLineDiscount, cartTax, cartTotal, contacts, setContacts,
    recordDraft, companySettings, loyaltyPointsUsed, setLoyaltyPointsUsed, completeSale,
    registerStatus, setRegisterStatus, registerDetails, setRegisterDetails,
    suspendNote, setSuspendNote, suspendModalOpen, setSuspendModalOpen,
    paymentForm, setPaymentForm, transactionsModalOpen, setTransactionsModalOpen,
    actualCash, setActualCash, expenses, cashMovements, setCashMovements, loadSessions,
    topupContact, setTopupContact, topupAmount, setTopupAmount,
    messageContact, setMessageContact, messageContent, setMessageContent,
    selectedVariableProduct, setSelectedVariableProduct, visibleProducts, getSaleDueAmount,
    setInvoiceSale, openSaleSettlement,
  } = usePos();

  // Register-exclusive state relocated from App - confirmed via a full-file
  // identifier audit (both bare name and setter) that nothing outside
  // renderRegister ever read or wrote these. See TRACE.md's RegisterPage
  // extraction entry for the audit method.
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [openRegisterForm, setOpenRegisterForm] = useState({ initialCash: '' });
  const [zReportModalOpen, setZReportModalOpen] = useState(false);
  const [cashMovementModalOpen, setCashMovementModalOpen] = useState(false);
  const [cashMovementForm, setCashMovementForm] = useState({ type: 'IN' as 'IN' | 'OUT', amount: '', note: '' });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [suspendType, setSuspendType] = useState<SaleRecord['status']>('Brouillon');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editLineForm, setEditLineForm] = useState({ price: '', discount: '', note: '' });
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [denominations, setDenominations] = useState<DenominationCounts>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0 });
  const [showDenominations, setShowDenominations] = useState(false);
  const [transactionsTab, setTransactionsTab] = useState<'Finalisees' | 'Suspendues' | 'Brouillons' | 'Devis'>('Finalisees');

  const transactionTabs = [
    { id: 'Finalisees', label: 'Finalisees', statuses: ['Payee', 'Credit'] as SaleRecord['status'][] },
    { id: 'Suspendues', label: 'Suspendues', statuses: ['Suspendue'] as SaleRecord['status'][] },
    { id: 'Brouillons', label: 'Brouillons', statuses: ['Brouillon'] as SaleRecord['status'][] },
    { id: 'Devis', label: 'Devis', statuses: ['Devis'] as SaleRecord['status'][] },
  ] as const;
  const currentTransactions = sales.filter(sale => {
    const activeTab = transactionTabs.find(tab => tab.id === transactionsTab);
    return activeTab ? activeTab.statuses.includes(sale.status) : false;
  });
  const currentTransactionsTotal = currentTransactions.reduce((sum, sale) => sum + sale.total, 0);
  const currentTransactionsDue = currentTransactions.reduce((sum, sale) => sum + getSaleDueAmount(sale), 0);
  const latestSuspendedSale = sales.find(sale => sale.status === 'Suspendue');

  const registerProducts = visibleProducts.filter((product: Product) => {
    const matchCategory = selectedCategory === 'Tous' || product.category === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [product.name, product.sku, product.barcode || '', product.category].some(value => value.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  const calcPress = (key: string) => {
    if (key === 'C') { setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); return; }
    if (key === 'e') { setCalcDisplay(d => String(-Number(d))); return; }
    if (key === '%') { setCalcDisplay(d => String(Number(d) / 100)); return; }
    if (['+', '-', 'e', 'e'].includes(key)) { setCalcPrev(Number(calcDisplay)); setCalcOp(key); setCalcDisplay('0'); return; }
    if (key === '=') {
      if (calcPrev === null || !calcOp) return;
      const b = Number(calcDisplay);
      let result = 0;
      if (calcOp === '+') result = calcPrev + b;
      else if (calcOp === '-') result = calcPrev - b;
      else if (calcOp === 'e') result = calcPrev * b;
      else if (calcOp === 'e') result = b !== 0 ? calcPrev / b : 0;
      setCalcDisplay(String(parseFloat(result.toFixed(8))));
      setCalcPrev(null); setCalcOp(null);
      return;
    }
    setCalcDisplay(d => d === '0' && key !== '.' ? key : d + key);
  };

  return (
    <section className="pos-workspace">
      {selectedVariableProduct && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSelectedVariableProduct(null); }}>
          <section className="receipt-panel" style={{ maxWidth: '500px', width: '95%' }}>
            <div className="receipt-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Déclinaisons</p><h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{selectedVariableProduct.name}</h2></div><button onClick={() => setSelectedVariableProduct(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={22} /></button></div>
            <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
              <p style={{ color: '#475569', margin: 0, fontSize: '0.95rem' }}>Sélectionnez la variation à ajouter au panier :</p>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {selectedVariableProduct.variations?.map(variation => (
                  <button key={variation.id} type="button" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', textAlign: 'left', width: '100%', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => addToCart(selectedVariableProduct, variation)} onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'} onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 600 }}>{variation.name}</strong>
                      <small style={{ color: '#64748b', fontSize: '0.85rem' }}>En stock: <span style={{ fontWeight: 600, color: variation.stock > 0 ? '#10b981' : '#ef4444' }}>{selectedVariableProduct.trackStock ? variation.stock : 'N/A'}</span></small>
                    </div>
                    <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: '1.1rem', background: '#eff6ff', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>{formatMoney(variation.salePrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {registerStatus === 'CLOSED' ? (
        <section className="pos-workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
          <div className="receipt-panel" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '2rem' }}>
            <div style={{ background: '#e0e7ff', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#4f46e5' }}>
              <Lock size={32} />
            </div>
            <h2>Caisse fermee</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Vous devez ouvrir la caisse pour commencer a encaisser.</p>
            <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <label><span>Fond de caisse initial (MAD)</span><input value={openRegisterForm.initialCash} onChange={e => setOpenRegisterForm({ initialCash: e.target.value })} inputMode="decimal" autoFocus /></label>
              <button className="primary-action" style={{ marginTop: '0.5rem' }} onClick={async () => {
                const amount = Number(openRegisterForm.initialCash || 0);
                try {
                  const response = await apiFetch(`/api/register/open`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initialCash: amount, locationId: currentLocationId }),
                  });
                  if (!response.ok) throw new Error('API unavailable');
                  const session = (await response.json()).session;
                  // openedAtISO comes straight from the server's own session.openedAt
                  // (a real ISO timestamp, not the locale-formatted display string) -
                  // it's the shift-boundary source of truth for the Z-report below,
                  // not just a display value. See TRACE.md's Z-report shift-boundary entry.
                  setRegisterDetails({ openedAt: new Date().toLocaleString('fr-FR'), openedAtISO: session.openedAt, initialCash: amount, openedId: session.id });
                  setRegisterStatus('OPEN');
                  setStatus('Caisse ouverte avec succes');
                } catch {
                  setStatus('Erreur: Impossible d\'ouvrir la caisse');
                }
              }}>Ouvrir la caisse</button>
            </div>
          </div>
        </section>
      ) : (
        <>
      <div className="pos-command-bar">
        <div className="pos-location">
          <strong>Lieu</strong>
          <select value={currentLocationId} onChange={e => setCurrentLocationId(Number(e.target.value))} style={{ border: 'none', background: 'transparent', fontWeight: 600, color: '#334155', cursor: 'pointer', outline: 'none', padding: 0 }}>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>
        {restaurantEnabled && (
          <div className="pos-location" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
            <strong>Table</strong>
            <select value={selectedTable} onChange={e => setSelectedTable(e.target.value)}>
              <option value="">A emporter</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>Table {n}</option>)}
            </select>
          </div>
        )}
        <div className="pos-clock"><Clock size={13} /> {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="pos-tools" aria-label="Actions POS">
          <button title="Caisse" onClick={() => setZReportModalOpen(true)}><Lock size={15} /></button>
          <button title="Mouvements de Caisse" onClick={() => setCashMovementModalOpen(true)}><ArrowRightLeft size={15} /></button>
          <button title="Retour" onClick={() => setPage('Tableau de bord')}><ArrowLeft size={15} /></button>
          <button title="Retour vente" onClick={() => { setTransactionsTab('Finalisees'); setTransactionsModalOpen(true); }}><RotateCcw size={15} /></button>
          <button title="Tickets suspendus" onClick={() => { setTransactionsTab('Suspendues'); setTransactionsModalOpen(true); }}><Pause size={15} /></button>
          <button title="Details POS" onClick={() => setZReportModalOpen(true)}><Store size={15} /></button>
          <button title="Annuler" onClick={clearCart}><XCircle size={15} /></button>
          <button title="Calculatrice" onClick={() => { setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); setCalcOpen(true); }}><Calculator size={15} /></button>
          <button title="Ecran Client" onClick={() => window.open('?mode=customer', '_blank', 'width=1024,height=768')}><Monitor size={15} /></button>
          <button title={isFullscreen ? 'Quitter plein ecran' : 'Plein ecran'} onClick={() => {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {}); }
            else { document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {}); }
          }}><Maximize2 size={15} /></button>
        </div>
      </div>

      <div className="pos-workflow-strip">
        <div className="wf-chip wf-chip-customer">
          <Users size={13} />
          <strong>{customer.name}</strong>
          {customer.balance > 0 && <small>{formatMoney(customer.balance)}</small>}
          <button className="wf-chip-btn" type="button" onClick={() => openContactModal('CUSTOMER')} title="Nouveau client"><Plus size={12} /></button>
          <button className="wf-chip-btn" type="button" onClick={() => setPage('Clients & Fournisseurs')} title="Portefeuille"><Wallet size={12} /></button>
        </div>
        <button className="wf-chip wf-chip-search" type="button" onClick={() => productSearchInputRef.current?.focus()}>
          <Search size={13} />
          <span>{search ? search : 'Recherche produit'}</span>
        </button>
        <button className="wf-chip" type="button" onClick={() => setPage('Produits')}>
          <Package size={13} />
          <span>Catalogue</span>
        </button>
        <div className="wf-divider" />
        <button className="wf-chip" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Brouillon'); setSuspendModalOpen(true); }}>
          <FileText size={13} />
          <span>Brouillon</span>
        </button>
        <button className="wf-chip" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Devis'); setSuspendModalOpen(true); }}>
          <FileText size={13} />
          <span>Devis</span>
        </button>
        <button className="wf-chip" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Suspendue'); setSuspendModalOpen(true); }}>
          <Pause size={13} />
          <span>Suspendre</span>
        </button>
        <button className="wf-chip" type="button" onClick={() => { setTransactionsTab('Suspendues'); setTransactionsModalOpen(true); }}>
          <Clock size={13} />
          <span>Historique</span>
        </button>
        <div className="wf-divider" />
        {(!currentUser || rolePermissions[currentUser.role]?.includes('ACTION:OVERRIDE_PRICE')) && (
          <button className="wf-chip" type="button" onClick={() => orderDiscountInputRef.current?.focus()}>
            <Percent size={13} />
            <span>Remise</span>
          </button>
        )}
        {cart.length > 0 && (
          <div className="wf-chip wf-chip-count">
            <span>{cart.length} ligne{cart.length > 1 ? 's' : ''}</span>
          </div>
        )}

      </div>

      <div className="pos-grid">
        <aside className="pos-products-panel">
          <div className="pos-search-row" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#fff', borderTopLeftRadius: '16px' }}>
            <label className="product-search"><Search size={16} /><input ref={productSearchInputRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Nom du produit / SKU / Code-barres" autoFocus /><button type="button" onClick={() => setPage('Produits')}><Plus size={14} /></button></label>
          </div>
          <div className="pos-tabs">{categories.map(category => <button key={category} className={selectedCategory === category ? 'selected' : ''} onClick={() => setSelectedCategory(category)}>{category}</button>)}</div>
          <div className="pos-product-grid">
            {registerProducts.map(product => <button className="pos-product-card" key={product.id} onClick={() => addToCart(product)}>
              <span className="pos-product-photo">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageIcon size={24} />}</span>
              <strong>{product.name}</strong><span>{product.category}</span><em>{formatMoney(product.salePrice)}</em><small>{product.trackStock ? `${product.stock} stock` : 'Service'}</small>
            </button>)}
          </div>
          {showRecent && <div className="recent-box"><div className="recent-title"><Clock size={15} /> Transactions recentes</div>{sales.filter(s => !s.locationId || s.locationId === currentLocationId).slice(0, 4).map(sale => <button key={sale.id} onClick={() => {
            if (sale.status === 'Payee' || sale.status === 'Credit') {
              setReceiptSale(sale);
              return;
            }
            resumeSale(sale);
          }}><span>{sale.ticket}</span><strong>{formatMoney(sale.total)}</strong><small>{sale.status}</small></button>)}</div>}
        </aside>

        <div className="pos-sale-panel">
          <div className="cart-customer-bar">
            <Users className="cart-customer-icon" size={16} />
            <select value={customer.id} onChange={e => setCustomer(contacts.find(c => c.id === Number(e.target.value)) || contacts[0])}>
              {contacts.filter(c => ['Client', 'CUSTOMER', 'BOTH'].includes(c.type)).map(c => <option key={c.id} value={c.id}>{c.name}{c.balance > 0 ? ` (${formatMoney(c.balance)})` : ''}</option>)}
            </select>
            <button className="cart-add-customer" onClick={() => openContactModal('CUSTOMER')}><Plus size={14} /></button>
          </div>
          <div className="cart-table">
            <div className="cart-head"><span>Produit</span><span>Qte</span><span>Prix</span><span>Remise</span><span>Total</span><span /></div>
            {cart.length === 0 ? <div className="pos-empty"><ShoppingCart size={34} /><strong>Votre panier est vide</strong><span>Scannez un code-barres ou cliquez sur un produit.</span></div> : cart.map(line => {
              const currentPrice = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
              const lineNet = Math.max(0, (currentPrice - line.discount) * line.quantity);
              return <div className="cart-row" key={line.uniqueId}>
                <span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{line.product.name} {line.variation && <span style={{ color: '#3b82f6' }}>({line.variation.name})</span>}</span>
                    {(!currentUser || rolePermissions[currentUser.role]?.includes('ACTION:OVERRIDE_PRICE')) && <button className="ghost-action" onClick={() => { setEditingLineId(line.uniqueId); setEditLineForm({ price: String(currentPrice), discount: String(line.discount), note: line.note || '' }); }} style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff' }} title="Modifier le prix"><Edit2 size={13} /></button>}
                  </strong>
                  <small>{line.variation ? line.variation.sku : line.product.sku}</small>
                  {line.note && <em style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Note: {line.note}</em>}
                </span>
                <span className="qty-stepper"><button onClick={() => updateCartQty(line.uniqueId, -1)}>-</button><b>{line.quantity}</b><button onClick={() => updateCartQty(line.uniqueId, 1)}>+</button></span>
                <span>{formatMoney(currentPrice)}</span>
                <span style={{ fontSize: '0.9rem', color: line.discount > 0 ? '#ef4444' : 'inherit' }}>{line.discount > 0 ? formatMoney(line.discount) : '-'}</span>
                <span>{formatMoney(lineNet)}</span>
                <button className="icon-danger" onClick={() => updateCartQty(line.uniqueId, -line.quantity)}><Trash2 size={15} /></button>
              </div>;
            })}
          </div>

          <div className="cart-totals">
            <div className="cart-totals-row"><span>Sous-total</span><strong>{formatMoney(cartSubtotal)}</strong></div>
            <div className="cart-totals-row cart-totals-discount"><span>Remise lignes</span><strong>{formatMoney(cartLineDiscount)}</strong></div>
            <div className="cart-totals-row">
              <label className="cart-discount-input"><Percent size={15} /><span>Remise</span><input ref={orderDiscountInputRef} value={discountRate} onChange={event => setDiscountRate(Math.max(0, Math.min(100, Number(event.target.value || 0))))} inputMode="decimal" /></label>
            </div>
            <div className="cart-totals-row"><span>TVA</span><strong>{formatMoney(cartTax)}</strong></div>
            <div className="cart-totals-row cart-totals-grand"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
          </div>
          <div className="pos-footer-actions">
        <button className="danger" onClick={clearCart}><XCircle size={16} /> Annuler</button>
        <button disabled={!cart.length} onClick={() => { setSuspendType('Brouillon'); setSuspendModalOpen(true); }}><FileText size={16} /> Brouillon</button>
        <button disabled={!cart.length} onClick={() => { setSuspendType('Devis'); setSuspendModalOpen(true); }}><FileText size={16} /> Devis</button>
        <button disabled={!cart.length} onClick={() => { setSuspendType('Suspendue'); setSuspendModalOpen(true); }}><Pause size={16} /> Suspendre</button>
        {restaurantEnabled && <button disabled={!cart.length || !cart.some(line => line.product.isKitchenItem)} onClick={() => {
          setSuspendType('Suspendue');
          setSuspendNote(selectedTable ? `Table ${selectedTable} - Cuisine` : 'Commande Cuisine');
          // Automatically save as suspended
          setTimeout(() => {
            const btn = document.getElementById('btn-cuisine-auto-suspend');
            if(btn) btn.click();
          }, 0);
        }} style={{ background: '#f59e0b', color: '#fff', border: 'none' }}><ChefHat size={16} /> Cuisine</button>}
        {restaurantEnabled && <button id="btn-cuisine-auto-suspend" style={{display: 'none'}} onClick={() => recordDraft('Suspendue')}></button>}
        <button disabled={!cart.length} className="pay-btn" onClick={() => {
          setPaymentForm({ cash: String(cartTotal), card: '0', credit: '0', storeCredit: '0' });
          setPaymentModalOpen(true);
        }}>Payer {formatMoney(cartTotal)}</button>
        <button className="recent" onClick={() => setTransactionsModalOpen(true)}><Clock size={16} /> Transactions</button>
      </div>
        </div>
      </div>
      
      {topupContact && (
        <div className="receipt-backdrop" style={{ zIndex: 60 }} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) { setTopupContact(null); setTopupAmount(''); } }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={(e) => { 
              e.preventDefault(); 
              const amount = Number(topupAmount);
              if (amount > 0) {
                const newCredit = (topupContact.storeCredit || 0) + amount;
                setContacts(contacts.map(c => c.id === topupContact.id ? { ...c, storeCredit: newCredit } : c));
                setTopupContact(null);
                setTopupAmount('');
              }
            }} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Client</p><h2>Recharger Crédit Magasin</h2></div><button type="button" onClick={() => { setTopupContact(null); setTopupAmount(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div style={{ marginTop: '1rem', color: '#334155' }}>
                Recharger le compte de <strong>{topupContact.name}</strong>.
                <div style={{ color: '#10b981', fontWeight: 600, marginTop: '0.5rem' }}>Solde actuel: {formatMoney(topupContact.storeCredit || 0)}</div>
              </div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <label><span>Montant à recharger (MAD)</span><input value={topupAmount} onChange={e => setTopupAmount(e.target.value)} inputMode="decimal" autoFocus /></label>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => { setTopupContact(null); setTopupAmount(''); }} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Recharger</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {messageContact && (
        <div className="receipt-backdrop" style={{ zIndex: 60 }} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) { setMessageContact(null); setMessageContent(''); } }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={(e) => { 
              e.preventDefault(); 
              if (messageContent.trim()) {
                alert(`Message envoyé à ${messageContact.name}: \n\n${messageContent}`);
                setMessageContact(null);
                setMessageContent('');
              }
            }} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Communication</p><h2>Envoyer Message</h2></div><button type="button" onClick={() => { setMessageContact(null); setMessageContent(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div style={{ marginTop: '1rem', color: '#334155' }}>
                Envoyer un SMS / Email à <strong>{messageContact.name}</strong>.
              </div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <label><span>Message</span><textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} autoFocus /></label>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => { setMessageContact(null); setMessageContent(''); }} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}><Mail size={16} style={{ marginRight: '8px' }} /> Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setPaymentModalOpen(false); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '700px', margin: 'auto' }}>
            <div className="product-form-panel" style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Paiement</p><h2>Finaliser la vente</h2></div><button type="button" onClick={() => setPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '2rem', marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <label>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'block' }}>Espèces (MAD)</span>
                    <input value={paymentForm.cash} onChange={e => setPaymentForm({...paymentForm, cash: e.target.value})} inputMode="decimal" style={{ fontSize: '1.5rem', padding: '1rem', height: 'auto', fontWeight: 'bold', color: '#16a34a', border: '2px solid #bbf7d0', backgroundColor: '#f0fdf4' }} autoFocus />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {[20, 50, 100, 200].map(amt => (
                      <button key={amt} className="ghost-action" style={{ padding: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }} onClick={() => setPaymentForm({...paymentForm, cash: String((Number(paymentForm.cash) || 0) + amt)})}>+{amt}</button>
                    ))}
                    <button className="ghost-action" style={{ gridColumn: 'span 2', padding: '0.5rem', fontSize: '1rem', fontWeight: 'bold', background: '#e2e8f0', color: '#0f172a' }} onClick={() => setPaymentForm({...paymentForm, cash: String(cartTotal)})}>Montant Exact</button>
                    <button className="ghost-action" style={{ gridColumn: 'span 2', padding: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: '#ef4444' }} onClick={() => setPaymentForm({...paymentForm, cash: '0'})}>Effacer</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'block' }}>Carte Bancaire</span>
                      <input value={paymentForm.card} onChange={e => setPaymentForm({...paymentForm, card: e.target.value})} inputMode="decimal" style={{ fontSize: '1.2rem', padding: '0.75rem', height: 'auto' }} />
                    </label>
                    <label>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'block' }}>Crédit Client</span>
                      <input value={paymentForm.credit} onChange={e => setPaymentForm({...paymentForm, credit: e.target.value})} inputMode="decimal" style={{ fontSize: '1.2rem', padding: '0.75rem', height: 'auto' }} />
                    </label>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #e2e8f0' }}>
                  
                  {companySettings.loyaltyEnabled && customer.name !== 'Client comptoir' && ((customer.rewardPoints || 0) > 0 || loyaltyPointsUsed > 0) && (
                    <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#1e3a8a', display: 'block' }}>Points de Fidélité: {(customer.rewardPoints || 0) - loyaltyPointsUsed}</span>
                          <span style={{ fontSize: '0.85rem', color: '#3b82f6' }}>Valeur max: {formatMoney((customer.rewardPoints || 0) * companySettings.amountPerPoint)}</span>
                        </div>
                        {loyaltyPointsUsed === 0 ? (
                          <button type="button" className="ghost-action" style={{ color: '#2563eb', fontWeight: 'bold', background: '#dbeafe', padding: '0.5rem 1rem' }} onClick={() => {
                            const subAfterDiscount = cartSubtotal * (1 - discountRate/100);
                            const maxPointsForTotal = Math.ceil(subAfterDiscount / companySettings.amountPerPoint);
                            const pointsToUse = Math.min(customer.rewardPoints || 0, maxPointsForTotal);
                            setLoyaltyPointsUsed(pointsToUse);
                          }}>
                            Appliquer
                          </button>
                        ) : (
                          <button type="button" className="ghost-action" style={{ color: '#ef4444', fontWeight: 'bold', background: '#fee2e2', padding: '0.5rem 1rem' }} onClick={() => setLoyaltyPointsUsed(0)}>
                            Annuler (-{formatMoney(loyaltyPointsUsed * companySettings.amountPerPoint)})
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total à payer</span>
                    <strong style={{ display: 'block', fontSize: '2.5rem', color: '#0f172a', fontWeight: 900, lineHeight: 1 }}>{formatMoney(cartTotal)}</strong>
                  </div>
                  
                  {(() => {
                    const cash = Number(paymentForm.cash || 0);
                    const card = Number(paymentForm.card || 0);
                    const credit = Number(paymentForm.credit || 0);
                    const storeCredit = Number(paymentForm.storeCredit || 0);
                    const paid = cash + card + credit + storeCredit;
                    const diff = paid - cartTotal;
                    
                    return (
                      <>
                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '1.5rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '1rem', color: diff >= 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{diff >= 0 ? 'Monnaie à rendre' : 'Reste à payer'}</span>
                          <strong style={{ display: 'block', fontSize: '2.5rem', color: diff >= 0 ? '#16a34a' : '#ef4444', fontWeight: 900, lineHeight: 1, marginTop: '0.5rem' }}>{formatMoney(Math.abs(diff))}</strong>
                        </div>
                        
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {diff < 0 && customer.name !== 'Client comptoir' && (
                            <button className="ghost-action" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', borderRadius: '8px' }} onClick={() => setPaymentForm({...paymentForm, credit: String(Math.abs(diff))})}>
                              Transférer le reste en crédit ({formatMoney(Math.abs(diff))})
                            </button>
                          )}
                          <button className="primary-action" style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem', borderRadius: '12px', justifyContent: 'center' }} disabled={diff < 0 || (credit > 0 && customer.name === 'Client comptoir')} onClick={async () => {
                            const newBalance = customer.balance + credit;
                            if (credit > 0 && customer.creditLimit > 0 && newBalance > customer.creditLimit) {
                              alert(`Plafond de crédit dépassé!\nSolde: ${formatMoney(customer.balance)}\nPlafond: ${formatMoney(customer.creditLimit)}\nLe nouveau solde serait de ${formatMoney(newBalance)}.`);
                              return;
                            }
                            if (credit > 0 && customer.name === 'Client comptoir') {
                              alert("Le Client comptoir ne peut pas avoir de crédit. Veuillez sélectionner un client enregistré.");
                              return;
                            }
                            
                            let method: PaymentMethod = 'CASH';
                            if (card > 0 && cash === 0 && credit === 0 && storeCredit === 0) method = 'CARD';
                            else if (credit > 0 && cash === 0 && card === 0 && storeCredit === 0) method = 'CREDIT';
                            else if (storeCredit > 0 && cash === 0 && card === 0 && credit === 0) method = 'STORE_CREDIT';
                            else if (cash > 0 || card > 0 || credit > 0 || storeCredit > 0) method = 'MULTI';

                            if (credit > 0) {
                              setContacts(contacts.map(c => c.id === customer.id ? { ...c, balance: newBalance } : c));
                              setCustomer({ ...customer, balance: newBalance });
                            }
                            
                            if (storeCredit > 0 && customer.name !== 'Client comptoir') {
                              if (storeCredit > (customer.storeCredit || 0)) {
                                alert("Crédit Magasin insuffisant.");
                                return;
                              }
                              const newStoreCredit = (customer.storeCredit || 0) - storeCredit;
                              setContacts(contacts.map(c => c.id === customer.id ? { ...c, storeCredit: newStoreCredit } : c));
                              setCustomer({ ...customer, storeCredit: newStoreCredit });
                            }
                            
                            setPaymentModalOpen(false);
                            await completeSale(method);
                          }}>
                            {diff < 0 ? 'Paiement incomplet' : 'Valider paiement'}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {suspendModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSuspendModalOpen(false); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={(e) => { e.preventDefault(); recordDraft(suspendType); }} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Enregistrer</p><h2>{suspendType}</h2></div><button type="button" onClick={() => setSuspendModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <label><span>Note de référence (Optionnel)</span><input value={suspendNote} onChange={e => setSuspendNote(e.target.value)} placeholder="Ex: Table 4, Attente..." autoFocus /></label>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setSuspendModalOpen(false)} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingLineId && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setEditingLineId(null); }}>
          <section className="receipt-panel" style={{ maxWidth: '400px' }}>
            <div className="receipt-header"><div><p>Ligne</p><h2>Modifier l'article</h2></div><button onClick={() => setEditingLineId(null)}><XCircle size={18} /></button></div>
            <div className="form-grid" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label><span>Prix Unitaire (MAD)</span><input value={editLineForm.price} onChange={e => setEditLineForm({...editLineForm, price: e.target.value})} inputMode="decimal" autoFocus /></label>
              <label><span>Remise par unité (MAD)</span><input value={editLineForm.discount} onChange={e => setEditLineForm({...editLineForm, discount: e.target.value})} inputMode="decimal" /></label>
              <label><span>Note (Optionnel)</span><input value={editLineForm.note} onChange={e => setEditLineForm({...editLineForm, note: e.target.value})} placeholder="Sans oignon, etc." /></label>
              <button className="primary-action" onClick={() => {
                setCart(current => current.map(line => {
                  if (line.uniqueId === editingLineId) {
                    const basePrice = line.variation ? line.variation.salePrice : line.product.salePrice;
                    const priceNum = Number(editLineForm.price || basePrice);
                    return { ...line, customPrice: priceNum !== basePrice ? priceNum : undefined, discount: Number(editLineForm.discount || 0), note: editLineForm.note || undefined };
                  }
                  return line;
                }));
                setEditingLineId(null);
              }}>Appliquer</button>
            </div>
          </section>
        </div>
      )}

      {/* Cash Movement Modal */}
      {cashMovementModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setCashMovementModalOpen(false); }}>
          <section className="receipt-panel" style={{ maxWidth: '400px' }}>
            <div className="receipt-header"><div><p>Caisse</p><h2>Mouvement de Caisse</h2></div><button onClick={() => setCashMovementModalOpen(false)}><XCircle size={18} /></button></div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label>
                  <span>Type de mouvement</span>
                  <select value={cashMovementForm.type} onChange={e => setCashMovementForm(prev => ({ ...prev, type: e.target.value as 'IN'|'OUT' }))} style={{ fontSize: '1.1rem', padding: '0.75rem' }}>
                    <option value="IN">Entrée (Ex: Ajout de monnaie)</option>
                    <option value="OUT">Sortie (Ex: Retrait vers coffre)</option>
                  </select>
                </label>
                <label>
                  <span>Montant (MAD)</span>
                  <input type="number" placeholder="Montant..." value={cashMovementForm.amount} onChange={e => setCashMovementForm(prev => ({ ...prev, amount: e.target.value }))} style={{ fontSize: '1.1rem', padding: '0.75rem' }} />
                </label>
                <label>
                  <span>Note (Optionnel)</span>
                  <input type="text" placeholder="Raison..." value={cashMovementForm.note} onChange={e => setCashMovementForm(prev => ({ ...prev, note: e.target.value }))} style={{ fontSize: '1.1rem', padding: '0.75rem' }} />
                </label>
              </div>
              <button className="primary-action" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: cashMovementForm.type === 'IN' ? '#10b981' : '#ef4444' }} onClick={async () => {
                const amount = Number(cashMovementForm.amount);
                if (amount > 0) {
                  try {
                    const response = await apiFetch(`/api/register/movements`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: cashMovementForm.type, amount, note: cashMovementForm.note, locationId: currentLocationId, sessionId: registerDetails.openedId })
                    });
                    if (!response.ok) throw new Error();
                    const movement = (await response.json()).movement;
                    setCashMovements(prev => [...prev, {
                      id: movement.id, type: movement.type, amount: Number(movement.amount), note: movement.note || '', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), locationId: movement.locationId
                    }]);
                    setCashMovementModalOpen(false);
                    setCashMovementForm({ type: 'IN', amount: '', note: '' });
                    setStatus(`Mouvement enregistré : ${cashMovementForm.type === 'IN' ? '+' : '-'}${formatMoney(amount)}`);
                  } catch {
                    setStatus('Erreur: Impossible d\'enregistrer le mouvement');
                  }
                }
              }}><ArrowRightLeft size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Enregistrer le mouvement</button>
            </div>
          </section>
        </div>
      )}

      {transactionsModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setTransactionsModalOpen(false); }}>
          <div className="transactions-modal-shell">
            <div className="product-form-panel transactions-panel">
              <div className="panel-title"><div><p>Historique</p><h2>Transactions recentes</h2></div><button type="button" onClick={() => setTransactionsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div className="transactions-summary-grid">
                <div className="transactions-summary-card">
                  <span>Vue active</span>
                  <strong>{transactionsTab}</strong>
                  <small>{currentTransactions.length} ticket(s)</small>
                </div>
                <div className="transactions-summary-card">
                  <span>Montant total</span>
                  <strong>{formatMoney(currentTransactionsTotal)}</strong>
                  <small>{transactionsTab === 'Finalisees' ? 'Total de la selection visible' : 'Valeur a reprendre ou convertir'}</small>
                </div>
                <div className="transactions-summary-card">
                  <span>Reste a regler</span>
                  <strong>{formatMoney(currentTransactionsDue)}</strong>
                  <small>Les tickets credit remontent ici en priorite</small>
                </div>
                <div className="transactions-summary-card transactions-summary-card-highlight">
                  <span>Raccourci caisse</span>
                  <strong>{latestSuspendedSale ? latestSuspendedSale.ticket : 'Aucun suspendu'}</strong>
                  <small>{latestSuspendedSale ? `Client ${latestSuspendedSale.customer}` : 'Le prochain ticket suspendu apparaitra ici'}</small>
                </div>
              </div>
              <div className="transactions-tab-row">
                {transactionTabs.map(tab => {
                  const tabCount = sales.filter(sale => tab.statuses.includes(sale.status)).length;
                  return (
                    <button key={tab.id} className={transactionsTab === tab.id ? 'selected' : ''} onClick={() => setTransactionsTab(tab.id)}>
                      <span>{tab.label}</span>
                      <strong>{tabCount}</strong>
                    </button>
                  );
                })}
                {latestSuspendedSale && (
                  <button className="transactions-quick-resume" onClick={() => resumeSale(latestSuspendedSale)}>
                    <RotateCcw size={15} /> Reprendre le dernier suspendu
                  </button>
                )}
              </div>
              <div className="transactions-table-wrap">
                <div className="cart-table">
                  <div className="cart-head"><span>Ticket</span><span>Client</span><span>Note</span><span>Total</span><span>Reste</span><span>Statut</span><span /></div>
                  {currentTransactions.length ? currentTransactions.map(sale => (
                    <div className="cart-row" key={sale.id}>
                      <span><strong>{sale.ticket}</strong><small>{sale.createdAt}</small></span>
                      <span>{sale.customer}</span>
                      <span>{sale.referenceNote || '-'}</span>
                      <span>{formatMoney(sale.total)}</span>
                      <span>{sale.status === 'Credit' ? formatMoney(getSaleDueAmount(sale)) : '-'}</span>
                      <span style={{ color: sale.status === 'Payee' ? '#10b981' : sale.status === 'Credit' ? '#f59e0b' : '#64748b' }}>{sale.status}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {transactionsTab === 'Finalisees' ? (
                          <>
                            <button className="ghost-action" onClick={() => { setReceiptSale(sale); setTransactionsModalOpen(false); }}><ReceiptText size={15} /> Recu</button>
                            <button className="ghost-action" onClick={() => { setInvoiceSale(sale); setTransactionsModalOpen(false); }}><FileText size={15} /> Facture (A4)</button>
                            {sale.status === 'Credit' && <button className="primary-action" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => { openSaleSettlement(sale); setTransactionsModalOpen(false); }}><Banknote size={15} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> Encaisser</button>}
                          </>
                        ) : (
                          <>
                            <button className="primary-action" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => resumeSale(sale)}><RotateCcw size={15} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> Reprendre</button>
                            <button className="ghost-action" onClick={() => { setInvoiceSale(sale); setTransactionsModalOpen(false); }}><FileText size={15} /> Devis (A4)</button>
                          </>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="transactions-empty-state">
                      <Clock size={22} />
                      <strong>Aucun ticket dans cette vue</strong>
                      <small>Les brouillons, devis et tickets suspendus apparaitront ici pour reprise rapide.</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {zReportModalOpen && (() => {
        // Was `s.id >= registerDetails.openedId` - registerDetails.openedId is a
        // CashRegisterSession id, not a Sale id. Those are two unrelated
        // auto-increment sequences, so that comparison didn't actually bound
        // "sales since this shift opened" at all (verified live: it matched
        // every sale the tenant had ever recorded). Real boundary is a
        // timestamp comparison against the session's own openedAtISO - both
        // sides are real ISO 8601 strings, safe to compare lexicographically.
        // See TRACE.md's Z-report shift-boundary entry.
        const shiftSales = sales.filter(s => s.status === 'Payee' && !!s.createdAtISO && !!registerDetails.openedAtISO && s.createdAtISO >= registerDetails.openedAtISO);
        // A MULTI sale used to contribute 0 here regardless of how much of it
        // was actually cash - the till would look short by exactly the cash
        // portion of every split-payment sale on every closing. Now reads the
        // real per-tender breakdown from the backend (`payments`, added
        // alongside the split-payment persistence fix - see TRACE.md).
        const cashSalesToday = shiftSales.reduce((sum, s) => {
          if (s.method === 'CASH') return sum + s.total;
          if (s.method === 'MULTI') {
            const cashPortion = (s.payments || []).filter(p => p.method === 'CASH').reduce((a, p) => a + p.amount, 0);
            return sum + cashPortion;
          }
          return sum;
        }, 0);
        const cashExpensesToday = expenses.reduce((sum, e) => sum + e.amount, 0);
        const cashInToday = cashMovements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0);
        const cashOutToday = cashMovements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0);
        const expectedCash = registerDetails.initialCash + cashSalesToday - cashExpensesToday + cashInToday - cashOutToday;
        const actualAmount = Number(actualCash) || 0;
        const difference = actualAmount - expectedCash;

        return (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setZReportModalOpen(false); }}>
          <section className="receipt-panel" style={{ maxWidth: '500px' }}>
            <div className="receipt-header"><div><p>Z-Report</p><h2>Clôture de Caisse</h2></div><button onClick={() => setZReportModalOpen(false)}><XCircle size={18} /></button></div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Fond initial</span><strong style={{ display: 'block' }}>{formatMoney(registerDetails.initialCash)}</strong></div>
                <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ventes espèces</span><strong style={{ display: 'block', color: '#10b981' }}>+ {formatMoney(cashSalesToday)}</strong></div>
                {cashInToday > 0 && <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Entrées manuelles</span><strong style={{ display: 'block', color: '#10b981' }}>+ {formatMoney(cashInToday)}</strong></div>}
                <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Dépenses caisse</span><strong style={{ display: 'block', color: '#ef4444' }}>- {formatMoney(cashExpensesToday)}</strong></div>
                {cashOutToday > 0 && <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Sorties manuelles</span><strong style={{ display: 'block', color: '#ef4444' }}>- {formatMoney(cashOutToday)}</strong></div>}
                <div><span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ventes globales</span><strong style={{ display: 'block' }}>{formatMoney(shiftSales.reduce((sum,s)=>sum+s.total,0))}</strong></div>
                
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>Espèces attendues en tiroir</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{formatMoney(expectedCash)}</strong>
                </div>
              </div>

              <div style={{ background: difference < 0 ? '#fef2f2' : difference > 0 ? '#f0fdf4' : '#fff', padding: '1rem', borderRadius: '8px', border: difference < 0 ? '1px solid #fecaca' : difference > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Espèces comptées physiquement (MAD)</span>
                  <button className="ghost-action" style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }} onClick={() => setShowDenominations(!showDenominations)}>
                    <Calculator size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                    {showDenominations ? 'Masquer' : 'Calculatrice de billets'}
                  </button>
                </div>
                {showDenominations && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {[200, 100, 50, 20, 10, 5, 2, 1, 0.5].map((val) => (
                      <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '40px', fontWeight: 500, fontSize: '0.85rem' }}>{val}</span>
                        <input type="number" min="0" value={denominations[val as keyof DenominationCounts] || ''} onChange={(e) => {
                          const valCount = Number(e.target.value) || 0;
                          const newDenoms = { ...denominations, [val]: valCount };
                          setDenominations(newDenoms);
                          const newTotal = Object.entries(newDenoms).reduce((sum, [k, v]) => sum + (Number(k) * v), 0);
                          setActualCash(newTotal.toString());
                        }} style={{ width: '100%', padding: '0.5rem' }} />
                      </label>
                    ))}
                  </div>
                )}
                <input type="number" placeholder="Entrez le montant en tiroir..." value={actualCash} onChange={e => {
                  if(!showDenominations) setActualCash(e.target.value)
                }} readOnly={showDenominations} style={{ fontSize: '1.1rem', padding: '0.75rem', background: showDenominations ? '#f1f5f9' : '#fff' }} />
                {actualCash && (
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                    <span>Différence :</span>
                    <span style={{ color: difference < 0 ? '#ef4444' : difference > 0 ? '#16a34a' : '#64748b', fontSize: '1.2rem' }}>
                      {difference > 0 ? '+' : ''}{formatMoney(difference)}
                    </span>
                  </div>
                )}
              </div>

              <button className="primary-action" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: '#ef4444' }} onClick={async () => {
                if (window.confirm('Êtes-vous sûr de vouloir clôturer la caisse définitivement ?')) {
                  try {
                    const response = await apiFetch(`/api/register/close`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sessionId: registerDetails.openedId, expectedCash, countedCash: actualAmount })
                    });
                    if (!response.ok) throw new Error();
                    setRegisterStatus('CLOSED');
                    setZReportModalOpen(false);
                    setActualCash('');
                    setDenominations({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0 });
                    setShowDenominations(false);
                    setCashMovements([]);
                    setOpenRegisterForm({ initialCash: '' });
                    setStatus(`Caisse clôturée. ${difference !== 0 ? 'Ecart de ' + formatMoney(difference) : 'Caisse juste'}`);
                    setPage('Tableau de bord');
                    await loadSessions();
                  } catch {
                    setStatus('Erreur: Impossible de clôturer la caisse');
                  }
                }
              }}><Lock size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Clôturer la caisse</button>
            </div>
          </section>
        </div>
      )})()}

      {calcOpen && (
        <div className="calc-modal" onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}>
          <div className="calc-panel">
            <div className="calc-display">
              <span>{calcPrev !== null && calcOp ? `${calcPrev} ${calcOp}` : '\u00a0'}</span>
              <strong>{calcDisplay}</strong>
            </div>
            <div className="calc-grid">
              {['C', 'e', '%', 'e', '7', '8', '9', 'e', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '', '='].map((key, i) => key ? (
                <button key={i} className={['e','e','-','+'].includes(key) ? 'calc-op' : key === '=' ? 'calc-eq' : key === 'C' ? 'calc-clear' : ''} onClick={() => calcPress(key)}>{key}</button>
              ) : <span key={i} />)}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </section>
  );
};
