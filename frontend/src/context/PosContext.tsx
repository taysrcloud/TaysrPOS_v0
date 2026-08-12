import { createContext, useContext } from 'react';
import type { SaleRecord, RegisterHistory } from '../main';

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
}

export const PosContext = createContext<PosContextValue | null>(null);

export const usePos = (): PosContextValue => {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within <PosContext.Provider>');
  return ctx;
};
