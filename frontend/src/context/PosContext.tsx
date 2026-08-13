import { createContext, useContext } from 'react';
import type { SaleRecord, RegisterHistory, Product, Location } from '../main';

// Carries the slice of App's state/handlers that extracted pages need.
// Grows one field at a time as more pages move out of main.tsx (see
// PROGRESS.md/TRACE.md Phase 1). Extracted pages destructure from usePos()
// using the exact same identifier names they used as closures in main.tsx,
// so a wrong reference is a compile error, not a silently swapped prop.
export interface PosContextValue {
  sales: SaleRecord[];
  paymentFilter: 'ALL' | 'Payee' | 'Credit';
  setPaymentFilter: (filter: 'ALL' | 'Payee' | 'Credit') => void;
  getSaleDueAmount: (sale: SaleRecord) => number;
  setReceiptSale: (sale: SaleRecord | null) => void;
  setInvoiceSale: (sale: SaleRecord | null) => void;
  resumeSale: (sale: SaleRecord) => void;
  openSaleSettlement: (sale: SaleRecord) => void;
  registerLogs: RegisterHistory[];
  currentLocationId: number;
  // Added for ReportsPage (Phase 1, 2026-08-13)
  products: Product[];
  visibleProducts: Product[];
  lowStockProducts: Product[];
  locations: Location[];
  reportsTab: 'synthese' | 'ventes' | 'produits' | 'paiements';
  setReportsTab: (tab: 'synthese' | 'ventes' | 'produits' | 'paiements') => void;
  reportPeriod: 'today' | 'week' | 'month' | 'year' | 'all';
  setReportPeriod: (period: 'today' | 'week' | 'month' | 'year' | 'all') => void;
  dashboardLocationFilter: number | 'ALL';
  setDashboardLocationFilter: (filter: number | 'ALL') => void;
  // Added for KitchenPage (Phase 1, 2026-08-13)
  draftSales: SaleRecord[];
  kitchenFilter: 'all' | 'drinks' | 'food';
  setKitchenFilter: (filter: 'all' | 'drinks' | 'food') => void;
  markKitchenReady: (saleId: number) => void;
}

export const PosContext = createContext<PosContextValue | null>(null);

export const usePos = (): PosContextValue => {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within <PosContext.Provider>');
  return ctx;
};
