import { createContext, useContext } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  SaleRecord, RegisterHistory, Product, ProductVariation, Location, CartLine, Contact, Expense,
  CashMovement, RolePermissions, User, PageKey, PaymentMethod,
} from '../main';

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
  reportsTab: 'synthese' | 'ventes' | 'produits' | 'paiements' | 'comptabilite' | 'commissions';
  setReportsTab: (tab: 'synthese' | 'ventes' | 'produits' | 'paiements' | 'comptabilite' | 'commissions') => void;
  reportPeriod: 'today' | 'week' | 'month' | 'year' | 'all';
  setReportPeriod: (period: 'today' | 'week' | 'month' | 'year' | 'all') => void;
  dashboardLocationFilter: number | 'ALL';
  setDashboardLocationFilter: (filter: number | 'ALL') => void;
  // Added for KitchenPage (Phase 1, 2026-08-13)
  draftSales: SaleRecord[];
  kitchenFilter: 'all' | 'drinks' | 'food';
  setKitchenFilter: (filter: 'all' | 'drinks' | 'food') => void;
  markKitchenReady: (saleId: number) => void;
  // Added for RegisterPage (Phase 1, 2026-08-13). This list is long because
  // renderRegister genuinely touches this much App state - see TRACE.md's
  // RegisterPage extraction entry for the full dependency audit (which of
  // these had to thread here vs. could be relocated as page-local state).
  // Field order matches RegisterPage's usePos() destructure order so the two
  // lists can be diffed by eye.
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  setStatus: (status: string) => void;
  restaurantEnabled: boolean;
  setCurrentLocationId: (id: number) => void;
  selectedTable: string;
  setSelectedTable: (table: string) => void;
  clearCart: () => void;
  setPage: (page: PageKey) => void;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
  customer: Contact;
  setCustomer: (contact: Contact) => void;
  openContactModal: (type: 'CUSTOMER' | 'SUPPLIER') => void;
  productSearchInputRef: RefObject<HTMLInputElement | null>;
  search: string;
  setSearch: (value: string) => void;
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  addToCart: (product: Product, variation?: ProductVariation, qty?: number) => void;
  updateCartQty: (uniqueId: string, delta: number) => void;
  categories: string[];
  showRecent: boolean;
  rolePermissions: RolePermissions;
  currentUser: User | null;
  orderDiscountInputRef: RefObject<HTMLInputElement | null>;
  discountRate: number;
  setDiscountRate: (value: number) => void;
  cartSubtotal: number;
  cartLineDiscount: number;
  cartTax: number;
  cartTotal: number;
  contacts: Contact[];
  setContacts: Dispatch<SetStateAction<Contact[]>>;
  recordDraft: (statusName: SaleRecord['status']) => Promise<void>;
  companySettings: { loyaltyEnabled: boolean; pointsPerAmount: number; amountPerPoint: number };
  loyaltyPointsUsed: number;
  setLoyaltyPointsUsed: (value: number) => void;
  completeSale: (method: PaymentMethod) => Promise<void>;
  registerStatus: 'OPEN' | 'CLOSED';
  setRegisterStatus: (status: 'OPEN' | 'CLOSED') => void;
  registerDetails: { openedAt: string; openedAtISO: string; initialCash: number; openedId: number };
  setRegisterDetails: Dispatch<SetStateAction<{ openedAt: string; openedAtISO: string; initialCash: number; openedId: number }>>;
  suspendNote: string;
  setSuspendNote: (value: string) => void;
  suspendModalOpen: boolean;
  setSuspendModalOpen: (value: boolean) => void;
  paymentForm: { cash: string; card: string; credit: string; storeCredit: string };
  setPaymentForm: Dispatch<SetStateAction<{ cash: string; card: string; credit: string; storeCredit: string }>>;
  transactionsModalOpen: boolean;
  setTransactionsModalOpen: (value: boolean) => void;
  actualCash: string;
  setActualCash: (value: string) => void;
  expenses: Expense[];
  cashMovements: CashMovement[];
  setCashMovements: Dispatch<SetStateAction<CashMovement[]>>;
  loadSessions: () => Promise<void>;
  topupContact: Contact | null;
  setTopupContact: (contact: Contact | null) => void;
  topupAmount: string;
  setTopupAmount: (value: string) => void;
  messageContact: Contact | null;
  setMessageContact: (contact: Contact | null) => void;
  messageContent: string;
  setMessageContent: (value: string) => void;
  selectedVariableProduct: Product | null;
  setSelectedVariableProduct: (product: Product | null) => void;
  groupPrices: Record<number, number>;
  commissionAgents: any[];
  currencies: any[];
  commissionAgentId: number | '';
  setCommissionAgentId: (id: number | '') => void;
  currencyId: number | '';
  setCurrencyId: (id: number | '') => void;
  exchangeRate: string;
  setExchangeRate: (val: string) => void;
}

export const PosContext = createContext<PosContextValue | null>(null);

export const usePos = (): PosContextValue => {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within <PosContext.Provider>');
  return ctx;
};
