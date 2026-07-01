import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Banknote,
  Building,
  Calculator,
  CheckCircle,
  MapPin,
  ChefHat,
  Clock,
  ClipboardList,
  CreditCard,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  Maximize2,
  Monitor,
  Edit2,
  Package,
  Pause,
  Percent,
  Plus,
  ReceiptText,
  RotateCcw,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Users,
  TrendingUp,
  Utensils,
  Warehouse,
  XCircle,
  Globe,
  Palette,
  Shield,
  Download,
  ArrowRightLeft,
  Mail
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { CreatePurchaseModal } from './purchase-modals';
import './styles.css';

type ProductType = 'RETAIL' | 'MENU_ITEM' | 'INGREDIENT' | 'SERVICE' | 'BUNDLE';
type EnabledModule = 'POS' | 'RESTAURANT';
type PageKey = 'Tableau de bord' | 'POS' | 'Produits' | 'Clients' | 'Fournisseurs' | 'Stock' | 'Achats' | 'Depenses' | 'Ventes' | 'Factures' | 'Paiements' | 'Rapports' | 'Tables' | 'Cuisine' | 'Parametres' | 'Caisses';
type PaymentMethod = 'CASH' | 'CARD' | 'CREDIT' | 'STORE_CREDIT' | 'MULTI';

type CashMovement = {
  id: number;
  type: 'IN' | 'OUT';
  amount: number;
  note: string;
  time: string;
  locationId?: number;
};

type DenominationCounts = {
  200: number;
  100: number;
  50: number;
  20: number;
  10: number;
  5: number;
  2: number;
  1: number;
  0.5: number;
};

type Expense = {
  id: number;
  reference: string;
  category: string;
  amount: number;
  date: string;
  note: string;
  paymentMethod: string;
  locationId?: number;
};

type ExpenseForm = {
  reference: string;
  category: string;
  amount: number | '';
  date: string;
  note: string;
  paymentMethod: string;
};


type ProductVariation = {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number;
  purchasePrice: number;
  stock: number;
  lowStockAlert: number;
  attributes?: Record<string, string>;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  type: ProductType;
  category: string;
  brand?: string | null;
  unit?: string;
  imageUrl?: string | null;
  salePrice: number;
  purchasePrice: number;
  tvaRate: number;
  trackStock: boolean;
  lowStockAlert: number;
  stock: number;
  isKitchenItem: boolean;
  isVariable: boolean;
  variationOptions?: string[];
  variations?: ProductVariation[];
  isActive: boolean;
};

type Contact = {
  id: number;
  name: string;
  type: string;
  phone: string;
  balance: number;
  creditLimit: number;
  lastActivity: string;
  address?: string;
  rewardPoints?: number;
  storeCredit?: number;
};

type ProductForm = {
  name: string;
  salePrice: string;
  categoryName: string;
  barcode: string;
  sku: string;
  initialStock: string;
  type: ProductType;
  purchasePrice: string;
  brandName: string;
  unitName: string;
  imageUrl: string;
  tvaRate: string;
  trackStock: boolean;
  lowStockAlert: string;
  isKitchenItem: boolean;
  isVariable: boolean;
  variationOptions?: string[];
  variations: { name: string; sku: string; salePrice: string; purchasePrice: string; stock: string; lowStockAlert: string; barcode: string; attributes?: Record<string, string>; }[];
};

type CartLine = { product: Product; variation?: ProductVariation; quantity: number; discount: number; customPrice?: number; note?: string; uniqueId: string; };
type SaleLine = { productId: number; variationId?: number; name: string; sku: string; quantity: number; unitPrice: number; discount: number; tvaRate: number; lineTotal: number; note?: string; };
type SaleRecord = {
  invoiceId?: number;
  userId?: number;
  cashierName?: string;
  customerId?: number;
  id: number;
  ticket: string;
  customer: string;
  total: number;
  subtotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  items: number;
  method: PaymentMethod;
  status: 'Payee' | 'Credit' | 'Brouillon' | 'Suspendue' | 'Devis' | 'Retour';
  createdAt: string;
  lines?: SaleLine[];
  splitPayments?: { method: PaymentMethod; amount: number }[];
  referenceNote?: string;
  kitchenStatus?: 'PENDING' | 'READY';
  locationId?: number;
  pointsEarned?: number;
  pointsUsed?: number;
};

type SaleSettlementForm = {
  amount: string;
  method: 'CASH' | 'CARD';
};

type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER';

type RolePermissions = Record<UserRole, string[]>;

const allModuleLabels = ['Tableau de bord', 'POS', 'Produits', 'Clients', 'Fournisseurs', 'Stock', 'Achats', 'Depenses', 'Ventes', 'Factures', 'Paiements', 'Rapports', 'Caisses', 'Tables', 'Cuisine', 'Parametres', 'ACTION:APPLY_DISCOUNT', 'ACTION:OVERRIDE_PRICE', 'ACTION:VOID_SALE'];

const defaultRolePermissions: RolePermissions = {
  ADMIN: [...allModuleLabels],
  MANAGER: allModuleLabels.filter(m => m !== 'Parametres'),
  CASHIER: ['POS', 'Clients', 'ACTION:VOID_SALE'], // Allow cashier to void, but not discount/override by default
  WAITER: ['Tables', 'Cuisine'],
};

type User = {
  id: number;
  name: string;
  fullName?: string;
  username?: string;
  email: string;
  role: UserRole;
  accountId?: string;
  avatarUrl?: string;
};

type LoginAccountOption = {
  accountId: string;
  companyName: string;
};

type RegisterHistory = {
  id: number;
  userId?: number;
  openedAt: string;
  closedAt: string;
  cashierName: string;
  initialCash: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  status: 'Juste' | 'Ecart positif' | 'Ecart négatif';
  locationId?: number;
};

type StockAdjustment = {
  id: number;
  productId: number;
  productName: string;
  date: string;
  type: 'Perte' | 'Casse' | 'Inventaire' | 'Vol';
  quantity: number;
  reason: string;
  user: string;
};

type PurchaseRecord = {
  id: number;
  reference: string;
  supplier: string;
  total: number;
  status: 'Recu' | 'Partiel' | 'Brouillon' | 'Retour';
  createdAt: string;
  lines?: SaleLine[]; // Reuse SaleLine for simplicity
  locationId?: number;
};

type Location = {
  id: number;
  name: string;
  address: string;
  phone: string;
};



const apiBase = 'http://127.0.0.1:4400';

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('taysrPOS_token');
  const headers: Record<string, string> = { ...((options.headers as any) || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase}${url}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    window.dispatchEvent(new Event('auth-error'));
  }
  return res;
};

const productImage = (label: string, bg = '#dbeafe') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="320" height="220" rx="28" fill="url(#g)"/><rect x="94" y="38" width="132" height="148" rx="24" fill="#fff" stroke="#cbd5e1"/><circle cx="160" cy="88" r="28" fill="${bg}"/><rect x="118" y="130" width="84" height="12" rx="6" fill="#cbd5e1"/><rect x="130" y="150" width="60" height="10" rx="5" fill="#e2e8f0"/><text x="160" y="206" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#0f172a">${label}</text></svg>`)}`;

const baseModules = [
  ['Tableau de bord', LayoutDashboard, 'POS'],
  ['POS', ReceiptText, 'POS'],
  ['Produits', Package, 'POS'],
  ['Clients', Users, 'POS'],
  ['Fournisseurs', Truck, 'POS'],
  ['Stock', Warehouse, 'POS'],
  ['Achats', Store, 'POS'],
  ['Depenses', Banknote, 'POS'],
  ['Ventes', ClipboardList, 'POS'],
    ['Factures', FileText, 'POS'],
  ['Paiements', CreditCard, 'POS'],
  ['Rapports', BarChart3, 'POS'],
  ['Caisses', Lock, 'POS'],
  ['Tables', Utensils, 'RESTAURANT'],
  ['Cuisine', ChefHat, 'RESTAURANT'],
  ['Parametres', Settings, 'POS'],
] as const;




const seedRegisterLogs: RegisterHistory[] = [
  { id: 1, openedAt: 'Hier 08:30', closedAt: 'Hier 18:45', cashierName: 'Caisse 1', initialCash: 1000, expectedCash: 3500, actualCash: 3500, difference: 0, status: 'Juste' },
  { id: 2, openedAt: 'Lun 08:15', closedAt: 'Lun 19:00', cashierName: 'Gérant Magasin', initialCash: 1500, expectedCash: 4200, actualCash: 4180, difference: -20, status: 'Ecart négatif' },
];

const seedUsers: User[] = [
  { id: 1, name: 'Admin Principal', email: 'admin@taysr.com', role: 'ADMIN', avatarUrl: 'https://ui-avatars.com/api/?name=Admin+Principal&background=6366f1&color=fff' },
  { id: 2, name: 'Gérant Magasin', email: 'gerant@taysr.com', role: 'MANAGER', avatarUrl: 'https://ui-avatars.com/api/?name=Gerant+Magasin&background=10b981&color=fff' },
  { id: 3, name: 'Caisse 1', email: 'caisse1@taysr.com', role: 'CASHIER', avatarUrl: 'https://ui-avatars.com/api/?name=Caisse+1&background=f59e0b&color=fff' },
];

const emptyForm: ProductForm = {
  name: '',
  salePrice: '',
  categoryName: 'General',
  barcode: '',
  sku: '',
  initialStock: '0',
  type: 'RETAIL',
  purchasePrice: '0',
  brandName: '',
  unitName: 'pcs',
  imageUrl: '',
  tvaRate: '20',
  trackStock: true,
  lowStockAlert: '0',
  isKitchenItem: false,
  isVariable: false,
  variationOptions: [],
  variations: [],
};

const formatMoney = (value: number) => `${(Number(value) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

const typeLabel: Record<ProductType, string> = {
  RETAIL: 'Article retail',
  MENU_ITEM: 'Menu restaurant',
  INGREDIENT: 'Ingredient cuisine',
  SERVICE: 'Service',
  BUNDLE: 'Pack',
};

const methodLabel: Record<PaymentMethod, string> = {
  CASH: 'Especes',
  CARD: 'Carte',
  CREDIT: 'Crédit',
  STORE_CREDIT: 'Crédit Magasin',
  MULTI: 'Paiement multiple',
};

const generateESCPOS = (sale: SaleRecord, settings: any): Uint8Array => {
  const bytes: number[] = [];
  const addBytes = (...b: number[]) => bytes.push(...b);
  const addText = (text: string) => text.split('').forEach(c => {
    const charCode = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charCodeAt(0);
    addBytes(charCode > 255 ? 63 : charCode);
  });
  const addLine = (text: string) => { addText(text); addBytes(10); };

  addBytes(27, 64);
  addBytes(27, 97, 1);
  addBytes(27, 69, 1);
  addLine(settings.companyName || 'MAGASIN');
  addBytes(27, 69, 0);

  addLine(settings.address || '');
  addLine('Tel: ' + (settings.phone || ''));
  addLine('');
  
  addLine(settings.ticketHeader || 'Ticket de Caisse');
  addLine('--------------------------------');
  
  addBytes(27, 97, 0);
  addLine('Ticket: ' + sale.ticket);
  addLine('Date: ' + sale.createdAt);
  addLine('Client: ' + sale.customer);
  addLine('--------------------------------');

  (sale.lines || []).forEach(line => {
    addLine(line.name);
    let qtyStr = "  " + line.quantity + " x " + line.unitPrice.toFixed(2);
    let totalStr = line.lineTotal.toFixed(2);
    let spaces = 32 - qtyStr.length - totalStr.length;
    if(spaces < 1) spaces = 1;
    addLine(qtyStr + ' '.repeat(spaces) + totalStr);
  });

  addLine('--------------------------------');
  
  addBytes(27, 97, 2);
  addBytes(27, 69, 1);
  addLine('TOTAL: ' + sale.total.toFixed(2));
  addBytes(27, 69, 0);
  
  addLine('--------------------------------');
  addBytes(27, 97, 1);
  addLine(settings.ticketFooter || 'Merci de votre visite!');
  
  addBytes(10, 10, 10, 10);
  addBytes(29, 86, 66, 0);
  
  return new Uint8Array(bytes);
};

const sendToPrinter = async (port: any, data: Uint8Array) => {
  if (!port) return;
  try {
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
  } catch (e) {
    console.error("Print Error", e);
  }
};

const openCashDrawer = async (port: any) => {
  if (!port) return;
  try {
    const writer = port.writable.getWriter();
    await writer.write(new Uint8Array([27, 112, 0, 25, 250]));
    writer.releaseLock();
  } catch (e) {
    console.error("Drawer Error", e);
  }
};


const pageIcon = (page: PageKey) => {
  const found = baseModules.find(([label]) => label === page);
  return found?.[1] || LayoutDashboard;
};

const PageHeader = ({ title, subtitle, action, icon: Icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: any }) => (
  <div className="modern-page-header">
    <div className="header-content">
      {Icon && <div className="header-icon-container"><Icon size={24} strokeWidth={2.5} /></div>}
      <div>
        <h1 className="modern-page-title">{title}</h1>
        {subtitle && <p className="modern-page-subtitle">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="modern-page-actions">{action}</div>}
  </div>
);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
    const [loginAccounts, setLoginAccounts] = useState<LoginAccountOption[]>([]);
  const [selectedLoginAccountId, setSelectedLoginAccountId] = useState('');
  const [page, setPage] = useState<PageKey>('Tableau de bord');

  const [isLocked, setIsLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  
  useEffect(() => {
    const handleAuthError = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsLocked(false);
      localStorage.removeItem('taysrPOS_token');
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: loginEmail,
          password: loginPassword,
          ...(selectedLoginAccountId ? { accountId: selectedLoginAccountId } : {}),
        })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('taysrPOS_token', data.token);
        setCurrentUser(data.user);
        setLoginAccounts([]);
        setSelectedLoginAccountId('');
        setIsAuthenticated(true);
        setIsLocked(false);
      } else {
        const error = await res.json().catch(() => null);
        if (res.status === 409 && error?.requiresAccountSelection && Array.isArray(error.accounts)) {
          setLoginAccounts(error.accounts);
          setSelectedLoginAccountId(error.accounts[0]?.accountId || '');
          alert('Plusieurs comptes sont lies a cet identifiant. Choisissez le bon tenant puis reconnectez-vous.');
        } else {
          alert(error?.message || 'Identifiant ou mot de passe incorrect');
        }
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
  };
  const handlePinUnlock = async () => {
    if (!currentUser || pinEntry.length !== 4) return;
    try {
      const res = await fetch(`${apiBase}/api/auth/pin-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, pin: pinEntry })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('taysrPOS_token', data.token);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        setIsLocked(false);
      } else {
        alert('Code PIN incorrect');
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
    setPinEntry('');
  };

  const handleLock = () => {
    setIsLocked(true);
    setIsAuthenticated(false);
  };




  const [locations, setLocations] = useState<Location[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number>(0);
  const [zReportModalOpen, setZReportModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [cashMovementModalOpen, setCashMovementModalOpen] = useState(false);
  const [cashMovementForm, setCashMovementForm] = useState<{type: 'IN' | 'OUT', amount: string, note: string}>({type: 'IN', amount: '', note: ''});
  const [showDenominations, setShowDenominations] = useState(false);
  const [denominations, setDenominations] = useState<DenominationCounts>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0, 0.5: 0
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ reference: '', category: 'Autre', amount: '', date: new Date().toISOString().split('T')[0], note: '', paymentMethod: 'Espèces' });
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<ProductType | 'ALL'>('ALL');
  const [dashboardLocationFilter, setDashboardLocationFilter] = useState<'ALL' | number>('ALL');
  const [dashboardPeriod, setDashboardPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [status, setStatus] = useState('Mode demo local pret');
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customer, setCustomer] = useState<Contact>({ id: 0, name: 'Client comptoir', type: 'Client', phone: '-', balance: 0, creditLimit: 0, lastActivity: 'Aujourd hui' });
  const [selectedVariableProduct, setSelectedVariableProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [invoicePaymentTarget, setInvoicePaymentTarget] = useState<any>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoicePaymentForm, setInvoicePaymentForm] = useState({ amount: '', method: 'CASH', note: '' });
  const [manualInvoiceCustomer, setManualInvoiceCustomer] = useState<number | ''>('');
  const [manualInvoiceNotes, setManualInvoiceNotes] = useState('');
  const [manualInvoiceLines, setManualInvoiceLines] = useState([{ description: '', quantity: '1', unitPrice: '0', tvaRate: '20', productId: '' }]);
  const [ticketInvoiceModalOpen, setTicketInvoiceModalOpen] = useState(false);
  const [manualInvoiceModalOpen, setManualInvoiceModalOpen] = useState(false);
  const [draftSales, setDraftSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [discountRate, setDiscountRate] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [showRecent, setShowRecent] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [contactSearch, setContactSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'Payee' | 'Credit'>('ALL');
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<SaleRecord | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [settlingContact, setSettlingContact] = useState<Contact | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlingSale, setSettlingSale] = useState<SaleRecord | null>(null);
  const [saleSettlementForm, setSaleSettlementForm] = useState<SaleSettlementForm>({ amount: '', method: 'CASH' });
  const [topupContact, setTopupContact] = useState<Contact | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [messageContact, setMessageContact] = useState<Contact | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendType, setSuspendType] = useState<SaleRecord['status']>('Brouillon');
  const [suspendNote, setSuspendNote] = useState('');
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionsTab, setTransactionsTab] = useState<'Finalisees' | 'Suspendues' | 'Brouillons' | 'Devis'>('Finalisees');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editLineForm, setEditLineForm] = useState({ price: '', discount: '', note: '' });
  const [contactForm, setContactForm] = useState({ name: '', phone: '', creditLimit: '0', address: '' });
  const [paymentForm, setPaymentForm] = useState({ cash: '0', card: '0', credit: '0', storeCredit: '0' });
  const [serialPort, setSerialPort] = useState<any>(null);
  const [registerStatus, setRegisterStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [registerLogs, setRegisterLogs] = useState<RegisterHistory[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState<{ productId: number | null, type: 'Perte' | 'Casse' | 'Inventaire' | 'Vol', quantity: string, reason: string }>({ productId: null, type: 'Casse', quantity: '', reason: '' });
  const [stockView, setStockView] = useState<'STOCK' | 'HISTORY'>('STOCK');
  const [registerDetails, setRegisterDetails] = useState({ openedAt: '', initialCash: 0, openedId: 0 });
  const [openRegisterForm, setOpenRegisterForm] = useState({ initialCash: '' });
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);


  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'company' | 'legal' | 'templates' | 'users' | 'permissions' | 'hardware' | 'locations'>('general');
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(() => {
    try {
      const saved = localStorage.getItem('taysrPOS_rolePermissions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultRolePermissions;
  });
  const saveRolePermissions = (perms: RolePermissions) => {
    setRolePermissions(perms);
    localStorage.setItem('taysrPOS_rolePermissions', JSON.stringify(perms));
  };
  const [reportsTab, setReportsTab] = useState<'synthese' | 'ventes' | 'produits' | 'paiements'>('synthese');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [tableFilter, setTableFilter] = useState<'all' | 'free' | 'occupied'>('all');
  const [viewSelectedTable, setViewSelectedTable] = useState<string | null>(null);
  const [kitchenFilter, setKitchenFilter] = useState<'all' | 'drinks' | 'food'>('all');
  const [tableGroups, setTableGroups] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState({
    companyName: 'TaysrPOS Demo', address: 'Casablanca, Maroc', phone: '05 22 00 00 00', email: 'contact@taysr.ma', currency: 'MAD',
    rc: '239', ice: '001454366000046', patente: '54509281', if: '4967057', inpe: '165002114',
    defaultTva: '20', pricesIncludeTva: true,
    invoiceHeader: 'FACTURE', invoiceFooter: 'Merci de votre confiance', invoiceTicketDisplay: 'SUMMARY' as 'SUMMARY' | 'DETAILED', invoiceShowTicketReferences: true, invoiceShowTicketDates: true,
    ticketHeader: 'TICKET DE CAISSE', ticketFooter: 'Merci de votre visite', ticketPaperWidth: 80,
    primaryColor: '#3b82f6', showLogo: true, logoUrl: null as string | null,
    autoLockMinutes: 5,
    // New Template Toggles
    showIceOnTicket: true, showCashierName: true, showCustomerInfo: true,
    customTicketCss: '', customInvoiceCss: '',
    loyaltyEnabled: true, pointsPerAmount: 10, amountPerPoint: 0.5,
    // Scale Barcode Parsing
    scaleEnabled: false, scalePrefix: '20', scaleType: 'WEIGHT' as 'WEIGHT' | 'PRICE', scaleSkuLength: 4
  });
  // Later this will come from Super Admin provisioning / tenant feature flags.
  const enabledModules = useMemo<EnabledModule[]>(() => ['POS', 'RESTAURANT'], []);

  const restaurantEnabled = enabledModules.includes('RESTAURANT');
  const visibleTypes = useMemo<ProductType[]>(() => restaurantEnabled
    ? ['RETAIL', 'MENU_ITEM', 'INGREDIENT', 'SERVICE']
    : ['RETAIL', 'SERVICE', 'BUNDLE'], [restaurantEnabled]);
  const visibleModules = useMemo(() => {
    let modules = baseModules.filter(([, , module]) => module === 'POS' || enabledModules.includes(module));
    if (currentUser) {
      const allowed = rolePermissions[currentUser.role] || [];
      modules = modules.filter(([label]) => allowed.includes(label as string));
    }
    return modules;
  }, [enabledModules, currentUser, rolePermissions]);
  const ActiveIcon = pageIcon(page);

  const [activeLocation, setActiveLocation] = useState<string | null>(() => localStorage.getItem('taysrPOS_activeLocation'));
  const [dataLoading, setDataLoading] = useState(false);

  const handleClockIn = async () => {
    if(!currentUser) return;
    const res = await apiFetch('/api/attendance/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) });
    if (res.ok) { alert('Pointage entrée enregistré!'); } else { const err = await res.json(); alert('Erreur: ' + err.error); }
  };
  const handleClockOut = async () => {
    if(!currentUser) return;
    const res = await apiFetch('/api/attendance/clock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) });
    if (res.ok) { alert('Pointage sortie enregistré!'); } else { const err = await res.json(); alert('Erreur: ' + err.error); }
  };

  const loadInvoices = async () => {
    try {
      const response = await apiFetch(`/api/invoices`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const syncInvoiceInState = (invoice: any) => {
    setInvoices((current: any[]) => current.map(item => item.id === invoice.id ? invoice : item));
    setSelectedFacture((current: any) => current?.id === invoice.id ? invoice : current);
    setInvoicePaymentTarget((current: any) => current?.id === invoice.id ? invoice : current);
  };

  const loadSales = async () => {
    try {
      const response = await apiFetch(`/api/sales${activeLocation ? '?locationId='+activeLocation : ''}`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.sales)) setSales(data.sales);
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadContacts = async () => {
    try {
      const response = await apiFetch(`/api/contacts`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.contacts)) {
         setContacts(data.contacts);
         if (customer.id === 0 && data.contacts.length > 0) {
            setCustomer(data.contacts[0]);
         }
      }
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadLocations = async () => {
    try {
      const response = await apiFetch(`/api/locations`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.locations) && data.locations.length > 0) {
         setLocations(data.locations);
         if (currentLocationId === 0) setCurrentLocationId(data.locations[0].id);
      }
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadExpenses = async () => {
    try {
      const response = await apiFetch(`/api/expenses`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.expenses)) setExpenses(data.expenses);
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadPurchases = async () => {
    try {
      const response = await apiFetch(`/api/purchases`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.purchases)) setPurchases(data.purchases);
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadTables = async () => {
    try {
      const response = await apiFetch(`/api/restaurant/tables`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      if (Array.isArray(data.areas)) setTableGroups(data.areas);
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };

  const loadSessions = async () => {
    try {
      const [sessRes, movRes] = await Promise.all([
         apiFetch(`/api/register/sessions`),
         apiFetch(`/api/register/movements`)
      ]);
      const [sessData, movData] = await Promise.all([sessRes.json(), movRes.json()]);
      if (Array.isArray(sessData.sessions)) {
        setRegisterLogs(sessData.sessions);
      }
      if (Array.isArray(movData.movements)) setCashMovements(movData.movements);
    } catch {
      // Expected when the API/database is offline; keep the demo UI usable.
    }
  };


  const submitContact = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    
    try {
      const response = await apiFetch(`/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name,
          type: 'Client',
          phone: contactForm.phone,
          creditLimit: Number(contactForm.creditLimit) || 0,
          balance: 0,
          address: contactForm.address,
        }),
      });
      if (!response.ok) throw new Error('API unavailable');
      const created = await response.json();
      setContacts(current => [...current, created]);
      setCustomer(created);
      setCustomerModalOpen(false);
      setContactForm({ name: '', phone: '', creditLimit: '0', address: '' });
      setStatus('Client ajoute et selectionne');
    } catch (err: any) {
      setStatus('Erreur: Impossible d\'ajouter le client');
    }
  };

  const markKitchenReady = async (saleId: number) => {
        const stockUpdate = (p: Product) => {
          if (!p.trackStock) return p;
          const cartItem = cart.find(c => c.product.id === p.id);
          if (!cartItem) return p;

          if (p.isVariable && cartItem.variation) {
             return {
                ...p,
                variations: p.variations?.map(v => v.id === cartItem.variation!.id ? { ...v, stock: v.stock - cartItem.quantity } : v)
             };
          }
          return { ...p, stock: p.stock - cartItem.quantity };
        };
        setProducts(current => current.map(stockUpdate));
    setSales(current => current.map(s => s.id === saleId ? { ...s, kitchenStatus: 'READY' } : s));
    setDraftSales(current => current.map(s => s.id === saleId ? { ...s, kitchenStatus: 'READY' } : s));
    try {
      await apiFetch(`/api/sales/${saleId}/kitchen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchenStatus: 'READY' }),
      });
    } catch {
      // Local fallback already applied
    }
  };

  const loadProducts = async () => {
    try {
      const url = new URL('/api/products', apiBase);
      if (filter !== 'ALL') url.searchParams.set('type', filter);
      if (search.trim()) url.searchParams.set('search', search.trim());
      if (currentLocationId) url.searchParams.set('locationId', currentLocationId.toString());
      const response = await apiFetch(url.pathname + url.search);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      const remoteProducts: Product[] = data.products || [];
      setProducts(current => {
        const remoteKeys = new Set(remoteProducts.map(product => product.sku || String(product.id)));
        const q = search.trim().toLowerCase();
        const localOnly = current.filter(product => {
          const key = product.sku || String(product.id);
          if (remoteKeys.has(key)) return false;
          if (filter !== 'ALL' && product.type !== filter) return false;
          if (!q) return true;
          return [product.name, product.sku, product.barcode || '', product.category].some(value => value.toLowerCase().includes(q));
        });
        return [...localOnly, ...remoteProducts];
      });
      setStatus('Synchronise avec Postgres');
    } catch {
      setStatus('Mode hors ligne - API non disponible');
      // No fallback!
    }
  };

  useEffect(() => {
    const initData = async () => {
      setDataLoading(true);
      await Promise.all([
        loadInvoices(),
          loadSales(),
        loadContacts(),
        loadLocations(),
        loadExpenses(),
        loadPurchases(),
        loadSessions()
      ]);
      setDataLoading(false);
    };
    initData();
  }, []);

  useEffect(() => {
    setDashboardLocationFilter(currentLocationId);
  }, [currentLocationId]);

  useEffect(() => {
    const scopedOpenSession = registerLogs.find((session: any) => {
      if (session.status !== 'Ouverte') return false;
      if (currentUser?.id && session.userId && session.userId !== currentUser.id) return false;
      if (!currentLocationId) return true;
      return !session.locationId || session.locationId === currentLocationId;
    });

    if (scopedOpenSession) {
      setRegisterStatus('OPEN');
      setRegisterDetails({
        openedAt: scopedOpenSession.openedAt,
        initialCash: scopedOpenSession.initialCash,
        openedId: scopedOpenSession.id,
      });
    } else {
      setRegisterStatus('CLOSED');
      setRegisterDetails(current => ({ ...current, openedAt: '', initialCash: 0, openedId: 0 }));
    }
  }, [currentUser?.id, registerLogs, currentLocationId]);

  useEffect(() => {
    const timeout = window.setTimeout(loadProducts, 180);
    return () => window.clearTimeout(timeout);
  }, [filter, search, restaurantEnabled, currentLocationId]);

  const matchesPeriod = (createdAt: string, period: 'today' | 'week' | 'month' | 'year' | 'all') => {
    if (period === 'all') return true;
    const now = new Date();
    const value = createdAt.toLowerCase();
    if (period === 'today') {
      return value.includes('aujourd') || value.includes('maintenant');
    }
    if (period === 'week') {
      return !value.includes('lun') && !value.includes('mar') && !value.includes('mer') && !value.includes('jeu') && !value.includes('ven') && !value.includes('sam') && !value.includes('dim')
        ? true
        : ['aujourd', 'maintenant', 'hier', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].some(token => value.includes(token));
    }
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return period === 'month' || period === 'year';
    }
    if (period === 'month') {
      return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
    }
    return parsed.getFullYear() === now.getFullYear();
  };

  const visibleProducts = useMemo(() => products.filter(product => restaurantEnabled || product.type !== 'MENU_ITEM'), [products, restaurantEnabled]);
  const lowStockProducts = useMemo(() => visibleProducts.filter(product => product.trackStock && product.stock <= product.lowStockAlert), [visibleProducts]);
  const cartSubtotal = useMemo(() => cart.reduce((sum, line) => {
    const unitPrice = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
    return sum + unitPrice * line.quantity;
  }, 0), [cart]);
  const cartLineDiscount = useMemo(() => cart.reduce((sum, line) => sum + line.discount * line.quantity, 0), [cart]);
  const orderDiscount = useMemo(() => cartSubtotal * (discountRate / 100) + (loyaltyPointsUsed * companySettings.amountPerPoint), [cartSubtotal, discountRate, loyaltyPointsUsed, companySettings.amountPerPoint]);
  const cartTax = useMemo(() => cart.reduce((sum, line) => {
    const unitPrice = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
    const lineNet = Math.max(0, (unitPrice - line.discount) * line.quantity);
    return sum + (lineNet * line.product.tvaRate) / 100;
  }, 0), [cart]);
  const cartTotal = useMemo(() => Math.max(0, cartSubtotal - cartLineDiscount - orderDiscount + cartTax), [cartSubtotal, cartLineDiscount, orderDiscount, cartTax]);

  useEffect(() => {
    const channel = new BroadcastChannel('taysr-pos-channel');
    channel.postMessage({
      type: 'SYNC_CART',
      cart,
      cartTotal,
      cartTax,
      cartSubtotal,
      cartLineDiscount,
      orderDiscount,
      customerName: customer.name
    });
    return () => channel.close();
  }, [cart, cartTotal, cartTax, cartSubtotal, cartLineDiscount, orderDiscount, customer.name]);

  const categories = useMemo(() => ['Tous', ...Array.from(new Set(visibleProducts.map(product => product.category)))], [visibleProducts]);
  const paidSales = sales.filter(sale => sale.status === 'Payee');
  const creditSales = sales.filter(sale => sale.status === 'Credit');
  const todayRevenue = paidSales.reduce((sum, sale) => sum + sale.total, 0);
  const grossMargin = visibleProducts.reduce((sum, product) => sum + Math.max(0, product.salePrice - product.purchasePrice) * Math.max(1, product.stock), 0);
  const stats = useMemo(() => ({
    total: visibleProducts.length,
    lowStock: lowStockProducts.length,
    services: visibleProducts.filter(product => product.type === 'SERVICE').length,
    retail: visibleProducts.filter(product => product.type === 'RETAIL').length,
  }), [visibleProducts, lowStockProducts]);

  const deriveSkuFromName = (name: string) => name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 18)
    .toUpperCase() || 'PRD';

  const resetProductForm = () => {
    setForm(emptyForm);
    autoSkuRef.current = '';
    manualSkuRef.current = false;
  };

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleProductPhoto = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateForm('imageUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  
  const addToCart = (product: Product, variation?: ProductVariation, qty: number = 1) => {
    if (!product.isActive) return;
    
    if (product.isVariable && !variation) {
      setSelectedVariableProduct(product);
      return;
    }

    const lineId = variation ? `${product.id}-${variation.id}` : `${product.id}`;
    
    setCart(current => {
      const existing = current.find(line => line.uniqueId === lineId);
      if (existing) return current.map(line => line.uniqueId === lineId ? { ...line, quantity: line.quantity + qty } : line);
      return [...current, { product, variation, quantity: qty, discount: 0, uniqueId: lineId }];
    });
    setPage('POS');
    setSelectedVariableProduct(null);
  };

  const updateCartQty = (uniqueId: string, delta: number) => {
    setCart(current => current
      .map(line => line.uniqueId === uniqueId ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line)
      .filter(line => line.quantity > 0));
  };

  const updateLineDiscount = (uniqueId: string, value: string) => {
    const discount = Math.max(0, Number(value || 0));
    setCart(current => current.map(line => line.uniqueId === uniqueId ? { ...line, discount: Math.min(discount, line.variation ? line.variation.salePrice : line.product.salePrice) } : line));
  };
  // Barcode Scanner Integration
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const autoSkuRef = useRef('');
  const manualSkuRef = useRef(false);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const orderDiscountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const currentTime = Date.now();
      if (currentTime - lastKeyTimeRef.current > 50) {
        barcodeBufferRef.current = '';
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length > 2) {
          const scannedCode = barcodeBufferRef.current;
          barcodeBufferRef.current = '';
          
          let parsedProduct = products.find(p => p.barcode === scannedCode || p.sku === scannedCode);
          let parsedQty = 1;

          // Scale Barcode Parsing Logic
          if (!parsedProduct && companySettings.scaleEnabled && scannedCode.startsWith(companySettings.scalePrefix) && scannedCode.length === 13) {
            // Expected format: prefix(2) + SKU(scaleSkuLength) + data(...) + checksum(1)
            const skuLength = companySettings.scaleSkuLength;
            const skuCode = scannedCode.substring(2, 2 + skuLength);
            const dataStr = scannedCode.substring(2 + skuLength, 12); // Up to 12th char (before checksum)

            const scaleProduct = products.find(p => p.sku === skuCode);
            if (scaleProduct) {
              parsedProduct = scaleProduct;
              const numericData = Number(dataStr);
              if (companySettings.scaleType === 'WEIGHT') {
                // Weight in grams, convert to KG
                parsedQty = numericData / 1000;
              } else {
                // Price in centimes, convert to currency, then divide by unitPrice to get quantity
                const priceValue = numericData / 100;
                parsedQty = priceValue / scaleProduct.salePrice;
              }
            }
          }

          if (parsedProduct) {
            if (parsedProduct.isVariable) {
              setSelectedVariableProduct(parsedProduct);
            } else {
              addToCart(parsedProduct, undefined, parsedQty);
              setStatus(`Scanné : ${parsedProduct.name} (Qté: ${parsedQty.toFixed(3)})`);
            }
          } else {
            setStatus(`Code inconnu : ${scannedCode}`);
          }
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, addToCart]);


  const clearCart = () => {
    setCart([]);
    setDiscountRate(0);
    setStatus('Ticket annule');
  };

  const submitSale = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    const lines: SaleLine[] = cart.map(line => {
      const price = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
      return {
        productId: line.product.id,
        variationId: line.variation?.id,
        name: line.variation ? `${line.product.name} (${line.variation.name})` : line.product.name,
        sku: line.variation ? line.variation.sku : line.product.sku,
        quantity: line.quantity,
        unitPrice: price,
        discount: line.discount,
        tvaRate: line.product.tvaRate,
        lineTotal: Math.max(0, (price - line.discount) * line.quantity),
        note: line.note,
      };
    });
  };

  const salePayload = (method: PaymentMethod, statusName: 'FINAL' | 'DRAFT' | 'SUSPENDED' | 'QUOTE' = 'FINAL') => {
    const payload: any = {
      customerName: customer.name,
      method,
      status: statusName,
      discountRate,
      locationId: currentLocationId,
      pointsEarned: companySettings.loyaltyEnabled ? Math.floor(cartTotal / companySettings.pointsPerAmount) : 0,
      pointsUsed: loyaltyPointsUsed,
      items: cart.map(line => ({ productId: line.product.id, quantity: line.quantity, discount: line.discount })),
    };
    if (method === 'MULTI') {
      payload.splitPayments = [
        ...(Number(paymentForm.cash) > 0 ? [{ method: 'CASH', amount: Number(paymentForm.cash) }] : []),
        ...(Number(paymentForm.card) > 0 ? [{ method: 'CARD', amount: Number(paymentForm.card) }] : []),
        ...(Number(paymentForm.credit) > 0 ? [{ method: 'CREDIT', amount: Number(paymentForm.credit) }] : []),
      ];
    }
    return payload;
  };

  const localSaleFromCart = (method: PaymentMethod, statusName: SaleRecord['status']): SaleRecord => {
    const sale: SaleRecord = {
      id: Date.now(),
      ticket: (statusName === 'Devis' ? 'DEV' : statusName === 'Suspendue' ? 'SUS' : statusName === 'Brouillon' ? 'BR' : 'TCK') + '-' + String(1030 + sales.length + draftSales.length).padStart(4, '0'),
      customer: customer.name,
      total: cartTotal,
      subtotal: cartSubtotal,
      taxTotal: cartTax,
      discountTotal: cartLineDiscount + orderDiscount,
      items: cart.reduce((sum, line) => sum + line.quantity, 0),
      method,
      status: statusName,
      createdAt: 'Maintenant',
      locationId: currentLocationId,
      lines: cart.map(line => {
        const price = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
        return {
          productId: line.product.id,
          variationId: line.variation?.id,
          name: line.variation ? `${line.product.name} (${line.variation.name})` : line.product.name,
          sku: line.variation ? line.variation.sku : line.product.sku,
          quantity: line.quantity,
          unitPrice: price,
          discount: line.discount,
          tvaRate: line.product.tvaRate,
          lineTotal: Math.max(0, (price - line.discount) * line.quantity),
          note: line.note,
        };
      }),
      referenceNote: suspendNote || (selectedTable ? `Table ${selectedTable}` : undefined),
      pointsEarned: companySettings.loyaltyEnabled ? Math.floor(cartTotal / companySettings.pointsPerAmount) : 0,
      pointsUsed: loyaltyPointsUsed,
    };
    if (method === 'MULTI') {
      sale.splitPayments = [
        ...(Number(paymentForm.cash) > 0 ? [{ method: 'CASH' as PaymentMethod, amount: Number(paymentForm.cash) }] : []),
        ...(Number(paymentForm.card) > 0 ? [{ method: 'CARD' as PaymentMethod, amount: Number(paymentForm.card) }] : []),
        ...(Number(paymentForm.credit) > 0 ? [{ method: 'CREDIT' as PaymentMethod, amount: Number(paymentForm.credit) }] : []),
        ...(Number(paymentForm.storeCredit) > 0 ? [{ method: 'STORE_CREDIT' as PaymentMethod, amount: Number(paymentForm.storeCredit) }] : []),
      ];
    }
    return sale;
  };

  const recordDraft = async (statusName: SaleRecord['status']) => {
    if (!cart.length) return;
    const apiStatus = statusName === 'Suspendue' ? 'SUSPENDED' : statusName === 'Devis' ? 'QUOTE' : 'DRAFT';
    try {
      const response = await apiFetch(`/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload('MULTI', apiStatus)),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Erreur ticket');
      const saved = await response.json();
      setDraftSales(current => [saved, ...current]);
      setSales(current => [saved, ...current]);
      setReceiptSale(saved);
      setCart([]);
      setDiscountRate(0);
      setStatus(`${statusName} ${saved.ticket} enregistre`);
    } catch (error: any) {
      setStatus(error?.message || `Erreur lors de l'enregistrement du ${statusName}`);
    }
    setSuspendModalOpen(false);
    setSuspendNote('');
  };

  const resumeSale = (sale: SaleRecord) => {
    setCart((sale.lines || []).map(line => {
      const product = products.find(p => p.id === line.productId) || {
        id: line.productId,
        name: line.name,
        sku: line.sku,
        salePrice: line.unitPrice,
        tvaRate: line.tvaRate,
        barcode: '', type: 'RETAIL' as ProductType, category: 'General', brand: null, imageUrl: '', purchasePrice: 0, trackStock: false, lowStockAlert: 0, stock: 0, isKitchenItem: false, isActive: true, isVariable: false
      };
      let variation = undefined;
      if (line.variationId && product.isVariable) {
         variation = product.variations?.find(v => v.id === line.variationId);
      }
      const uniqueId = variation ? `${product.id}-${variation.id}` : `${product.id}`;
      const defaultPrice = variation ? variation.salePrice : product.salePrice;
      return { product, variation, uniqueId, quantity: line.quantity, discount: line.discount, customPrice: line.unitPrice !== defaultPrice ? line.unitPrice : undefined, note: line.note };
    }));
    const foundContact = contacts.find(c => c.name === sale.customer);
    if (foundContact) setCustomer(foundContact);
    if (sale.referenceNote?.startsWith('Table ')) {
      setSelectedTable(sale.referenceNote.replace('Table ', ''));
    }
    
    // Remove from draft state so we don't duplicate it if they save again
    setDraftSales(current => current.filter(s => s.id !== sale.id));
    setSales(current => current.filter(s => s.id !== sale.id));
    
    setTransactionsModalOpen(false);
    setPage('POS');
    setStatus(`Ticket ${sale.ticket} repris`);
  };

  const handleLoadToCart = (sale: SaleRecord) => {
    if (cart.length > 0 && !confirm("Le panier actuel n'est pas vide. Voulez-vous le remplacer ?")) {
      return;
    }
    const newCart: CartLine[] = sale.lines ? 
      sale.lines.map(line => {
        const product = products.find(p => p.id === line.productId);
        if (!product) return null;
        let variation = undefined;
        if (product.isVariable && product.variations && line.sku !== product.sku) {
          variation = product.variations.find(v => v.sku === line.sku);
        }
        return { product, quantity: line.quantity, discount: 0, variation, customPrice: line.unitPrice } as CartLine;
      }).filter(Boolean) as CartLine[]
    : [];
    
    setCart(newCart);
    const savedCustomer = contacts.find(c => c.name === sale.customer);
    if (savedCustomer) setCustomer(savedCustomer);
    
    setDiscountRate(sale.discountTotal ? Math.round((sale.discountTotal / (sale.total + sale.discountTotal)) * 100) : 0);
    setLoyaltyPointsUsed(sale.pointsUsed || 0);
    
    setReceiptSale(null);
    setPage('POS');
  };

  const handleReturnSale = (saleId: number) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale || sale.status !== 'Payee') return;

    // 1. Update sale status
    setSales(current => current.map(s => s.id === saleId ? { ...s, status: 'Retour' } : s));

    // 2. Restore product stock
    if (sale.lines) {
      setProducts(current => current.map(p => {
        const line = sale.lines?.find(l => l.productId === p.id);
        if (line && p.trackStock) {
          return { ...p, stock: p.stock + line.quantity };
        }
        return p;
      }));
    }

    // 3. Revert customer balance / loyalty points
    if (sale.customer !== 'Client comptoir') {
      setContacts(current => current.map(c => {
        if (c.name === sale.customer) {
          return {
            ...c,
            rewardPoints: Math.max(0, (c.rewardPoints || 0) - (sale.pointsEarned || 0) + (sale.pointsUsed || 0)),
            // Revert balance if sale had credit
            balance: sale.method === 'CREDIT' ? Math.max(0, c.balance - sale.total) : 
                     (sale.splitPayments?.find(p => p.method === 'CREDIT')?.amount ? 
                       Math.max(0, c.balance - (sale.splitPayments.find(p => p.method === 'CREDIT')?.amount || 0)) : c.balance)
          };
        }
        return c;
      }));
    }

    // 4. Revert register cash if it was CASH payment
    if (sale.method === 'CASH') {
      const currentCash = parseFloat(actualCash || '0');
      setActualCash((currentCash - sale.total).toString());
    }

    setStatus(`Vente ${sale.ticket} retournée.`);
    setReceiptSale(null);
  };

  const getSalePaidAmount = (sale: SaleRecord) => {
    if (!sale.splitPayments?.length) {
      return sale.status === 'Payee' ? sale.total : 0;
    }
    return sale.splitPayments
      .filter(payment => payment.method !== 'CREDIT')
      .reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getSaleDueAmount = (sale: SaleRecord) => Math.max(0, sale.total - getSalePaidAmount(sale));
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
  const latestDraftLikeSale = sales.find(sale => ['Suspendue', 'Brouillon', 'Devis'].includes(sale.status));

  const openSaleSettlement = (sale: SaleRecord) => {
    const due = getSaleDueAmount(sale);
    setSettlingSale(sale);
    setSaleSettlementForm({ amount: due > 0 ? due.toFixed(2) : '', method: 'CASH' });
  };

  const closeSaleSettlement = () => {
    setSettlingSale(null);
    setSaleSettlementForm({ amount: '', method: 'CASH' });
  };

  const submitSaleSettlement = () => {
    if (!settlingSale) return;

    const amount = Number(saleSettlementForm.amount || 0);
    const dueBefore = getSaleDueAmount(settlingSale);
    if (amount <= 0) {
      setStatus('Veuillez saisir un montant valide pour encaisser ce ticket.');
      return;
    }
    if (amount > dueBefore) {
      setStatus(`Le montant depasse le reste a regler (${formatMoney(dueBefore)}).`);
      return;
    }

    setSales(current =>
      current.map(sale => {
        if (sale.id !== settlingSale.id) return sale;
        const nextSplitPayments = [...(sale.splitPayments || []), { method: saleSettlementForm.method, amount }];
        const nextPaid = nextSplitPayments
          .filter(payment => payment.method !== 'CREDIT')
          .reduce((sum, payment) => sum + payment.amount, 0);
        const nextDue = Math.max(0, sale.total - nextPaid);
        return {
          ...sale,
          method: nextSplitPayments.length > 1 ? 'MULTI' : saleSettlementForm.method,
          splitPayments: nextSplitPayments,
          status: nextDue <= 0.009 ? 'Payee' : 'Credit',
        };
      })
    );

    if (settlingSale.customer !== 'Client comptoir') {
      setContacts(current =>
        current.map(contact =>
          contact.name === settlingSale.customer
            ? { ...contact, balance: Math.max(0, contact.balance - amount) }
            : contact
        )
      );
      if (customer.name === settlingSale.customer) {
        setCustomer(current => ({ ...current, balance: Math.max(0, current.balance - amount) }));
      }
    }

    if (saleSettlementForm.method === 'CASH') {
      setActualCash((Number(actualCash || '0') + amount).toString());
    }

    const remaining = Math.max(0, dueBefore - amount);
    setStatus(
      remaining <= 0.009
        ? `Ticket ${settlingSale.ticket} entierement encaisse.`
        : `Encaissement de ${formatMoney(amount)} enregistre sur ${settlingSale.ticket}. Reste: ${formatMoney(remaining)}.`
    );
    closeSaleSettlement();
  };

  const handleReturnPurchase = (purchaseId: number) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase || purchase.status === 'Retour') return;

    // 1. Update purchase status
    setPurchases(current => current.map(p => p.id === purchaseId ? { ...p, status: 'Retour' } : p));

    // 2. Deduct product stock
    if (purchase.lines) {
      setProducts(current => current.map(prod => {
        const line = purchase.lines?.find(l => l.productId === prod.id);
        if (line && prod.trackStock) {
          return { ...prod, stock: prod.stock - line.quantity };
        }
        return prod;
      }));
    }

    setStatus(`Achat ${purchase.reference} retourné.`);
  };

  const completeSale = async (method: PaymentMethod) => {
    if (!cart.length) return;
    
    // Calculate points to earn
    const pointsEarned = companySettings.loyaltyEnabled ? Math.floor(cartTotal / companySettings.pointsPerAmount) : 0;
    
    // Update local contact points
    if (customer.name !== 'Client comptoir' && (pointsEarned > 0 || loyaltyPointsUsed > 0)) {
      setContacts(current => current.map(c => 
        c.name === customer.name 
          ? { ...c, rewardPoints: Math.max(0, (c.rewardPoints || 0) + pointsEarned - loyaltyPointsUsed) } 
          : c
      ));
      if (customer.name !== 'Client comptoir') {
         setCustomer(c => ({...c, rewardPoints: Math.max(0, (c.rewardPoints || 0) + pointsEarned - loyaltyPointsUsed)}));
      }
    }

    try {
      const response = await apiFetch(`/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload(method, 'FINAL')),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Erreur validation vente');
      const saved = await response.json();
      // Ensure backend returns points or we patch them in for receipt
      saved.pointsEarned = pointsEarned;
      saved.pointsUsed = loyaltyPointsUsed;
      
      setSales(current => [saved, ...current]);
      setReceiptSale(saved);
      setCart([]);
      setDiscountRate(0);
      setLoyaltyPointsUsed(0);
      setStatus(`Vente ${saved.ticket} enregistree`);
      await loadProducts();
      setPage('Ventes');
    } catch (error: any) {
      setStatus(error?.message || `Erreur: Impossible d'enregistrer la vente`);
    }
  };

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.salePrice.trim()) {
      setStatus('Nom et prix de vente obligatoires');
      return;
    }
    setLoading(true);
    const payload: ProductForm = {
      ...form,
      type: restaurantEnabled ? form.type : (form.type === 'MENU_ITEM' || form.type === 'INGREDIENT' ? 'RETAIL' : form.type),
      isKitchenItem: restaurantEnabled && form.type === 'MENU_ITEM' && form.isKitchenItem,
    };
    try {
      const response = await apiFetch(`/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Erreur creation produit');
      const created = await response.json();
      setProducts(current => [created, ...current]);
      resetProductForm();
      setStatus('Produit ajoute');
      setProductModalOpen(false);
    } catch (error: any) {
      setStatus(error?.message || 'Erreur de connexion a l\'API');
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => {
    const dashboardBaseSales = dashboardLocationFilter === 'ALL'
      ? sales
      : sales.filter(s => s.locationId === dashboardLocationFilter);
    const dashboardFilteredSales = dashboardBaseSales.filter(sale => matchesPeriod(sale.createdAt, dashboardPeriod));

    const dashPaidSales = dashboardFilteredSales.filter(s => s.status === 'Payee');
    const dashCreditSales = dashboardFilteredSales.filter(s => s.status === 'Credit');
    const dashRevenue = dashPaidSales.reduce((sum, sale) => sum + sale.total, 0);

    const dashboardVisibleProducts = visibleProducts;
    const dashboardLowStockProducts = lowStockProducts;
    const totalPurchases = dashboardVisibleProducts.reduce((sum, p) => sum + (p.purchasePrice * (p.trackStock ? p.stock : 1)), 0);
    const stockValue = dashboardVisibleProducts.reduce((sum, p) => sum + (p.salePrice * (p.trackStock ? p.stock : 0)), 0);
    const totalCreditDue = dashCreditSales.reduce((sum, s) => sum + getSaleDueAmount(s), 0);
    const totalSellReturn = dashboardFilteredSales.filter(s => s.status === 'Retour').reduce((sum, sale) => sum + sale.total, 0);
    const dashboardFilteredExpenses = (dashboardLocationFilter === 'ALL'
      ? expenses
      : expenses.filter(e => e.locationId === dashboardLocationFilter)).filter(expense => matchesPeriod(expense.date, dashboardPeriod));
    const totalExpenses = dashboardFilteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const salesByDate = dashboardFilteredSales.reduce((acc, sale) => {
      if (sale.status !== 'Payee') return acc;
      const dateKey = sale.createdAt.split(' ')[0] || 'Aujourd';
      acc[dateKey] = (acc[dateKey] || 0) + sale.total;
      return acc;
    }, {} as Record<string, number>);
    const chartData = Object.keys(salesByDate).map(date => ({
      name: date,
      ventes: salesByDate[date]
    }));
    if (chartData.length === 0) {
      chartData.push({ name: 'Lun', ventes: 120 }, { name: 'Mar', ventes: 350 }, { name: 'Mer', ventes: 280 }, { name: 'Jeu', ventes: 450 }, { name: 'Ven', ventes: 390 }, { name: 'Sam', ventes: 600 });
    }

    return (
    <>
      {/* Welcome header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1.5rem 2rem', borderRadius: '18px', background: 'linear-gradient(135deg, #050b16, #0d1b2a)', color: '#fff' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>Bienvenue, Administrateur</h1>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,.6)', fontSize: '13px', fontWeight: 600 }}>
            Voici un apercu de votre activite commerciale pour{' '}
            <strong style={{ color: '#fff' }}>
              {dashboardPeriod === 'today'
                ? "aujourd'hui"
                : dashboardPeriod === 'week'
                  ? 'cette semaine'
                  : dashboardPeriod === 'month'
                    ? 'ce mois'
                    : dashboardPeriod === 'year'
                      ? 'cette annee'
                      : 'toute la periode'}
            </strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[{ id: 'today', label: "Aujourd'hui" }, { id: 'week', label: 'Semaine' }, { id: 'month', label: 'Mois' }, { id: 'year', label: 'Annee' }, { id: 'all', label: 'Tout' }].map(period => (
            <button
              key={period.id}
              className={dashboardPeriod === period.id ? 'primary-action' : 'ghost-action'}
              onClick={() => setDashboardPeriod(period.id as 'today' | 'week' | 'month' | 'year' | 'all')}
              style={{ minWidth: '84px', justifyContent: 'center' }}
            >
              {period.label}
            </button>
          ))}
          <button className="primary-action" onClick={() => setPage('POS')}><ReceiptText size={16} /> Ouvrir POS</button>
        </div>
      </div>

      {/* Row 1 - 4 KPI cards (like UltimatePOS top row) */}
      <section className="metric-grid">
        <Metric title="Total des ventes" value={formatMoney(dashRevenue)} detail={`${dashPaidSales.length} ventes payees`} tone="blue" icon={ShoppingCart} />
        <Metric title="Revenu net" value={formatMoney(dashRevenue - totalSellReturn - totalExpenses)} detail="Ventes - retours - depenses" tone="green" icon={Banknote} />
        <Metric title="Factures en attente" value={formatMoney(totalCreditDue)} detail={`${dashCreditSales.length} factures crédit`} tone="orange" icon={FileText} />
        <Metric title="Retours de vente" value={formatMoney(totalSellReturn)} detail="Total retours" tone="violet" icon={RotateCcw} />
      </section>

      {/* Row 2 - 4 more KPI cards (like UltimatePOS second row) */}
      <section className="metric-grid" style={{ marginBottom: '1rem' }}>
        <Metric title="Total achats" value={formatMoney(totalPurchases)} detail={`${dashboardVisibleProducts.length} articles`} tone="blue" icon={TrendingUp} />
        <Metric title="Achats en attente" value={formatMoney(0)} detail="Aucun fournisseur en retard" tone="orange" icon={AlertTriangle} />
        <Metric title="Valeur du stock" value={formatMoney(stockValue)} detail={`${dashboardLowStockProducts.length} alertes`} tone="green" icon={Warehouse} />
        <Metric title="Dépenses" value={formatMoney(totalExpenses)} detail="Pas encore de données" tone="violet" icon={Banknote} />
      </section>

      {/* Full-width chart - Sells last 30 days (like UltimatePOS) */}
      <section style={{ marginBottom: '1rem' }}>
        <div className="panel wide-panel" style={{ width: '100%', padding: '1.5rem' }}>
          <div className="panel-title compact" style={{ marginBottom: '1.5rem' }}><div><p>Ventes</p><h2>Ventes de la periode</h2></div><span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{formatMoney(dashPaidSales.reduce((s, sale) => s + sale.total, 0))} Total</span></div>
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="ventes" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorVentes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Sales & Purchase payment dues tables (like UltimatePOS side-by-side) */}
      <section className="workspace-grid" style={{ marginBottom: '1rem' }}>
        <div className="panel wide-panel">
          <div className="panel-title compact"><div><p>Paiements</p><h2>Factures client en attente</h2></div><button onClick={() => setPage('Paiements')}>Tout voir</button></div>
          {dashCreditSales.length > 0 ? (
            <div className="cart-table" style={{ maxHeight: '260px', overflow: 'auto' }}>
              <div className="data-head" style={{ gridTemplateColumns: '1fr 1fr .7fr' }}><span>Client</span><span>Ticket</span><span>Montant dû</span></div>
              {dashCreditSales.slice().sort((left, right) => getSaleDueAmount(right) - getSaleDueAmount(left)).slice(0, 6).map(sale => (
                <div className="data-row" key={sale.id} style={{ gridTemplateColumns: '1fr 1fr .7fr', cursor: 'pointer' }} onClick={() => setReceiptSale(sale)}>
                  <span><strong>{sale.customer}</strong></span>
                  <span>{sale.ticket}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatMoney(getSaleDueAmount(sale))}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Aucune facture en attente.</div>}
        </div>
        <div className="panel">
          <div className="panel-title compact"><div><p>Priorite</p><h2>Actions rapides</h2></div></div>
          <div className="action-list">
            <button onClick={() => setPage('POS')}><ReceiptText size={17} /> Ouvrir le POS</button>
            <button onClick={() => { resetProductForm(); setProductModalOpen(true); }}><Plus size={17} /> Ajouter un produit</button>
            <button onClick={() => setPage('Clients')}><Users size={17} /> Gérer les clients</button>
            <button onClick={() => setPage('Stock')}><Warehouse size={17} /> Alertes de stock</button>
            <button onClick={() => setPage('Rapports')}><TrendingUp size={17} /> Voir les rapports</button>
          </div>
        </div>
      </section>

      {/* Stock Alerts table (like UltimatePOS) */}
      <section style={{ marginBottom: '1rem' }}>
        <div className="panel" style={{ width: '100%' }}>
          <div className="panel-title compact"><div><p>Stock</p><h2>Alertes de stock ({dashboardLowStockProducts.length})</h2></div><button onClick={() => setPage('Stock')}>Tout voir</button></div>
          {dashboardLowStockProducts.length > 0 ? (
            <div className="cart-table" style={{ maxHeight: '240px', overflow: 'auto' }}>
              <div className="data-head" style={{ gridTemplateColumns: '1.5fr 1fr .7fr' }}><span>Produit</span><span>Catégorie</span><span>Stock</span></div>
              {dashboardLowStockProducts.slice(0, 8).map(p => (
                <div className="data-row" key={p.id} style={{ gridTemplateColumns: '1.5fr 1fr .7fr' }}>
                  <span><strong>{p.name}</strong><small>{p.sku}</small></span>
                  <span>{p.category}</span>
                  <span className="stock-warn">{p.stock}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Aucune alerte de stock.</div>}
        </div>
      </section>

      {/* Recent Sales (like UltimatePOS recent transactions) */}
      <section>
        <div className="panel" style={{ width: '100%' }}>
          <div className="panel-title compact"><div><p>Activite</p><h2>Ventes recentes</h2></div><button onClick={() => setPage('Ventes')}>Tout voir</button></div>
          <RecordTable sales={dashboardFilteredSales.slice(0, 5)} onOpenReceipt={setReceiptSale} onOpenInvoice={setInvoiceSale} onResumeSale={resumeSale} onSettleSale={openSaleSettlement} />
        </div>
      </section>
    </>
    );
  };

  const registerProducts = visibleProducts.filter(product => {
    const matchCategory = selectedCategory === 'Tous' || product.category === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [product.name, product.sku, product.barcode || '', product.category].some(value => value.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  const renderRegister = () => {
    return (
    <section className="pos-workspace">
      {selectedVariableProduct && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setSelectedVariableProduct(null); }}>
          <section className="receipt-panel" style={{ maxWidth: '500px', width: '95%' }}>
            <div className="receipt-header"><div><p>Declinaisons</p><h2>{selectedVariableProduct.name}</h2></div><button onClick={() => setSelectedVariableProduct(null)}><XCircle size={18} /></button></div>
            <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              <p style={{ color: '#64748b', margin: 0 }}>Selectionnez la variation a ajouter au panier :</p>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {selectedVariableProduct.variations?.map(variation => (
                  <button key={variation.id} className="ghost-action" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', textAlign: 'left', width: '100%' }} onClick={() => addToCart(selectedVariableProduct, variation)}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>{variation.name}</strong>
                      <small style={{ color: '#64748b' }}>Stock: {selectedVariableProduct.trackStock ? variation.stock : '-'}</small>
                    </div>
                    <span style={{ fontWeight: 700, color: '#3b82f6' }}>{formatMoney(variation.salePrice)}</span>
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
                  setRegisterDetails({ openedAt: new Date().toLocaleString('fr-FR'), initialCash: amount, openedId: session.id });
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
        <div className="workflow-card">
          <span className="workflow-label">Client actif</span>
          <strong>{customer.name}</strong>
          <small>{customer.balance > 0 ? `Solde ${formatMoney(customer.balance)}` : 'Pret pour une vente comptoir ou compte client'}</small>
          <div className="workflow-actions">
            <button className="ghost-action" type="button" onClick={() => setCustomerModalOpen(true)}><Plus size={14} /> Nouveau client</button>
            <button className="ghost-action" type="button" onClick={() => setPage('Clients')}><Users size={14} /> Portefeuille</button>
          </div>
        </div>
        <div className="workflow-card">
          <span className="workflow-label">Scan et recherche</span>
          <strong>{search ? `Recherche: ${search}` : 'Scanner ou taper un produit'}</strong>
          <small>{status || 'Le lecteur code-barres peut ajouter directement au panier hors champ de saisie.'}</small>
          <div className="workflow-actions">
            <button className="ghost-action" type="button" onClick={() => productSearchInputRef.current?.focus()}><Search size={14} /> Focus recherche</button>
            <button className="ghost-action" type="button" onClick={() => setPage('Produits')}><Package size={14} /> Catalogue</button>
          </div>
        </div>
        <div className="workflow-card">
          <span className="workflow-label">Workflow ticket</span>
          <strong>{cart.length ? `${cart.length} ligne(s) dans le panier` : 'Panier vide'}</strong>
          <small>{latestDraftLikeSale ? 'Dernier ticket a reprendre : ' + latestDraftLikeSale.ticket + ' - ' + latestDraftLikeSale.customer : 'Brouillon, devis et suspension restent visibles sans descendre jusqu au pied de page.'}</small>
          <div className="workflow-actions">
            <button className="ghost-action" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Brouillon'); setSuspendModalOpen(true); }}><FileText size={14} /> Brouillon</button>
            <button className="ghost-action" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Devis'); setSuspendModalOpen(true); }}><FileText size={14} /> Devis</button>
            <button className="ghost-action" type="button" disabled={!cart.length} onClick={() => { setSuspendType('Suspendue'); setSuspendModalOpen(true); }}><Pause size={14} /> Suspendre</button>
            <button className="ghost-action" type="button" onClick={() => { setTransactionsTab('Suspendues'); setTransactionsModalOpen(true); }}><Clock size={14} /> Historique</button>
          </div>
        </div>
        <div className="workflow-card workflow-card-highlight">
          <span className="workflow-label">Finalisation</span>
          <strong>{formatMoney(cartTotal)}</strong>
          <small>{(!currentUser || rolePermissions[currentUser.role]?.includes('ACTION:OVERRIDE_PRICE')) ? 'Remise et prix peuvent etre ajustes avant encaissement.' : 'Encaissement direct avec controles de role appliques.'}</small>
          <div className="workflow-actions">
            <button className="ghost-action" type="button" onClick={() => orderDiscountInputRef.current?.focus()}><Percent size={14} /> Remise</button>
            <button className="primary-action" type="button" disabled={!cart.length} onClick={() => { setPaymentForm({ cash: String(cartTotal), card: '0', credit: '0', storeCredit: '0' }); setPaymentModalOpen(true); }}><CreditCard size={14} /> Encaisser</button>
          </div>
        </div>
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
          <div className="pos-search-row" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#fff', borderTopRightRadius: '16px' }}>
            <div className="customer-picker">
          <Users size={16} />
          <div className="customer-picker-main">
            <select value={customer.id} onChange={e => setCustomer(contacts.find(c => c.id === Number(e.target.value)) || contacts[0])}>
              {contacts.filter(c => c.type.includes('Client')).map(c => <option key={c.id} value={c.id}>{c.name}{c.balance > 0 ? ` (${formatMoney(c.balance)})` : ''}</option>)}
            </select>
            <small className="credit-info">
              Solde {formatMoney(customer.balance)}
              {customer.creditLimit > 0 ? ` * Plafond ${formatMoney(customer.creditLimit)}` : ''}
            </small>
          </div>
          <button type="button" onClick={() => setCustomerModalOpen(true)}><Plus size={14} /></button>
        </div>
          </div>
          <div className="cart-table">
            <div className="cart-head"><span>Produit</span><span>Qte</span><span>Prix</span><span>Remise</span><span>Total</span><span /></div>
            {cart.length === 0 ? <div className="pos-empty"><ShoppingCart size={34} /><strong>Votre panier est vide</strong><span>Scannez un code-barres ou cliquez sur un produit.</span></div> : cart.map(line => {
              const currentPrice = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
              const lineNet = Math.max(0, (currentPrice - line.discount) * line.quantity);
              return <div className="cart-row" key={line.uniqueId}>
                <span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{line.product.name} {line.variation && <span style={{ color: '#3b82f6' }}>({line.variation.name})</span>} {(!currentUser || rolePermissions[currentUser.role]?.includes('ACTION:OVERRIDE_PRICE')) && <button className="ghost-action" onClick={() => { setEditingLineId(line.uniqueId); setEditLineForm({ price: String(currentPrice), discount: String(line.discount), note: line.note || '' }); }} style={{ padding: '2px' }}><Edit2 size={13} /></button>}</strong>
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

          <div className="pos-totals-strip">
            <div><span>Sous-total</span><strong>{formatMoney(cartSubtotal)}</strong></div>
            <div><span>Remise lignes</span><strong>{formatMoney(cartLineDiscount)}</strong></div>
            <label><Percent size={15} /><span>Remise</span><input ref={orderDiscountInputRef} value={discountRate} onChange={event => setDiscountRate(Math.max(0, Math.min(100, Number(event.target.value || 0))))} inputMode="decimal" /></label>
            <div><span>TVA</span><strong>{formatMoney(cartTax)}</strong></div>
            <div className="grand-total"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
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
        <button disabled={!cart.length} className="primary-action" onClick={() => {
          setPaymentForm({ cash: String(cartTotal), card: '0', credit: '0', storeCredit: '0' });
          setPaymentModalOpen(true);
        }} style={{ flex: 2, fontSize: '1.1rem' }}>Payer {formatMoney(cartTotal)}</button>
        <button className="recent" onClick={() => setTransactionsModalOpen(true)}><Clock size={16} /> Transactions</button>
      </div>
        </div>
      </div>
      
      {customerModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setCustomerModalOpen(false); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={submitContact} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Client</p><h2>Nouveau client</h2></div><button type="button" onClick={() => setCustomerModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <label><span>Nom complet *</span><input value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} placeholder="Ex: Jean Dupont" autoFocus /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <label><span>Téléphone</span><input value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} placeholder="+212 6..." /></label>
                  <label><span>Plafond de crédit (MAD)</span><input value={contactForm.creditLimit} onChange={e => setContactForm({...contactForm, creditLimit: e.target.value})} inputMode="decimal" placeholder="0.00" /></label>
                </div>
                <label><span>Adresse</span><input value={contactForm.address} onChange={e => setContactForm({...contactForm, address: e.target.value})} placeholder="Adresse complète" /></label>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setCustomerModalOpen(false)} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        const shiftSales = sales.filter(s => s.status === 'Payee' && s.id >= registerDetails.openedId);
        const cashSalesToday = shiftSales.filter(s => s.method === 'CASH' || s.method === 'MULTI').reduce((sum, s) => {
          if (s.method === 'CASH') return sum + s.total;
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


  const salePreview = Number(form.salePrice || 0);
  const purchasePreview = Number(form.purchasePrice || 0);
  const tvaPreview = Number(form.tvaRate || 0);
  const marginPreview = salePreview - purchasePreview;
  const priceWithTaxPreview = salePreview * (1 + tvaPreview / 100);

  const renderProducts = () => (
    <>
      <PageHeader 
        title="Produits & Services" 
        subtitle="Catalogue, codes-barres et stock" 
        action={<button type="button" className="primary-action" onClick={() => { resetProductForm(); setProductModalOpen(true); }}><Plus size={16} /> Nouveau Produit</button>}
      />

      {productModalOpen && (
        <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setProductModalOpen(false); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
            <section className="product-workspace" style={{ margin: 0 }}>
              <form className="product-form-panel" onSubmit={submitProduct}>
                <div className="panel-title"><div><p>Produit</p><h2>Fiche courte, champs utiles d'abord</h2></div><button type="button" onClick={() => setProductModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>

          <div className="field-cluster primary-product-fields">
            <label><span>Nom du produit</span><input value={form.name} onChange={event => { const name = event.target.value; setForm(current => { const currentSku = String(current.sku || '').trim(); const nextAutoSku = deriveSkuFromName(name); const keepSku = manualSkuRef.current && currentSku ? currentSku : nextAutoSku; autoSkuRef.current = nextAutoSku; return { ...current, name, sku: keepSku }; }); }} placeholder="Ex: Bouteille eau 50cl" /></label>
            <label><span>Code-barres</span><input value={form.barcode} onChange={event => updateForm('barcode', event.target.value)} placeholder="Scanner ou saisir" /></label>
            <label><span>SKU</span><input value={form.sku} onChange={event => { const sku = event.target.value; manualSkuRef.current = sku.trim().length > 0; if (!manualSkuRef.current) { const nextAutoSku = deriveSkuFromName(form.name); autoSkuRef.current = nextAutoSku; updateForm('sku', nextAutoSku); return; } updateForm('sku', sku); }} placeholder="Auto si vide" /></label>
          </div>

          <div className="field-cluster product-taxonomy-fields">
            <label><span>Categorie</span><input value={form.categoryName} onChange={event => updateForm('categoryName', event.target.value)} placeholder="Boissons" /></label>
            <label><span>Marque</span><input value={form.brandName} onChange={event => updateForm('brandName', event.target.value)} placeholder="Optionnel" /></label>
            <label><span>Unite</span><input value={form.unitName} onChange={event => updateForm('unitName', event.target.value)} placeholder="pcs, kg, L" /></label>
          </div>

          <div className="field-cluster product-price-fields">
            <label><span>Prix de vente HT</span><input value={form.salePrice} onChange={event => updateForm('salePrice', event.target.value)} inputMode="decimal" placeholder="12.00" /></label>
            <label><span>Prix achat</span><input value={form.purchasePrice} onChange={event => updateForm('purchasePrice', event.target.value)} inputMode="decimal" /></label>
            <label><span>TVA %</span><input value={form.tvaRate} onChange={event => updateForm('tvaRate', event.target.value)} inputMode="decimal" /></label>
            <label><span>Stock initial</span><input value={form.initialStock} onChange={event => updateForm('initialStock', event.target.value)} inputMode="decimal" /></label>
            <label><span>Alerte stock</span><input value={form.lowStockAlert} onChange={event => updateForm('lowStockAlert', event.target.value)} inputMode="decimal" /></label>
          </div>

          <div className="product-photo-row">
            <label className="product-photo-picker">
              <span>Photo produit</span>
              <input type="file" accept="image/*" onChange={event => handleProductPhoto(event.target.files?.[0])} />
              <b><ImageIcon size={16} /> Ajouter une photo</b>
            </label>
            <label><span>URL image</span><input value={form.imageUrl} onChange={event => updateForm('imageUrl', event.target.value)} placeholder="Coller une URL ou charger une image" /></label>
          </div>

          <div className="mode-row product-type-row">{visibleTypes.map(type => <button type="button" className={form.type === type ? 'selected' : ''} onClick={() => updateForm('type', type)} key={type}>{typeLabel[type]}</button>)}</div>
          <div className="checks-row product-checks">
            <label><input type="checkbox" checked={form.isVariable} onChange={event => updateForm('isVariable', event.target.checked)} /> Produit avec déclinaisons</label>
            <label><input type="checkbox" checked={form.trackStock} onChange={event => updateForm('trackStock', event.target.checked)} /> Suivre le stock</label>
            {restaurantEnabled && <label><input type="checkbox" checked={form.isKitchenItem} onChange={event => updateForm('isKitchenItem', event.target.checked)} disabled={form.type !== 'MENU_ITEM'} /> Envoyer en cuisine</label>}
          </div>

          {form.isVariable && (
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#0f172a' }}>Options et Déclinaisons</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="ghost-action" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => {
                    const options = prompt('Entrez les options séparées par des virgules (ex: Taille, Couleur)');
                    if (options) {
                      updateForm('variationOptions', options.split(',').map(s => s.trim()).filter(Boolean));
                    }
                  }}>
                    <Edit2 size={14} style={{ marginRight: '4px' }} /> Définir les Options
                  </button>
                  <button type="button" className="secondary-action" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => updateForm('variations', [...form.variations, { name: '', sku: '', salePrice: form.salePrice, purchasePrice: form.purchasePrice, stock: '0', lowStockAlert: '0', barcode: '' }])}>
                    <Plus size={14} style={{ marginRight: '4px' }} /> Ajouter
                  </button>
                </div>
              </div>
              
              {form.variationOptions && form.variationOptions.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e0f2fe', borderRadius: '8px', fontSize: '0.9rem', color: '#0369a1' }}>
                  <strong>Options définies :</strong> {form.variationOptions.join(' e ')}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {form.variations.map((v, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center' }}>
                    <input value={v.name} onChange={e => { const nv = [...form.variations]; nv[i].name = e.target.value; updateForm('variations', nv); }} placeholder={form.variationOptions?.length ? form.variationOptions.join(' - ') : "Nom (ex: Rouge L)"} style={{ padding: '0.5rem' }} />
                    <input value={v.sku} onChange={e => { const nv = [...form.variations]; nv[i].sku = e.target.value; updateForm('variations', nv); }} placeholder="SKU" style={{ padding: '0.5rem' }} />
                    <input value={v.salePrice} onChange={e => { const nv = [...form.variations]; nv[i].salePrice = e.target.value; updateForm('variations', nv); }} placeholder="Prix vente" style={{ padding: '0.5rem' }} inputMode="decimal" />
                    <input value={v.purchasePrice} onChange={e => { const nv = [...form.variations]; nv[i].purchasePrice = e.target.value; updateForm('variations', nv); }} placeholder="Prix achat" style={{ padding: '0.5rem' }} inputMode="decimal" />
                    <input value={v.stock} onChange={e => { const nv = [...form.variations]; nv[i].stock = e.target.value; updateForm('variations', nv); }} placeholder="Stock" style={{ padding: '0.5rem' }} inputMode="decimal" />
                    <button type="button" className="icon-danger" onClick={() => { const nv = form.variations.filter((_, idx) => idx !== i); updateForm('variations', nv); }}><XCircle size={16} /></button>
                  </div>
                ))}
                {form.variations.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', padding: '1rem' }}>Aucune déclinaison. Cliquez sur Ajouter.</div>}
              </div>
            </div>
          )}

          <div className="product-form-footer">
            <button className="save-product" type="submit" disabled={loading}><Plus size={18} /> {loading ? 'Ajout...' : 'Ajouter le produit'}</button>
            <button className="secondary-action" type="button" disabled={!form.name && !form.barcode} onClick={async () => { await submitProduct({ preventDefault: () => undefined } as React.FormEvent); setPage('POS'); }}>Ajouter puis vendre</button>
          </div>
        </form>

        <aside className="product-side-panel">
          <div className="product-photo-preview">
            {form.imageUrl ? <img src={form.imageUrl} alt="Apercu produit" /> : <ImageIcon size={34} />}
            <strong>{form.name || 'Photo du produit'}</strong>
          </div>
          <div className="product-preview-card">
            <span>Apercu prix</span>
            <strong>{salePreview ? formatMoney(salePreview) : '0.00 MAD'}</strong>
            <div><small>Prix TTC</small><b>{formatMoney(priceWithTaxPreview || 0)}</b></div>
            <div><small>Marge brute</small><b className={marginPreview >= 0 ? 'positive' : 'negative'}>{formatMoney(marginPreview || 0)}</b></div>
          </div>
        </aside>
            </section>
          </div>
        </div>
      )}

      <div className="table-toolbar product-list-toolbar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '0 2rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher produit, SKU, code-barres..." /></div>
          <div className="filter-row">{(['ALL', ...visibleTypes] as const).map(type => <button className={filter === type ? 'selected' : ''} onClick={() => setFilter(type)} key={type}>{type === 'ALL' ? 'Tous' : typeLabel[type]}</button>)}</div>
        </div>
      </div>
      <ProductsTable products={visibleProducts} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} visibleTypes={visibleTypes} addToCart={addToCart} />
    </>
  );

  const getCustomerTier = (points: number) => {
    if (points >= 5000) return { name: 'Platinum', color: '#8b5cf6', bg: '#ede9fe' };
    if (points >= 2000) return { name: 'Gold', color: '#eab308', bg: '#fef9c3' };
    if (points >= 500) return { name: 'Silver', color: '#94a3b8', bg: '#f1f5f9' };
    return { name: 'Bronze', color: '#d97706', bg: '#fef3c7' };
  };

  const renderContacts = (kind: 'Client' | 'Fournisseur') => {
    const rows = contacts.filter(contact => {
      const matchesKind = kind === 'Client' ? contact.type.includes('Client') : contact.type === 'Fournisseur';
      const q = contactSearch.trim().toLowerCase();
      return matchesKind && (!q || [contact.name, contact.phone, contact.type].some(value => value.toLowerCase().includes(q)));
    });
    return <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={Users}
          title={kind === 'Client' ? 'Portefeuille Clients' : 'Carnet Fournisseurs'} 
          subtitle={`Gérez vos ${kind === 'Client' ? 'clients et leur fidélité' : 'fournisseurs et vos approvisionnements'}`} 
          action={<button className="primary-action"><Plus size={16} style={{ marginRight: '8px' }} /> Nouveau</button>} 
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '0 1.5rem 1.5rem' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}><Search size={17} /><input value={contactSearch} onChange={event => setContactSearch(event.target.value)} placeholder={kind === 'Client' ? 'Rechercher client...' : 'Rechercher fournisseur...'} /></div>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{rows.length}</span>
            <span className="toolbar-stat-label">Total Contacts</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{formatMoney(rows.reduce((sum, c) => sum + c.balance, 0))}</span>
            <span className="toolbar-stat-label">Solde Cumulé</span>
          </div>
        </div>
      </div>
      <div className="data-table">
        <div className="data-head" style={{ gridTemplateColumns: kind === 'Client' ? '2fr 1fr 1fr 1fr 1fr 1fr' : undefined }}>
          <span>Nom</span><span>Type</span><span>Telephone</span><span>Solde</span>{kind === 'Client' ? <span>Fidélité & Crédit</span> : <span>Activite</span>}<span>Actions</span>
        </div>
        {rows.map(contact => {
          const tier = getCustomerTier(contact.rewardPoints || 0);
          const relatedSales = sales.filter(sale => sale.customerId === contact.id || sale.customer === contact.name);
          const openCredits = relatedSales.filter(sale => sale.status === 'Credit');
          const invoiceableSales = relatedSales.filter(sale => sale.status === 'Payee' && !sale.invoiceId);
          const openCreditTotal = openCredits.reduce((sum, sale) => sum + getSaleDueAmount(sale), 0);
          return (
            <div className="data-row" style={{ gridTemplateColumns: kind === 'Client' ? '2fr 1fr 1fr 1fr 1fr 1fr' : undefined }} key={contact.id}>
              <span>
                <strong>{contact.name}</strong>
                <small>#{String(contact.id).padStart(4, '0')}</small>
                {kind === 'Client' && (
                  <span style={{ display: 'inline-block', padding: '0.1rem 0.5rem', background: tier.bg, color: tier.color, borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.25rem' }}>{tier.name}</span>
                )}
              </span>
              <span>{contact.type}</span>
              <span>{contact.phone}</span>
              <span style={{ color: contact.balance > 0 ? '#ef4444' : 'inherit', fontWeight: contact.balance > 0 ? 700 : 400 }}>{formatMoney(contact.balance)}</span>
              {kind === 'Client' ? 
                <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <strong style={{ color: '#3b82f6' }}>{contact.rewardPoints || 0} pts</strong>
                  <small style={{ color: '#10b981', fontWeight: 600 }}>Credit magasin: {formatMoney(contact.storeCredit || 0)}</small>
                  <small style={{ color: openCredits.length > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                    {openCredits.length > 0 ? `${openCredits.length} ticket(s) en attente - ${formatMoney(openCreditTotal)}` : 'Aucun credit ouvert'}
                  </small>
                  <small style={{ color: '#7c3aed', fontWeight: 600 }}>
                    {invoiceableSales.length > 0 ? `${invoiceableSales.length} ticket(s) a facturer` : 'Pas de ticket a facturer'}
                  </small>
                </span> 
                : <span>{contact.lastActivity}</span>}
              <span style={{ display: 'flex', gap: '0.5rem' }}>
                {contact.balance > 0 && <button className="row-action" onClick={() => { setSettlingContact(contact); setSettlementAmount(String(contact.balance)); }} style={{ color: '#10b981', background: '#d1fae5', border: 'none' }}>Regler</button>}
                {kind === 'Client' && <button className="row-action" onClick={() => openCustomerInvoiceFlow(contact)} style={{ color: '#7c3aed', background: '#f3e8ff', border: 'none' }}>Facturer</button>}
                {kind === 'Client' && <button className="row-action" onClick={() => { setTopupContact(contact); setTopupAmount(''); }} style={{ color: '#3b82f6', background: '#eff6ff', border: 'none' }}>Recharger</button>}
                {kind === 'Client' && <button className="row-action" onClick={() => { setMessageContact(contact); setMessageContent(''); }} style={{ color: '#8b5cf6', background: '#ede9fe', border: 'none' }}><Mail size={14} /></button>}
              </span>
            </div>
          );
        })}
      </div>

      {settlingContact && (
        <div className="receipt-backdrop" style={{ zIndex: 60 }} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) { setSettlingContact(null); setSettlementAmount(''); } }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={(e) => { 
              e.preventDefault(); 
              const amount = Number(settlementAmount);
              if (amount > 0) {
                // Update Contact Balance
                setContacts(current => current.map(c => c.id === settlingContact.id ? { ...c, balance: Math.max(0, c.balance - amount) } : c));
                if (customer.id === settlingContact.id) {
                  setCustomer({ ...customer, balance: Math.max(0, customer.balance - amount) });
                }
                // Record Cash Movement
                const currentCash = parseFloat(actualCash || '0');
                setActualCash((currentCash + amount).toString());
                
                setStatus(`Règlement de ${formatMoney(amount)} enregistré pour ${settlingContact.name}`);
                setSettlingContact(null);
                setSettlementAmount('');
              }
            }} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Client</p><h2>Règlement de Crédit</h2></div><button type="button" onClick={() => { setSettlingContact(null); setSettlementAmount(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', textAlign: 'center' }}>
                <strong style={{ display: 'block', color: '#0f172a' }}>{settlingContact.name}</strong>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Solde actuel: <strong style={{ color: '#ef4444' }}>{formatMoney(settlingContact.balance)}</strong></span>
              </div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                <label><span>Montant à régler (MAD)</span><input value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} inputMode="decimal" autoFocus style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', textAlign: 'center' }} /></label>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => { setSettlingContact(null); setSettlementAmount(''); }} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Encaisser</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {settlingSale && (() => {
        const dueAmount = getSaleDueAmount(settlingSale);
        const paidAmount = getSalePaidAmount(settlingSale);
        return (
        <div className="receipt-backdrop" style={{ zIndex: 61 }} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) closeSaleSettlement(); }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '520px', margin: 'auto' }}>
            <form className="product-form-panel" onSubmit={(e) => { e.preventDefault(); submitSaleSettlement(); }} style={{ padding: '2rem' }}>
              <div className="panel-title"><div><p>Vente</p><h2>Encaisser un credit</h2></div><button type="button" onClick={closeSaleSettlement} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>Ticket</span><strong style={{ color: '#0f172a' }}>{settlingSale.ticket}</strong></div>
                <div style={{ background: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>Deja encaisse</span><strong style={{ color: '#0f766e' }}>{formatMoney(paidAmount)}</strong></div>
                <div style={{ background: '#fff7ed', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid #fed7aa' }}><span style={{ display: 'block', fontSize: '0.8rem', color: '#9a3412' }}>Reste a regler</span><strong style={{ color: '#c2410c' }}>{formatMoney(dueAmount)}</strong></div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <strong style={{ display: 'block', color: '#0f172a' }}>{settlingSale.customer}</strong>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{settlingSale.createdAt} ? {formatMoney(settlingSale.total)}</span>
              </div>
              <div className="field-cluster" style={{ gridTemplateColumns: '1.35fr 1fr', gap: '1rem' }}>
                <label><span>Montant a encaisser</span><input value={saleSettlementForm.amount} onChange={e => setSaleSettlementForm(current => ({ ...current, amount: e.target.value }))} inputMode="decimal" autoFocus style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981', textAlign: 'center' }} /></label>
                <label><span>Methode</span><select value={saleSettlementForm.method} onChange={e => setSaleSettlementForm(current => ({ ...current, method: e.target.value as 'CASH' | 'CARD' }))}><option value="CASH">Especes</option><option value="CARD">Carte</option></select></label>
              </div>
              <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="ghost-action" onClick={() => setSaleSettlementForm(current => ({ ...current, amount: dueAmount.toFixed(2) }))}>Montant restant</button>
                <button type="button" className="ghost-action" onClick={() => setSaleSettlementForm(current => ({ ...current, amount: dueAmount > 0 ? (dueAmount / 2).toFixed(2) : '' }))}>Moitie</button>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={closeSaleSettlement} style={{ padding: '0.5rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="primary-action" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Encaisser</button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}
    </section>;
  };

  const renderPurchases = () => {
    const rows = purchases.filter(purchase => {
      if (purchase.locationId && purchase.locationId !== currentLocationId) return false;
      const q = purchaseSearch.trim().toLowerCase();
      return !q || [purchase.reference, purchase.supplier, purchase.status].some(value => value.toLowerCase().includes(q));
    });
    return <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={ShoppingCart}
          title="Achats" 
          subtitle="Réceptions et commandes fournisseurs" 
          action={<button className="primary-action" onClick={() => setPurchaseModalOpen(true)}><Plus size={16} style={{ marginRight: '8px' }} /> Nouvel achat</button>} 
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '0 1.5rem 1.5rem' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}><Search size={17} /><input value={purchaseSearch} onChange={event => setPurchaseSearch(event.target.value)} placeholder="Rechercher achat ou fournisseur..." /></div>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{rows.length}</span>
            <span className="toolbar-stat-label">Commandes</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{formatMoney(rows.reduce((sum, p) => sum + p.total, 0))}</span>
            <span className="toolbar-stat-label">Total Achats</span>
          </div>
        </div>
      </div>
      <div className="data-table">
        <div className="data-head" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr' }}>
          <span>Reference</span><span>Fournisseur</span><span>Total</span><span>Statut</span><span>Date</span><span>Actions</span>
        </div>
        {rows.map(purchase => 
          <div className="data-row" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr' }} key={purchase.id}>
            <span><strong>{purchase.reference}</strong><small>Bon d'achat</small></span>
            <span>{purchase.supplier}</span>
            <span>{formatMoney(purchase.total)}</span>
            <span className={purchase.status === 'Recu' ? 'badge ok' : purchase.status === 'Retour' ? 'badge warn' : 'badge'}>{purchase.status}</span>
            <span>{purchase.createdAt}</span>
            <span className="list-actions">
              {purchase.status === 'Recu' && currentUser?.role !== 'CASHIER' && (
                <button className="ghost-action" onClick={() => handleReturnPurchase(purchase.id)} style={{ color: '#ef4444' }}>
                  <RotateCcw size={14} style={{ marginRight: '4px' }} /> Retourner
                </button>
              )}
            </span>
          </div>
        )}
      </div>
    </section>;
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === adjustmentForm.productId);
    if (!product || !adjustmentForm.quantity) return;

    const qty = Number(adjustmentForm.quantity);
    let targetQuantity = 0;

    if (adjustmentForm.type === 'Inventaire') {
      targetQuantity = qty;
    } else {
      targetQuantity = product.stock - qty;
    }

    try {
      const response = await apiFetch(`/api/inventory/adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: currentLocationId,
          adjustments: [{
            productId: product.id,
            quantity: targetQuantity,
            reason: `${adjustmentForm.type} - ${adjustmentForm.reason}`
          }]
        })
      });

      if (!response.ok) throw new Error('Erreur API');

      setProducts(current => current.map(p => p.id === product.id ? { ...p, stock: targetQuantity } : p));
      setIsAdjustmentModalOpen(false);
      setAdjustmentForm({ productId: null, type: 'Casse', quantity: '', reason: '' });
      setStatus(`Ajustement enregistré sur ${product.name}`);
    } catch {
      setStatus(`Erreur lors de l'ajustement du stock`);
    }
  };

  const renderStock = () => (
    <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={Package}
          title="État des Stocks" 
          subtitle="Gérez vos quantités et alertes" 
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{lowStockProducts.length} alertes</span>
              <button className="primary-action" onClick={() => setIsAdjustmentModalOpen(true)}>
                <RefreshCw size={14} style={{ marginRight: '8px' }} />
                Ajustement
              </button>
            </div>
          } 
        />
      </div>

      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-start', padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <div className="filter-row">
          <button className={stockView === 'STOCK' ? 'selected' : ''} onClick={() => setStockView('STOCK')}>Produits</button>
          <button className={stockView === 'HISTORY' ? 'selected' : ''} onClick={() => setStockView('HISTORY')}>Historique Ajustements</button>
        </div>
      </div>

      {stockView === 'STOCK' ? (
        <div className="stock-grid" style={{ padding: '0 1.5rem 1.5rem' }}>
          {visibleProducts.map(product => (
            <div className="stock-card" key={product.id}>
              <div><strong>{product.name}</strong><small>{product.sku}</small></div>
              <span className={product.trackStock && product.stock <= product.lowStockAlert ? 'badge warn' : 'badge ok'}>{product.trackStock ? `${product.stock} en stock` : 'Non suivi'}</span>
              <div className="stock-bar"><i style={{ width: `${Math.min(100, product.trackStock ? (product.stock / Math.max(product.lowStockAlert * 3, 1)) * 100 : 100)}%` }} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="data-table">
          <div className="data-head" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1.5fr' }}>
            <span>Date</span><span>Type</span><span>Produit</span><span>Quantité</span><span>Utilisateur</span><span>Motif</span>
          </div>
          {stockAdjustments.map(adj => (
            <div className="data-row" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1.5fr' }} key={adj.id}>
              <span>{adj.date}</span>
              <span className="badge normal">{adj.type}</span>
              <span><strong>{adj.productName}</strong></span>
              <span className={adj.quantity < 0 ? 'badge warn' : 'badge ok'}>{adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity}</span>
              <span>{adj.user}</span>
              <span style={{ color: '#64748b' }}>{adj.reason || '-'}</span>
            </div>
          ))}
          {stockAdjustments.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun ajustement enregistré.</div>
          )}
        </div>
      )}

      {isAdjustmentModalOpen && (
        <div className="receipt-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsAdjustmentModalOpen(false); }}>
          <form className="receipt-panel" style={{ maxWidth: '400px' }} onSubmit={handleStockAdjustment}>
            <div className="receipt-header"><div><h2>Ajustement de stock</h2></div><button type="button" onClick={() => setIsAdjustmentModalOpen(false)}><XCircle size={18} /></button></div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label>
                <span>Produit</span>
                <select required value={adjustmentForm.productId || ''} onChange={e => setAdjustmentForm(f => ({ ...f, productId: Number(e.target.value) }))}>
                  <option value="" disabled>Sélectionner un produit</option>
                  {products.filter(p => p.trackStock).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.stock} en stock)</option>
                  ))}
                </select>
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label>
                  <span>Type</span>
                  <select required value={adjustmentForm.type} onChange={e => setAdjustmentForm(f => ({ ...f, type: e.target.value as any }))}>
                    <option value="Casse">Casse</option>
                    <option value="Perte">Perte</option>
                    <option value="Vol">Vol</option>
                    <option value="Inventaire">Inventaire (Nouveau total)</option>
                  </select>
                </label>
                <label>
                  <span>{adjustmentForm.type === 'Inventaire' ? 'Nouveau total' : 'Quantité perdue'}</span>
                  <input type="number" required min="1" step="1" value={adjustmentForm.quantity} onChange={e => setAdjustmentForm(f => ({ ...f, quantity: e.target.value }))} />
                </label>
              </div>

              <label>
                <span>Motif / Note</span>
                <input value={adjustmentForm.reason} onChange={e => setAdjustmentForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Endommagé lors du transport..." />
              </label>

              <button className="primary-action" type="submit" style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem' }}>Confirmer</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );

  const renderExpenses = () => {
    return (
      <section className="panel table-section flush-top">
        {expenseModalOpen && (
          <div className="receipt-backdrop" style={{ zIndex: 60 }} role="dialog" onClick={(e) => { if (e.target === e.currentTarget) setExpenseModalOpen(false); }}>
            <div className="receipt-panel" style={{ maxWidth: '480px', width: '95%' }}>
              <div className="receipt-header">
                <div><p>Gestion des dépenses</p><h2>Nouvelle Dépense</h2></div>
                <button onClick={() => setExpenseModalOpen(false)}><XCircle size={18} /></button>
              </div>
              <form style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onSubmit={async e => {
                e.preventDefault();
                const newExp = {
                  reference: expenseForm.reference || ('EXP-' + Math.floor(Math.random() * 10000)),
                  category: expenseForm.category,
                  amount: Number(expenseForm.amount),
                  date: expenseForm.date,
                  note: expenseForm.note,
                  paymentMethod: expenseForm.paymentMethod,
                  locationId: currentLocationId
                };
                
                try {
                  const response = await apiFetch(`/api/expenses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newExp),
                  });
                  if (!response.ok) throw new Error('API unavailable');
                  const created = await response.json();
                  setExpenses([created, ...expenses]);
                  setExpenseModalOpen(false);
                  setExpenseForm({ reference: '', category: 'Autre', amount: '', date: new Date().toISOString().split('T')[0], note: '', paymentMethod: 'Espèces' });
                } catch (err: any) {
                  setStatus('Erreur: Impossible d\'ajouter la dépense');
                }
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label><span>Montant (MAD)</span><input type="number" required min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value ? Number(e.target.value) : '' }))} /></label>
                  <label><span>Date</span><input type="date" required value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} /></label>
                </div>
                <label>
                  <span>Catégorie</span>
                  <select required value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="Loyer">Loyer</option>
                    <option value="Salaire">Salaire</option>
                    <option value="Électricité / Eau">Électricité / Eau</option>
                    <option value="Fournitures bureau">Fournitures bureau</option>
                    <option value="Marketing & Pub">Marketing & Pub</option>
                    <option value="Transport">Transport</option>
                    <option value="Achat marchandises">Achat marchandises</option>
                    <option value="Entretien & Rép.">Entretien & Rép.</option>
                    <option value="Autre">Autre</option>
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label>
                    <span>Méthode de paiement</span>
                    <select required value={expenseForm.paymentMethod} onChange={e => setExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      <option value="Espèces">Espèces (Caisse)</option>
                      <option value="Carte Bancaire">Carte Bancaire</option>
                      <option value="Virement">Virement</option>
                      <option value="Chèque">Chèque</option>
                    </select>
                  </label>
                  <label><span>Référence / Pièce (Optionnel)</span><input value={expenseForm.reference} onChange={e => setExpenseForm(f => ({ ...f, reference: e.target.value }))} placeholder="Ex: FACT-422..." /></label>
                </div>
                <label><span>Note / Description</span><input value={expenseForm.note} onChange={e => setExpenseForm(f => ({ ...f, note: e.target.value }))} placeholder="Détails de la dépense..." /></label>
                <button type="submit" className="primary-action" style={{ width: '100%', height: '42px', marginTop: '0.5rem' }}>Enregistrer la dépense</button>
              </form>
            </div>
          </div>
        )}
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader 
            title="Dépenses" 
            subtitle="Suivi des dépenses opérationnelles" 
            action={<button className="primary-action" onClick={() => setExpenseModalOpen(true)}><Plus size={16} style={{ marginRight: '8px' }} /> Nouvelle dépense</button>} 
          />
        </div>
        <div className="data-table">
          <div className="data-head" style={{ gridTemplateColumns: 'minmax(120px, 1fr) minmax(150px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(150px, 1fr) minmax(80px, auto)' }}>
            <span>Référence</span><span>Catégorie</span><span>Montant</span><span>Paiement</span><span>Date</span><span></span>
          </div>
          {expenses.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aucune dépense enregistrée.</div> : 
            expenses.filter(e => !e.locationId || e.locationId === currentLocationId).map(exp => <div className="data-row" style={{ gridTemplateColumns: 'minmax(120px, 1fr) minmax(150px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(150px, 1fr) minmax(80px, auto)' }} key={exp.id}>
              <span><strong>{exp.reference}</strong></span>
              <span>{exp.category}</span>
              <span style={{ color: '#ef4444', fontWeight: 800 }}>- {formatMoney(exp.amount)}</span>
              <span><span style={{ display: 'inline-block', padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{exp.paymentMethod || 'Espèces'}</span></span>
              <span>{exp.date}</span>
              <span style={{ textAlign: 'right' }}>
                <button title="Supprimer" className="icon-danger" style={{ background: '#fff', border: '1px solid #fee2e2' }} onClick={() => { if(confirm('Supprimer cette dépense ?')) setExpenses(expenses.filter(e => e.id !== exp.id)) }}><Trash2 size={14} /></button>
              </span>
            </div>)
          }
        </div>
      </section>
    );
  };

  
    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
    const [invoiceCustomer, setInvoiceCustomer] = useState<number | null>(null);

    const handleCreateInvoice = async () => {
      if (selectedTickets.length === 0 || !invoiceCustomer) return;
      try {
        const res = await apiFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: invoiceCustomer, saleIds: selectedTickets, mode: 'FROM_TICKETS', displayMode: companySettings.invoiceTicketDisplay })
        });
        if (res.ok) {
          setStatus('Facture creavec succes');
          setSelectedTickets([]);
          setInvoiceCustomer(null);
          setTicketInvoiceModalOpen(false);
          loadInvoices();
          loadSales();
        } else {
          const err = await res.json().catch(() => null);
          setStatus(err?.message || 'Erreur creation facture');
        }
      } catch(e) { setStatus('Erreur creation facture'); }
    };

    const openManualInvoiceForCustomer = (contact: Contact) => {
      setManualInvoiceCustomer(contact.id);
      setManualInvoiceNotes('');
      setManualInvoiceLines([{ description: '', quantity: '1', unitPrice: '0', tvaRate: companySettings.defaultTva || '20', productId: '' }]);
      setManualInvoiceModalOpen(true);
    };

    const openCustomerInvoiceFlow = (contact: Contact) => {
      const invoiceableSales = sales.filter(sale =>
        sale.status === 'Payee' &&
        !sale.invoiceId &&
        (sale.customerId === contact.id || sale.customer === contact.name)
      );

      if (invoiceableSales.length > 0) {
        setInvoiceCustomer(contact.id);
        setSelectedTickets(invoiceableSales.map(sale => sale.id));
        setTicketInvoiceModalOpen(true);
        return;
      }

      openManualInvoiceForCustomer(contact);
    };

    const openSalesInvoiceFlow = () => {
      const selectedSales = sales.filter(sale => selectedTickets.includes(sale.id));
      const invoiceableSales = selectedSales.filter(sale => sale.status === 'Payee' && !sale.invoiceId && sale.customerId);
      const customerIds = Array.from(new Set(invoiceableSales.map(sale => sale.customerId)));

      if (invoiceableSales.length === 0) {
        setStatus('Selectionnez au moins un ticket paye non encore facture.');
        return;
      }

      if (customerIds.length !== 1) {
        setStatus('Les tickets selectionnes doivent appartenir au meme client pour generer une seule facture.');
        return;
      }

      setInvoiceCustomer(customerIds[0] || null);
      setSelectedTickets(invoiceableSales.map(sale => sale.id));
      setTicketInvoiceModalOpen(true);
    };

    const applyProductTemplateToManualInvoiceLine = (index: number, rawValue: string) => {
      const value = rawValue.trim();
      const matchedProduct = products.find(product =>
        product.name.toLowerCase() == value.toLowerCase() ||
        product.sku.toLowerCase() == value.toLowerCase() ||
        (product.barcode || '').toLowerCase() == value.toLowerCase()
      );

      setManualInvoiceLines(current => current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (!matchedProduct) return { ...item, description: rawValue, productId: '' };
        return {
          ...item,
          description: matchedProduct.name,
          unitPrice: String(matchedProduct.salePrice || item.unitPrice || '0'),
          tvaRate: String(matchedProduct.tvaRate || companySettings.defaultTva || item.tvaRate || '20'),
          productId: String(matchedProduct.id),
        };
      }));
    };

    const handleCreateManualInvoice = async () => {
      const validLines = manualInvoiceLines
        .map(line => ({
          description: line.description.trim(),
          quantity: Number(line.quantity || 0),
          unitPrice: Number(line.unitPrice || 0),
          tvaRate: Number(line.tvaRate || 0),
          productId: Number(line.productId || 0) || undefined,
        }))
        .filter(line => line.description && line.quantity > 0);
      if (!manualInvoiceCustomer || validLines.length === 0) {
        setStatus('Client et lignes valides requis pour la facture libre');
        return;
      }
      try {
        const res = await apiFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: manualInvoiceCustomer,
            mode: 'MANUAL',
            notes: manualInvoiceNotes,
            displayMode: companySettings.invoiceTicketDisplay,
            manualLines: validLines,
          })
        });
        if (res.ok) {
          setStatus('Facture libre creavec succes');
          setManualInvoiceNotes('');
          setManualInvoiceCustomer('');
          setManualInvoiceLines([{ description: '', quantity: '1', unitPrice: '0', tvaRate: companySettings.defaultTva || '20', productId: '' }]);
          setManualInvoiceModalOpen(false);
          loadInvoices();
        } else {
          const err = await res.json().catch(() => null);
          setStatus(err?.message || 'Erreur creation facture libre');
        }
      } catch (e) {
        setStatus('Erreur creation facture libre');
      }
    };

    const handleInvoiceStatusChange = async (invoiceId: number, nextStatus: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'CANCELLED') => {
      try {
        const res = await apiFetch(`/api/invoices/${invoiceId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });

        if (res.ok) {
          const data = await res.json();
          syncInvoiceInState(data.invoice);
          setStatus(`Statut facture mis a jour: ${invoiceStatusLabel(nextStatus)}`);
        } else {
          const err = await res.json().catch(() => null);
          setStatus(err?.message || 'Erreur mise a jour statut facture');
        }
      } catch {
        setStatus('Erreur mise a jour statut facture');
      }
    };

    const handleRecordInvoicePayment = async () => {
      if (!invoicePaymentTarget) return;
      const amount = Number(invoicePaymentForm.amount || 0);
      if (amount <= 0) {
        setStatus('Montant paiement facture invalide');
        return;
      }

      try {
        const res = await apiFetch(`/api/invoices/${invoicePaymentTarget.id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            method: invoicePaymentForm.method,
            note: invoicePaymentForm.note,
          })
        });

        if (res.ok) {
          const data = await res.json();
          syncInvoiceInState(data.invoice);
          setStatus(`Paiement facture enregistre: ${formatMoney(amount)}`);
          setInvoicePaymentTarget(null);
          setInvoicePaymentForm({ amount: '', method: 'CASH', note: '' });
        } else {
          const err = await res.json().catch(() => null);
          setStatus(err?.message || 'Erreur enregistrement paiement facture');
        }
      } catch {
        setStatus('Erreur enregistrement paiement facture');
      }
    };

    const renderFactures = () => {
      const pendingSales = sales.filter(s => s.status === 'Payee' && !s.invoiceId && s.customerId);
      const customersWithPending = Array.from(new Set(pendingSales.map(s => s.customerId)));
      const filteredInvoices = invoices.filter(inv => !invoiceSearch || inv.number.toLowerCase().includes(invoiceSearch.toLowerCase()) || (inv.customer?.name || '').toLowerCase().includes(invoiceSearch.toLowerCase()));

      return (
        <section className="panel table-section flush-top">
          <div style={{ padding: '1.5rem 1.5rem 0' }}>
            <PageHeader
              icon={FileText}
              title="Facturation"
              subtitle="Factures depuis tickets ou factures libres, avec affichage controle depuis les parametres."
              action={
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="ghost-action" type="button" onClick={() => setTicketInvoiceModalOpen(true)}><Plus size={16} /> Facture depuis tickets</button>
                  <button className="primary-action" type="button" onClick={() => setManualInvoiceModalOpen(true)}><Plus size={16} /> Facture libre</button>
                </div>
              }
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem 1.1rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.35rem' }}>Tickets facturables</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>{pendingSales.length}</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{customersWithPending.length} client(s) concernes</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem 1.1rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.35rem' }}>Mode d'affichage</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{companySettings.invoiceTicketDisplay === 'DETAILED' ? 'Tickets detailles' : 'Tickets resumes'}</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Modifiable dans Parametres {'>'} Documents</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem 1.1rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.35rem' }}>Factures generees</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>{invoices.length}</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{formatMoney(invoices.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0))}</div>
            </div>
          </div>

          <div className="product-table modern-product-table" style={{ background: 'white' }}>
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1rem 0.75rem', gap: '1rem' }}>
              <strong>Liste des factures</strong>
              <div className="search-box" style={{ flex: 1, maxWidth: '320px' }}><Search size={17} /><input value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} placeholder="Rechercher numero ou client..." /></div>
            </div>
            <div className="table-head">
              <span>Facture</span><span>Client</span><span>Source</span><span>Statut</span><span>Total</span><span>Reste</span><span>Actions</span>
            </div>
            {filteredInvoices.map(inv => {
              const meta = parseInvoiceMeta(inv.notes);
              const source = meta.mode === 'MANUAL' ? 'Facture libre' : `${inv.sales?.length || 0} ticket(s)`;
              const paidAmount = getInvoicePaidAmount(inv);
              const dueAmount = getInvoiceDueAmount(inv);
              return (
                <div className="table-row" key={inv.id}>
                  <span><strong>{inv.number}</strong><small>{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</small></span>
                  <span>{inv.customer?.name || 'Inconnu'}</span>
                  <span>{source}</span>
                  <span>
                    <select
                      value={inv.status || 'SENT'}
                      onChange={event => handleInvoiceStatusChange(inv.id, event.target.value as 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'CANCELLED')}
                      style={{ minWidth: '150px', padding: '0.55rem 0.75rem', borderRadius: '10px', border: `1px solid ${invoiceStatusTone(inv.status || 'SENT').border}`, background: invoiceStatusTone(inv.status || 'SENT').bg, color: invoiceStatusTone(inv.status || 'SENT').text, fontWeight: 700 }}
                    >
                      <option value="DRAFT">Brouillon</option>
                      <option value="SENT">Validee</option>
                      <option value="PARTIAL">Partiellement payee</option>
                      <option value="PAID">Payee</option>
                      <option value="CANCELLED">Annulee</option>
                    </select>
                    <small>{meta.payments.length} paiement(s)</small>
                  </span>
                  <span><strong>{formatMoney(Number(inv.total))}</strong><small>Regle: {formatMoney(paidAmount)}</small></span>
                  <span><strong style={{ color: dueAmount > 0 ? '#c2410c' : '#16a34a' }}>{formatMoney(dueAmount)}</strong></span>
                  <span className="list-actions">
                    <button className="row-action" onClick={() => setSelectedFacture(inv)}>Voir</button>
                    <button className="row-action" onClick={() => downloadInvoiceDocument(inv, companySettings)}><Download size={14} /> Export</button>
                    <button className="row-action" onClick={async () => { try { const result = await shareInvoiceDocument(inv); setStatus(result === 'shared' ? 'Facture partagee' : result === 'copied' ? 'Resume facture copie' : 'Partage facture non disponible sur cet appareil'); } catch { setStatus('Partage facture annule ou indisponible'); } }}><Mail size={14} /> Partager</button>
                    <button className="row-action" onClick={() => { setInvoicePaymentTarget(inv); setInvoicePaymentForm({ amount: String(getInvoiceDueAmount(inv) || ''), method: 'CASH', note: '' }); }}>Encaisser</button>
                  </span>
                </div>
              );
            })}
            {filteredInvoices.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucune facture generee.</div>}
          </div>

          {ticketInvoiceModalOpen && (
            <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setTicketInvoiceModalOpen(false); }}>
              <section className="receipt-panel" style={{ maxWidth: '680px', width: '95%' }}>
                <div className="receipt-header"><div><p>Facturation</p><h2>Facture depuis tickets</h2></div><button onClick={() => setTicketInvoiceModalOpen(false)}><XCircle size={18} /></button></div>
                <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem', overflowY: 'auto', minHeight: 0 }}>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>Selectionnez un client puis les tickets payes non encore factures.</p>
                  <select value={invoiceCustomer || ''} onChange={e => { setInvoiceCustomer(Number(e.target.value)); setSelectedTickets([]); }} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <option value="">-- Choisir un client --</option>
                    {customersWithPending.map(cid => {
                      const contact = contacts.find(c => c.id === cid);
                      return <option key={cid} value={cid}>{contact ? contact.name : 'Client #' + cid}</option>;
                    })}
                  </select>
                  <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'grid', gap: '0.65rem', paddingRight: '0.25rem' }}>
                    {invoiceCustomer ? pendingSales.filter(s => s.customerId === invoiceCustomer).map(sale => (
                      <label key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
                        <input type="checkbox" checked={selectedTickets.includes(sale.id)} onChange={e => {
                          if (e.target.checked) setSelectedTickets(prev => [...prev, sale.id]);
                          else setSelectedTickets(prev => prev.filter(id => id !== sale.id));
                        }} style={{ width: '18px', height: '18px' }} />
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block' }}>Ticket {sale.ticket}</strong>
                          <small style={{ color: '#64748b' }}>{sale.createdAt}</small>
                        </div>
                        <strong style={{ color: '#0f172a' }}>{formatMoney(sale.total)}</strong>
                      </label>
                    )) : <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '10px', textAlign: 'center', color: '#64748b' }}>Choisissez d'abord un client.</div>}
                  </div>
                </div>
                <div className="receipt-actions no-print">
                  <button type="button" className="ghost-action" onClick={() => setTicketInvoiceModalOpen(false)}><XCircle size={18} /> Fermer</button>
                  <button type="button" className="primary-action" onClick={handleCreateInvoice} disabled={!selectedTickets.length}><FileText size={18} /> Generer ({selectedTickets.length})</button>
                </div>
              </section>
            </div>
          )}

          {manualInvoiceModalOpen && (
            <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setManualInvoiceModalOpen(false); }}>
              <section className="receipt-panel" style={{ maxWidth: '920px', width: '96%' }}>
                <div className="receipt-header"><div><p>Facturation</p><h2>Facture libre</h2></div><button onClick={() => setManualInvoiceModalOpen(false)}><XCircle size={18} /></button></div>
                <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem', overflowY: 'auto', minHeight: 0 }}>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>Creez une facture manuelle sans partir d'un ticket de caisse.</p>
                  <select value={manualInvoiceCustomer || ''} onChange={e => setManualInvoiceCustomer(Number(e.target.value))} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <option value="">-- Choisir un client --</option>
                    {contacts.filter(c => c.type.includes('Client')).map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                  </select>
                  <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'grid', gap: '0.75rem', paddingRight: '0.25rem' }}>
                    {manualInvoiceLines.map((line, index) => (
                      <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem', display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) 90px 120px 90px auto', gap: '0.65rem', alignItems: 'end', background: '#f8fafc' }}>
                        <label>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Description / produit</span>
                          <input
                            value={line.description}
                            list={`invoice-product-options-${index}`}
                            onChange={e => applyProductTemplateToManualInvoiceLine(index, e.target.value)}
                            placeholder="Produit du catalogue ou texte libre"
                            style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                          />
                          <datalist id={`invoice-product-options-${index}`}>
                            {products.filter(product => product.isActive).slice(0, 120).map(product => (
                              <option key={`${index}-${product.id}`} value={product.name}>{`${product.sku} - ${formatMoney(product.salePrice)}`}</option>
                            ))}
                          </datalist>
                        </label>
                        <label><span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Qte</span><input value={line.quantity} onChange={e => setManualInvoiceLines(current => current.map((item, i) => i === index ? { ...item, quantity: e.target.value } : item))} style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
                        <label><span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>PU</span><input value={line.unitPrice} onChange={e => setManualInvoiceLines(current => current.map((item, i) => i === index ? { ...item, unitPrice: e.target.value } : item))} style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
                        <label><span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>TVA %</span><input value={line.tvaRate} onChange={e => setManualInvoiceLines(current => current.map((item, i) => i === index ? { ...item, tvaRate: e.target.value } : item))} style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
                        <button className="ghost-action" type="button" onClick={() => setManualInvoiceLines(current => current.length === 1 ? current : current.filter((_, i) => i !== index))} style={{ height: '46px' }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="ghost-action" type="button" onClick={() => setManualInvoiceLines(current => [...current, { description: '', quantity: '1', unitPrice: '0', tvaRate: companySettings.defaultTva || '20', productId: '' }])}><Plus size={16} /> Ajouter une ligne</button>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{manualInvoiceLines.length} ligne(s)</div>
                  </div>
                  <label><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>Note interne / commentaire</span><textarea value={manualInvoiceNotes} onChange={e => setManualInvoiceNotes(e.target.value)} style={{ width: '100%', height: '96px', resize: 'none', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
                </div>
                <div className="receipt-actions no-print">
                  <button type="button" className="ghost-action" onClick={() => setManualInvoiceModalOpen(false)}><XCircle size={18} /> Fermer</button>
                  <button type="button" className="primary-action" onClick={handleCreateManualInvoice}><FileText size={18} /> Creer la facture libre</button>
                </div>
              </section>
            </div>
          )}
        </section>
      );
    };
  const renderSales = () => {
    const filteredSales = sales.filter(s => (!s.locationId || s.locationId === currentLocationId) && (!saleSearch || s.ticket.toLowerCase().includes(saleSearch.toLowerCase()) || s.customer.toLowerCase().includes(saleSearch.toLowerCase())));
    const invoiceableSales = filteredSales.filter(sale => sale.status === 'Payee' && !sale.invoiceId && sale.customerId);
    const selectedInvoiceableSales = invoiceableSales.filter(sale => selectedTickets.includes(sale.id));
    const selectedCustomerIds = Array.from(new Set(selectedInvoiceableSales.map(sale => sale.customerId)));
    const hasMixedSelection = selectedCustomerIds.length > 1;
    return <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={TrendingUp}
          title="Historique des Ventes" 
          subtitle="Tickets, factures et devis" 
          action={
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="ghost-action" disabled={!selectedInvoiceableSales.length || hasMixedSelection} onClick={openSalesInvoiceFlow}><FileText size={16} /> Facturer la selection ({selectedInvoiceableSales.length})</button>
              <button className="primary-action" onClick={() => setPage('POS')}><Plus size={16} style={{ marginRight: '8px' }} /> Nouvelle vente</button>
            </div>
          } 
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', padding: '0 1.5rem 1.5rem' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}><Search size={17} /><input value={saleSearch} onChange={event => setSaleSearch(event.target.value)} placeholder="Rechercher ticket ou client..." /></div>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{filteredSales.length}</span>
            <span className="toolbar-stat-label">Tickets</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{formatMoney(filteredSales.reduce((sum, s) => sum + s.total, 0))}</span>
            <span className="toolbar-stat-label">Total Ventes</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{selectedInvoiceableSales.length}</span>
            <span className="toolbar-stat-label">Selection facturable</span>
          </div>
        </div>
      </div>
      {hasMixedSelection && <div style={{ margin: '0 1.5rem 1rem', padding: '0.85rem 1rem', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.9rem', fontWeight: 600 }}>Les tickets selectionnes appartiennent a plusieurs clients. Gardez une seule selection client pour generer une facture.</div>}
      <RecordTable sales={filteredSales} onOpenReceipt={setReceiptSale} onOpenInvoice={setInvoiceSale} onResumeSale={resumeSale} onSettleSale={openSaleSettlement} selectedSaleIds={selectedTickets} onToggleSaleSelection={(sale) => {
        if (!(sale.status === 'Payee' && !sale.invoiceId && sale.customerId)) return;
        setSelectedTickets(current => current.includes(sale.id) ? current.filter(id => id !== sale.id) : [...current, sale.id]);
      }} isSaleSelectable={(sale) => sale.status === 'Payee' && !sale.invoiceId && !!sale.customerId} />
    </section>;
  };

  const renderPayments = () => {
    const rows = sales
      .filter(sale => paymentFilter === 'ALL' || sale.status === paymentFilter)
      .sort((left, right) => {
        const leftDue = getSaleDueAmount(left);
        const rightDue = getSaleDueAmount(right);
        if (left.status === 'Credit' && right.status !== 'Credit') return -1;
        if (right.status === 'Credit' && left.status !== 'Credit') return 1;
        if (rightDue !== leftDue) return rightDue - leftDue;
        return right.id - left.id;
      });
    const outstandingTotal = rows.reduce((sum, sale) => sum + getSaleDueAmount(sale), 0);
    const creditCount = rows.filter(sale => sale.status === 'Credit').length;
    return <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={Banknote}
          title="Paiements" 
          subtitle="Encaissements et crédits" 
          action={<strong style={{ fontSize: '1.2rem', color: '#16a34a' }}>Total: {formatMoney(rows.reduce((sum, sale) => sum + sale.total, 0))}</strong>} 
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem 1.5rem' }}>
        <div className="filter-row inline">{(['ALL', 'Payee', 'Credit'] as const).map(value => <button key={value} className={paymentFilter === value ? 'selected' : ''} onClick={() => setPaymentFilter(value)}>{value === 'ALL' ? 'Tous' : value}</button>)}</div>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{rows.length}</span>
            <span className="toolbar-stat-label">Transactions</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{creditCount}</span>
            <span className="toolbar-stat-label">Credits ouverts</span>
          </div>
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{formatMoney(outstandingTotal)}</span>
            <span className="toolbar-stat-label">Reste a encaisser</span>
          </div>
        </div>
      </div>
      <RecordTable sales={rows} onOpenReceipt={setReceiptSale} onOpenInvoice={setInvoiceSale} onResumeSale={resumeSale} onSettleSale={openSaleSettlement} />
    </section>;
  };

  const renderReports = () => {
    const filterByPeriod = (list: SaleRecord[]) => {
      if (reportPeriod === 'all') return list;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return list.filter(s => {
        // Parse relative date strings from seed data
        const ca = s.createdAt.toLowerCase();
        if (reportPeriod === 'today') {
          return ca.includes('aujourd') || ca.includes('maintenant');
        }
        if (reportPeriod === 'week') {
          return ca.includes('aujourd') || ca.includes('maintenant') || ca.includes('hier') || ca.includes('lundi') || ca.includes('mardi') || ca.includes('mercredi') || ca.includes('jeudi') || ca.includes('vendredi') || ca.includes('samedi') || ca.includes('dimanche');
        }
        // For month/year, try parsing as real date, otherwise include all
        const parsed = new Date(s.createdAt);
        if (!isNaN(parsed.getTime())) {
          if (reportPeriod === 'month') return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
          if (reportPeriod === 'year') return parsed.getFullYear() === now.getFullYear();
        }
        // If we can't parse, include it for broader periods
        return true;
      });
    };

    const exportCSV = (data: SaleRecord[]) => {
      const header = 'Ticket,Date,Client,Methode,Statut,Total\n';
      const rows = data.map(s => `${s.ticket},"${s.createdAt}","${s.customer}",${methodLabel[s.method]},${s.status},${s.total.toFixed(2)}`).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-ventes-${reportPeriod}-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const paidSales = filterByPeriod(sales.filter(s => s.status === 'Payee'));
    
    // Aggregation calculations
    const salesByDate = {} as Record<string, number>;
    const profitByDate = {} as Record<string, number>;
    const salesByCashier = {} as Record<string, { name: string; sales: number; count: number }>;
    
    let totalMargin = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalGross = 0;

    paidSales.forEach(sale => {
      const day = sale.createdAt.split(' ')[0] || sale.createdAt;
      salesByDate[day] = (salesByDate[day] || 0) + sale.total;
      
      const cashier = sale.cashierName || 'Inconnu';
      if (!salesByCashier[cashier]) salesByCashier[cashier] = { name: cashier, sales: 0, count: 0 };
      salesByCashier[cashier].sales += sale.total;
      salesByCashier[cashier].count += 1;
      
      totalGross += sale.total;

      let saleCost = 0;
      let saleTax = 0;
      let saleNet = 0;
      if (sale.lines && sale.lines.length > 0) {
        sale.lines.forEach(line => {
          const product = products.find(p => p.id === line.productId);
          const currentPrice = line.unitPrice ?? (product?.salePrice || 0);
          const cost = product?.purchasePrice || 0;
          const taxRate = product?.tvaRate || 0;
          const netPrice = currentPrice / (1 + taxRate / 100);
          
          saleCost += cost * line.quantity;
          saleNet += netPrice * line.quantity;
          saleTax += (currentPrice - netPrice) * line.quantity;
        });
      } else {
        // Fallback for mock data without lines
        saleNet = sale.total / 1.2;
        saleCost = saleNet * 0.7; // assume 30% margin
        saleTax = sale.total - saleNet;
      }
      
      profitByDate[day] = (profitByDate[day] || 0) + (saleNet - saleCost);
      totalMargin += (saleNet - saleCost);
      totalNet += saleNet;
      totalTax += saleTax;
    });

    const activeDays = Object.keys(salesByDate).sort();
    const salesVsProfitData = activeDays.map(day => ({
      name: day === 'Aujourd' ? "Aujourd'hui" : day,
      Ventes: Number(salesByDate[day].toFixed(2)),
      Profit: Number(profitByDate[day].toFixed(2))
    }));

    const cashierPerformance = Object.values(salesByCashier).sort((a, b) => b.sales - a.sales);

    const salesByMethod = paidSales.reduce((acc, sale) => {
      acc[sale.method] = (acc[sale.method] || 0) + sale.total;
      return acc;
    }, {} as Partial<Record<PaymentMethod, number>>);

    const productCounts = paidSales.reduce((acc, sale) => {
      sale.lines?.forEach(line => {
        acc[line.name] = (acc[line.name] || 0) + line.quantity;
      });
      return acc;
    }, {} as Record<string, number>);
    
    const topProductsData = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantite]) => ({ name, quantite }));

    const renderTabNav = () => (
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setReportsTab('synthese')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'synthese' ? '#0f172a' : 'transparent', color: reportsTab === 'synthese' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <BarChart3 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Synthèse
        </button>
        <button 
          onClick={() => setReportsTab('ventes')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'ventes' ? '#0f172a' : 'transparent', color: reportsTab === 'ventes' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <TrendingUp size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Ventes
        </button>
        <button 
          onClick={() => setReportsTab('produits')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'produits' ? '#0f172a' : 'transparent', color: reportsTab === 'produits' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <Package size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Produits
        </button>
        <button 
          onClick={() => setReportsTab('paiements')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: reportsTab === 'paiements' ? '#0f172a' : 'transparent', color: reportsTab === 'paiements' ? '#fff' : '#64748b', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <Banknote size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Paiements
        </button>
      </div>
    );

    return (
      <section style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader 
          icon={BarChart3}
          title="Tableau de bord" 
          subtitle="Tableau de bord financier" 
          action={
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                value={dashboardLocationFilter} 
                onChange={e => setDashboardLocationFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 500, color: '#334155' }}
              >
                <option value="ALL">Tous les magasins</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
              {/* Old date filter removed */}
              <button 
                className="ghost-action" 
                onClick={() => exportCSV(paidSales)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Download size={16} /> Exporter CSV
              </button>
            </div>
          } 
        />

        {renderTabNav()}
        {/* Beautiful Date Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem', gap: '0.5rem', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '0 1rem', color: '#64748b', fontWeight: 600, fontSize: '0.9rem', borderRight: '1px solid #e2e8f0' }}>Période</div>
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'today', label: "Aujourd'hui" },
            { id: 'week', label: 'Cette semaine' },
            { id: 'month', label: 'Ce mois' },
            { id: 'year', label: 'Cette année' },
          ].map(period => (
            <button
              key={period.id}
              onClick={() => setReportPeriod(period.id as any)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: reportPeriod === period.id ? '#f1f5f9' : 'transparent',
                color: reportPeriod === period.id ? '#0f172a' : '#64748b',
                fontWeight: reportPeriod === period.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {period.label}
            </button>
          ))}
        </div>


        {reportsTab === 'synthese' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #3b82f6', padding: '1.5rem' }}>
                <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Chiffre d'Affaire (TTC)</p>
                <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#0f172a' }}>{formatMoney(totalGross)}</h3>
              </div>
              <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #10b981', padding: '1.5rem' }}>
                <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Marge Brute Estimée</p>
                <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#10b981' }}>{formatMoney(totalMargin)}</h3>
              </div>
              <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #f59e0b', padding: '1.5rem' }}>
                <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Panier Moyen</p>
                <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#f59e0b' }}>{formatMoney(paidSales.length > 0 ? totalGross / paidSales.length : 0)}</h3>
              </div>
              <div className="panel" style={{ background: '#fff', borderLeft: '4px solid #8b5cf6', padding: '1.5rem' }}>
                <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Tickets Encaissés</p>
                <h3 style={{ fontSize: '2rem', margin: '0.5rem 0 0 0', color: '#0f172a' }}>{paidSales.length}</h3>
              </div>
            </div>

            {/* Main Trend Chart */}
            <div className="panel wide-panel">
              <div className="panel-title compact"><div><p>Tendances</p><h2>Ventes & Profit par Jour</h2></div></div>
              <div style={{ minHeight: '300px', marginTop: '1rem', padding: '1rem 0' }}>
                {salesVsProfitData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={salesVsProfitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="Ventes" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Line yAxisId="left" type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune donnée de vente disponible.</div>
                )}
              </div>
            </div>

            {/* Secondary Row: Top Products & Cashier Performance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {/* Top Products */}
              <div className="panel">
                <div className="panel-title compact"><div><p>Palmarès</p><h2>Top Articles Vendus</h2></div></div>
                <div style={{ minHeight: '250px', marginTop: '1rem', padding: '1rem 0' }}>
                  {topProductsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart layout="vertical" data={topProductsData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={150} tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="quantite" name="Quantité" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucune donnée disponible.</div>
                  )}
                </div>
              </div>

              {/* Cashier Performance */}
              <div className="panel">
                <div className="panel-title compact"><div><p>Équipe</p><h2>Performance Caissiers</h2></div></div>
                <div className="cart-table" style={{ marginTop: '1rem' }}>
                  <div className="cart-head" style={{ gridTemplateColumns: '1fr auto auto' }}>
                    <span>Caissier</span>
                    <span>Tickets</span>
                    <span>Ventes (TTC)</span>
                  </div>
                  {cashierPerformance.map(cashier => (
                    <div className="cart-row" key={cashier.name} style={{ gridTemplateColumns: '1fr auto auto' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{cashier.name}</span>
                      <span style={{ color: '#64748b', textAlign: 'center' }}>{cashier.count}</span>
                      <span style={{ fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{formatMoney(cashier.sales)}</span>
                    </div>
                  ))}
                  {cashierPerformance.length === 0 && <div className="pos-empty">Aucune donnée disponible.</div>}
                </div>
              </div>
            </div>
          </div>
        )}


        {reportsTab === 'ventes' && (
          <div className="panel wide-panel">
            <div className="panel-title compact"><div><p>Détails</p><h2>Journal des Ventes</h2></div></div>
            <div className="cart-table" style={{ marginTop: '1rem' }}>
              <div className="cart-head">
                <span>Réf Ticket</span>
                <span>Date</span>
                <span>Client</span>
                <span>Mode Paiement</span>
                <span>Total</span>
              </div>
              {paidSales.map(sale => (
                <div className="cart-row" key={sale.id}>
                  <span><strong>{sale.ticket}</strong></span>
                  <span>{sale.createdAt}</span>
                  <span>{sale.customer}</span>
                  <span><span style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>{methodLabel[sale.method]}</span></span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{formatMoney(getSaleDueAmount(sale))}</span>
                </div>
              ))}
              {paidSales.length === 0 && <div className="pos-empty">Aucune vente enregistrée.</div>}
            </div>
          </div>
        )}

        {reportsTab === 'produits' && (
          <div className="workspace-grid" style={{ padding: 0 }}>
            <div className="panel">
              <div className="panel-title compact"><div><p>Palmarès</p><h2>Top Articles (Quantités)</h2></div></div>
              <div className="cart-table" style={{ marginTop: '1rem' }}>
                <div className="cart-head"><span>Produit</span><span>Qte Vendue</span></div>
                {topProductsData.map((item) => (
                  <div className="cart-row" key={item.name} style={{ gridTemplateColumns: '1fr auto' }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 700 }}>{item.quantite}x</span>
                  </div>
                ))}
                {topProductsData.length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun article vendu</span>}
              </div>
            </div>
            
            <div className="panel">
              <div className="panel-title compact"><div><p>Indicateurs</p><h2>Qualité Stock</h2></div></div>
              <div className="summary-list" style={{ marginTop: '1rem' }}>
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ color: '#64748b' }}>Articles au catalogue</span>
                  <strong style={{ fontSize: '1.5rem', display: 'block', marginTop: '0.25rem' }}>{visibleProducts.length}</strong>
                </div>
                <div style={{ padding: '1rem', background: lowStockProducts.length > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '8px' }}>
                  <span style={{ color: lowStockProducts.length > 0 ? '#ef4444' : '#16a34a' }}>Alertes stock bas</span>
                  <strong style={{ fontSize: '1.5rem', display: 'block', marginTop: '0.25rem', color: lowStockProducts.length > 0 ? '#ef4444' : '#16a34a' }}>{lowStockProducts.length}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportsTab === 'paiements' && (
          <div className="panel" style={{ maxWidth: '600px' }}>
            <div className="panel-title compact"><div><p>Flux Financier</p><h2>Répartition des paiements</h2></div></div>
            <div className="cart-table" style={{ marginTop: '1rem' }}>
              <div className="cart-head" style={{ gridTemplateColumns: '1fr auto' }}><span>Méthode</span><span>Montant Encaissé</span></div>
              {(Object.entries(salesByMethod) as [PaymentMethod, number][]).map(([method, total]) => (
                <div className="cart-row" key={method} style={{ gridTemplateColumns: '1fr auto' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    {method === 'CASH' && <Banknote size={16} color="#10b981" />}
                    {method === 'CARD' && <CreditCard size={16} color="#3b82f6" />}
                    {method === 'CREDIT' && <ClipboardList size={16} color="#f59e0b" />}
                    {method === 'MULTI' && <ReceiptText size={16} color="#8b5cf6" />}
                    {methodLabel[method]}
                  </span>
                  <strong style={{ color: '#0f172a' }}>{formatMoney(total)}</strong>
                </div>
              ))}
              {Object.keys(salesByMethod).length === 0 && <span style={{ color: '#94a3b8', padding: '1rem' }}>Aucun encaissement</span>}
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderKitchen = () => {
    const kitchenSales = [...draftSales, ...sales].filter(s => 
      (!s.locationId || s.locationId === currentLocationId) &&
      (s.status === 'Suspendue' || s.status === 'Payee') && 
      s.kitchenStatus !== 'READY' &&
      s.lines?.some(l => products.find(p => p.id === l.productId)?.isKitchenItem)
    ).sort((a, b) => b.id - a.id); // Newest first

    let filteredKitchenSales = kitchenSales;
    if (kitchenFilter === 'drinks') {
      filteredKitchenSales = kitchenSales.map(sale => ({
        ...sale,
        lines: sale.lines?.filter(l => {
          const p = products.find(prod => prod.id === l.productId);
          return p?.isKitchenItem && p.category === 'Boissons';
        })
      })).filter(sale => sale.lines && sale.lines.length > 0);
    } else if (kitchenFilter === 'food') {
      filteredKitchenSales = kitchenSales.map(sale => ({
        ...sale,
        lines: sale.lines?.filter(l => {
          const p = products.find(prod => prod.id === l.productId);
          return p?.isKitchenItem && p.category !== 'Boissons';
        })
      })).filter(sale => sale.lines && sale.lines.length > 0);
    }

    const readyCount = [...draftSales, ...sales].filter(s => s.kitchenStatus === 'READY').length;

    return (
      <section style={{ padding: '1.5rem', background: '#e2e8f0', minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Left Side: Orders Grid */}
        <div className="panel wide-panel" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title compact" style={{ borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem', padding: '1.5rem 1.5rem 0' }}>
            <div>
              <p style={{ color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>KDS - Kitchen Display System</p>
              <h2 style={{ color: '#f8fafc', fontSize: '1.75rem' }}>Bons de préparation</h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ background: '#1e293b', padding: '0.5rem 1rem', borderRadius: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                {filteredKitchenSales.length} {filteredKitchenSales.length > 1 ? 'Commandes affichées' : 'Commande affichée'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '0 1.5rem 1.5rem', overflowY: 'auto' }}>
            {filteredKitchenSales.length === 0 ? (
              <div style={{ width: '100%', padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                <Utensils size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#94a3b8' }}>Aucune commande à préparer</h3>
                <p>En attente de nouveaux tickets ou changez les filtres...</p>
              </div>
            ) : (
              filteredKitchenSales.map((sale, idx) => {
                const isUrgent = idx > 5; // Simulate urgency for older tickets
                const ticketItems = (sale.lines || []).filter(l => products.find(p => p.id === l.productId)?.isKitchenItem);
                
                return (
                  <div key={sale.id} style={{ 
                    flex: '1 1 300px',
                    maxWidth: '400px',
                    background: isUrgent ? '#450a0a' : '#1e293b', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderTop: `6px solid ${isUrgent ? '#ef4444' : '#3b82f6'}`,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ padding: '1.25rem', borderBottom: `1px dashed ${isUrgent ? '#7f1d1d' : '#334155'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.5rem', color: '#fff', letterSpacing: '0.05em' }}>{sale.ticket}</strong>
                        <span style={{ background: isUrgent ? '#ef4444' : '#3b82f6', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {sale.status === 'Payee' ? 'PAYÉ' : 'EN COURS'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: isUrgent ? '#fca5a5' : '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> {sale.createdAt}</span>
                        <span style={{ color: '#fbbf24', fontSize: '0.95rem', fontWeight: 600 }}>{sale.referenceNote || 'Table / Comptoir'}</span>
                      </div>
                    </div>
                    
                    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {ticketItems.map(line => (
                        <div key={line.productId} style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '0.75rem',
                          background: isUrgent ? '#7f1d1d' : '#0f172a',
                          padding: '0.75rem',
                          borderRadius: '8px'
                        }}>
                          <strong style={{ 
                            background: '#fff', 
                            color: '#0f172a', 
                            minWidth: '28px', 
                            height: '28px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            borderRadius: '6px',
                            fontSize: '1rem'
                          }}>{line.quantity}</strong>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.2 }}>{line.name}</div>
                            {line.note && <em style={{ color: '#fcd34d', fontSize: '0.9rem', display: 'block', marginTop: '0.25rem', fontWeight: 500 }}>âeeï{line.note}</em>}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ padding: '1.25rem', borderTop: `1px solid ${isUrgent ? '#7f1d1d' : '#334155'}` }}>
                      <button className="primary-action" onClick={() => markKitchenReady(sale.id)} style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        background: '#10b981', 
                        color: '#fff', 
                        border: 'none', 
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        cursor: 'pointer'
                      }}>
                        <CheckCircle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/>
                        Marquer Prêt
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Supervision Cuisine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dashboard-sidebar-block" style={{ padding: '1.5rem', background: '#0f172a', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#e2e8f0', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>Service en cours</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', background: '#1e293b', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{kitchenSales.length}</span><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>En attente</span></div>
              <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{readyCount}</span><span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Terminées</span></div>
            </div>

            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtres de Catégories</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
              <button onClick={() => setKitchenFilter('all')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'all' ? '#3b82f6' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Tout afficher</span></button>
              <button onClick={() => setKitchenFilter('food')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'food' ? '#f59e0b' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Plats uniquement</span></button>
              <button onClick={() => setKitchenFilter('drinks')} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: kitchenFilter === 'drinks' ? '#0ea5e9' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Boissons uniquement</span></button>
            </div>

            {kitchenSales.length > 5 && (
              <div style={{ background: '#450a0a', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontWeight: 700, marginBottom: '0.5rem' }}><AlertTriangle size={18} /> Alertes</div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#fecaca' }}>{kitchenSales.length - 5} commandes en attente depuis longtemps !</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };
          const renderTables = () => {
    let allTables: any[] = [];
    tableGroups.forEach(g => {
      g.tables?.forEach((t: any) => {
        const tNum = t.name;
        const occupiedSale = draftSales.find(s => s.status === 'Suspendue' && s.referenceNote?.includes(tNum));
        allTables.push({ tNum, groupName: g.name, isOccupied: !!occupiedSale, sale: occupiedSale });
      });
    });
    
    const occupiedCount = allTables.filter(t => t.isOccupied).length;
    const freeCount = allTables.length - occupiedCount;
    
    const selectedTableData = viewSelectedTable ? allTables.find(t => t.tNum === viewSelectedTable) : null;

    return (
      <section style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
        {/* Left Side: Table Grid */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title compact" style={{ marginBottom: '2rem' }}>
            <div><p style={{ color: '#64748b' }}>Restaurant</p><h2 style={{ fontSize: '2rem', color: '#0f172a' }}>Plan de salle</h2></div>
          </div>

          {tableGroups.map((group, groupIdx) => {
            const groupTables = allTables.filter(t => t.groupName === group.name);
            const filteredGroupTables = groupTables.filter(t => {
              if (tableFilter === 'free') return !t.isOccupied;
              if (tableFilter === 'occupied') return t.isOccupied;
              return true;
            });
            
            if (filteredGroupTables.length === 0) return null;

            return (
              <div key={group.name} style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: 0 }}>{group.name}</h3>
                  <button className="ghost-action" onClick={() => {
                    setStatus('Création de table via API non implémentée');
                  }} style={{ fontSize: '0.85rem' }}><Plus size={14} /> Ajouter une table</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {filteredGroupTables.map((t, i) => {
                    const { tNum, isOccupied, sale: occupiedSale } = t;
                    const isSelected = viewSelectedTable === tNum;
                    
                    return (
                      <div key={tNum} style={{ 
                        background: '#fff', 
                        border: `2px solid ${isSelected ? '#3b82f6' : (isOccupied ? '#fca5a5' : '#e2e8f0')}`, 
                        borderRadius: '16px', 
                        overflow: 'hidden',
                        boxShadow: isSelected ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : (isOccupied ? '0 10px 15px -3px rgba(239, 68, 68, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'),
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => setViewSelectedTable(tNum)}
                      className="table-card-hover"
                      >
                        <div style={{ height: '6px', background: isOccupied ? '#ef4444' : '#22c55e', width: '100%' }}></div>
                        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
                          <div style={{ 
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '50%', 
                            background: isOccupied ? '#fef2f2' : '#f0fdf4', 
                            color: isOccupied ? '#ef4444' : '#16a34a', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: `1px solid ${isOccupied ? '#fecaca' : '#bbf7d0'}`
                          }}>
                            <Utensils size={28} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>{tNum.split(' ').slice(1).join(' ')}</h3>
                            <span style={{ fontSize: '0.85rem', color: isOccupied ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{isOccupied ? 'En cours' : 'Libre'}</span>
                          </div>
                          
                          <div style={{ width: '100%', height: '1px', background: '#e2e8f0', margin: '0.2rem 0' }}></div>
                          
                          {isOccupied && occupiedSale ? (
                            <div style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                <span>{occupiedSale.lines?.length || 0} art.</span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatMoney(occupiedSale.total)}</span>
                              </div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}><Clock size={12}/> {occupiedSale.createdAt.split(' ')[1]}</span>
                            </div>
                          ) : (
                            <div style={{ width: '100%', color: '#94a3b8', fontSize: '0.8rem' }}>
                              Prête pour commande
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Contrôles de Salle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dashboard-sidebar-block" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Vue d'ensemble</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{allTables.length}</span><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total</span></div>
              <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{occupiedCount}</span><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Occupées</span></div>
              <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 800, color: '#22c55e' }}>{freeCount}</span><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Libres</span></div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
              <button onClick={() => setTableFilter('all')} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: tableFilter === 'all' ? '#f1f5f9' : '#fff', fontWeight: tableFilter === 'all' ? 700 : 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Toutes les tables</span></button>
              <button onClick={() => setTableFilter('free')} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', background: tableFilter === 'free' ? '#f0fdf4' : '#fff', fontWeight: tableFilter === 'free' ? 700 : 500, color: '#16a34a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Libres</span></button>
              <button onClick={() => setTableFilter('occupied')} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: tableFilter === 'occupied' ? '#fef2f2' : '#fff', fontWeight: tableFilter === 'occupied' ? 700 : 500, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Occupées</span></button>
            </div>

            <button className="primary-action" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
              const name = window.prompt("Nom de la zone (ex: Balcon)");
              if (!name) return;
              const countStr = window.prompt("Nombre de tables dans cette zone ?");
              setStatus('Création de zone via API non implémentée');
            }}><Plus size={16} /> Ajouter une zone</button>
          </div>

          {selectedTableData && (
            <div className="dashboard-sidebar-block" style={{ padding: '1.5rem', border: `2px solid ${selectedTableData.isOccupied ? '#fca5a5' : '#bbf7d0'}` }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#0f172a' }}>{selectedTableData.tNum}</h3>
              <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.9rem' }}>Zone : {selectedTableData.groupName}</p>
              
              {selectedTableData.isOccupied && selectedTableData.sale ? (
                <>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Montant:</span><strong style={{ fontSize: '1.2rem' }}>{formatMoney(selectedTableData.sale.total)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Articles:</span><strong>{selectedTableData.sale.lines?.length || 0}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Début:</span><strong>{selectedTableData.sale.createdAt.split(' ')[1]}</strong></div>
                  </div>
                  <button className="settings-gradient-btn" style={{ width: '100%', padding: '12px', borderRadius: '8px', color: '#fff', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={() => resumeSale(selectedTableData.sale!)}>
                    Ouvrir la Commande <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontWeight: 600 }}>
                    Table prête pour de nouveaux clients
                  </div>
                  <button className="primary-action" style={{ width: '100%', justifyContent: 'center', background: '#22c55e', color: 'white', border: 'none' }} onClick={() => {
                    setSelectedTable(selectedTableData.tNum);
                    setPage('POS');
                  }}>
                    Nouvelle Commande <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderSettings = () => (
    <section className="settings-layout">
      <div className="settings-header">
        <div className="settings-header-title">
          <div className="settings-icon-box"><Settings size={22} /></div>
          Paramètres
        </div>
        <button className="settings-gradient-btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setStatus('Paramètres sauvegardés avec succès !')}>
          <Save size={18} /> Enregistrer
        </button>
      </div>

      <div className="settings-sidebar">
        {[
          { id: 'general', label: 'Général', icon: Globe },
          { id: 'company', label: 'Société', icon: Building },
          { id: 'legal', label: 'Légal & Fiscal', icon: FileText },
          { id: 'templates', label: 'Modèles & Impressions', icon: Palette },
          { id: 'locations', label: 'Boutiques & Emplacements', icon: MapPin },
          { id: 'hardware', label: 'Matériel & Périphériques', icon: Monitor },
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'permissions', label: 'Rôles & Permissions', icon: Shield }
        ].map(t => (
          <button key={t.id} onClick={() => setSettingsTab(t.id as any)} className={`settings-nav-item ${settingsTab === t.id ? 'active' : ''}`}>
            <t.icon size={18} /> <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content-area">
        {settingsTab === 'general' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Configuration</p><h2>Paramètres Généraux</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Préférences globales de l'application.</span></div>
            </div>
            <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '600px' }}>
              <label><span>Devise par défaut</span><select value={companySettings.currency} onChange={e => setCompanySettings(s => ({...s, currency: e.target.value}))} style={{ height: '38px', borderRadius: '8px', border: '1px solid #dbe3ee', padding: '0 12px' }}><option value="MAD">MAD (Dirham)</option><option value="EUR">EUR (Euro)</option><option value="USD">USD (Dollar)</option></select></label>
              <label><span>TVA par défaut (%)</span><input type="number" value={companySettings.defaultTva} onChange={e => setCompanySettings(s => ({...s, defaultTva: e.target.value}))} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row', marginTop: '10px' }}><input type="checkbox" checked={companySettings.pricesIncludeTva} onChange={e => setCompanySettings(s => ({...s, pricesIncludeTva: e.target.checked}))} style={{ width: 'auto' }} /> <span>Les prix saisis incluent la TVA (TTC)</span></label>
              <label style={{ marginTop: '10px' }}>
                <span>Verrouillage automatique (minutes)</span>
                <input type="number" min="0" value={companySettings.autoLockMinutes} onChange={e => setCompanySettings(s => ({...s, autoLockMinutes: Number(e.target.value)}))} style={{ marginTop: '4px' }} />
                <small style={{display:'block',marginTop:'4px',color:'#64748b'}}>0 pour désactiver</small>
              </label>
            </div>
          </div>
        )}

        {settingsTab === 'company' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Identité</p><h2>Informations de la Société</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Coordonnées de l'entreprise et logo.</span></div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: companySettings.logoUrl ? 'transparent' : '#f1f5f9', border: companySettings.logoUrl ? 'none' : '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', overflow: 'hidden' }}>
                {companySettings.logoUrl ? <img src={companySettings.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={32} />}
              </div>
              <div>
                <label style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, color: '#334155', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Télécharger le logo
                  <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setCompanySettings(s => ({...s, logoUrl: URL.createObjectURL(e.target.files![0])}));
                    }
                  }} />
                </label>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Format recommandé: PNG (fond transparent), JPG.</p>
              </div>
            </div>

            <div className="field-cluster" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <label><span>Nom de l'entreprise</span><input value={companySettings.companyName} onChange={e => setCompanySettings(s => ({...s, companyName: e.target.value}))} /></label>
              <label><span>Téléphone</span><input value={companySettings.phone} onChange={e => setCompanySettings(s => ({...s, phone: e.target.value}))} /></label>
              <label style={{ gridColumn: '1 / -1' }}><span>Adresse complète</span><input value={companySettings.address} onChange={e => setCompanySettings(s => ({...s, address: e.target.value}))} /></label>
              <label><span>Email de contact</span><input value={companySettings.email} onChange={e => setCompanySettings(s => ({...s, email: e.target.value}))} /></label>
              <label><span>Couleur de marque</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={companySettings.primaryColor} onChange={e => setCompanySettings(s => ({...s, primaryColor: e.target.value}))} style={{ width: '44px', height: '44px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} />
                  <input value={companySettings.primaryColor} onChange={e => setCompanySettings(s => ({...s, primaryColor: e.target.value}))} style={{ flex: 1, height: '38px', borderRadius: '8px', border: '1px solid #dbe3ee', padding: '0 12px', fontFamily: 'monospace' }} />
                </div>
              </label>
            </div>
          </div>
        )}

        {settingsTab === 'legal' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Identification</p><h2>Légal & Fiscal</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Identifiants officiels utilisés sur vos documents.</span></div>
            </div>
            <div className="field-cluster" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <label><span>Registre du Commerce (RC)</span><input value={companySettings.rc} onChange={e => setCompanySettings(s => ({...s, rc: e.target.value}))} /></label>
              <label><span>Identifiant Commun d'Entreprise (ICE)</span><input value={companySettings.ice} onChange={e => setCompanySettings(s => ({...s, ice: e.target.value}))} /></label>
              <label><span>Identifiant Fiscal (IF)</span><input value={companySettings.if} onChange={e => setCompanySettings(s => ({...s, if: e.target.value}))} /></label>
              <label><span>Taxe Professionnelle (Patente)</span><input value={companySettings.patente} onChange={e => setCompanySettings(s => ({...s, patente: e.target.value}))} /></label>
              <label><span>INPE (Si domaine médical)</span><input value={companySettings.inpe} onChange={e => setCompanySettings(s => ({...s, inpe: e.target.value}))} /></label>
            </div>
          </div>
        )}

        {settingsTab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* TICKET SETTINGS */}
            <div className="settings-templates-grid">
              <div className="product-form-panel" style={{ padding: '2rem' }}>
                <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div><p>POS</p><h2>Modèle de Ticket (Thermique)</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Configuration du ticket de caisse.</span></div>
                </div>
                <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                  <label><span>Titre du ticket</span><input value={companySettings.ticketHeader} onChange={e => setCompanySettings(s => ({...s, ticketHeader: e.target.value}))} /></label>
                  <label><span>Message de remerciement (Pied)</span><textarea value={companySettings.ticketFooter} onChange={e => setCompanySettings(s => ({...s, ticketFooter: e.target.value}))} style={{ height: '60px', resize: 'none', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbe3ee', fontFamily: 'inherit' }} /></label>
                  
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>Préférences d'affichage</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row' }}><input type="checkbox" checked={companySettings.showIceOnTicket} onChange={e => setCompanySettings(s => ({...s, showIceOnTicket: e.target.checked}))} style={{ width: 'auto' }} /> <span>Afficher l'ICE et le RC sur le ticket</span></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row' }}><input type="checkbox" checked={companySettings.showCashierName} onChange={e => setCompanySettings(s => ({...s, showCashierName: e.target.checked}))} style={{ width: 'auto' }} /> <span>Afficher le nom du caissier</span></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row' }}><input type="checkbox" checked={companySettings.showCustomerInfo} onChange={e => setCompanySettings(s => ({...s, showCustomerInfo: e.target.checked}))} style={{ width: 'auto' }} /> <span>Afficher le client si sélectionné</span></label>
                  </div>
                  <label><span>CSS Personnalisé (Avancé)</span><textarea value={companySettings.customTicketCss} onChange={e => setCompanySettings(s => ({...s, customTicketCss: e.target.value}))} style={{ height: '80px', fontFamily: 'monospace', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbe3ee' }} placeholder=".ticket { font-weight: bold; }" /></label>
                </div>
              </div>
              <div className="live-receipt-preview">
                <div style={{ background: '#fff', width: '100%', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '0.8rem', fontFamily: 'monospace', borderRadius: '8px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #cbd5e1' }}>
                    {companySettings.logoUrl && <img src={companySettings.logoUrl} style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain', margin: '0 auto 10px' }} />}
                    <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>{companySettings.companyName || 'Boutique'}</h1>
                    <div>{companySettings.address}</div>
                    <div>Tél: {companySettings.phone}</div>
                    {companySettings.showIceOnTicket && companySettings.ice && <div>ICE: {companySettings.ice}</div>}
                    {companySettings.showIceOnTicket && companySettings.rc && <div>RC: {companySettings.rc}</div>}
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{companySettings.ticketHeader}</div>
                    <div>Date: {new Date().toLocaleDateString('fr-FR')} 14:30</div>
                    <div>Ticket: #0001</div>
                    {companySettings.showCashierName && <div>Caissier: Admin</div>}
                    {companySettings.showCustomerInfo && <div>Client: Client Passager</div>}
                  </div>
                  <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '0.25rem' }}><span>ARTICLE</span><span>PRIX</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1x Produit A</span><span>150.00</span></div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>TOTAL: 150.00 {companySettings.currency}</div>
                  <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>{companySettings.ticketFooter}</div>
                </div>
              </div>
            </div>

            {/* INVOICE SETTINGS */}
            <div className="settings-templates-grid">
              <div className="product-form-panel" style={{ padding: '2rem' }}>
                <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div><p>Facturation</p><h2>Pilotage des factures</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Parametres utiles pour les factures clients, sans les cacher dans un simple bloc template.</span></div>
                </div>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem' }}><span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Mode facture</span><strong style={{ color: '#0f172a' }}>{companySettings.invoiceTicketDisplay === 'DETAILED' ? 'Tickets detailles' : 'Tickets resumes'}</strong><small style={{ display: 'block', color: '#64748b', marginTop: '0.35rem' }}>Vue par defaut sur les factures issues des tickets</small></div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem' }}><span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Reference ticket</span><strong style={{ color: '#0f172a' }}>{companySettings.invoiceShowTicketReferences ? 'Visible' : 'Masquee'}</strong><small style={{ display: 'block', color: '#64748b', marginTop: '0.35rem' }}>Montre le ticket source sur une facture detaillee</small></div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem' }}><span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>Date ticket</span><strong style={{ color: '#0f172a' }}>{companySettings.invoiceShowTicketDates ? 'Visible' : 'Masquee'}</strong><small style={{ display: 'block', color: '#64748b', marginTop: '0.35rem' }}>Affiche la date source si l equipe la veut</small></div>
                  </div>
                  <div style={{ border: '1px solid #dbe3ee', borderRadius: '14px', padding: '1rem', background: '#f8fafc', display: 'grid', gap: '1rem' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>Vue facture par defaut</strong>
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Choisissez la lecture la plus pratique pour vos comptables: regrouper les lignes ou garder chaque ticket detaille.</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button type="button" className={companySettings.invoiceTicketDisplay === 'SUMMARY' ? 'primary-action' : 'ghost-action'} onClick={() => setCompanySettings(s => ({...s, invoiceTicketDisplay: 'SUMMARY'}))}>Tickets resumes</button>
                      <button type="button" className={companySettings.invoiceTicketDisplay === 'DETAILED' ? 'primary-action' : 'ghost-action'} onClick={() => setCompanySettings(s => ({...s, invoiceTicketDisplay: 'DETAILED'}))}>Tickets detailles</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                      <button type="button" className={companySettings.invoiceShowTicketReferences ? 'primary-action' : 'ghost-action'} onClick={() => setCompanySettings(s => ({...s, invoiceShowTicketReferences: !s.invoiceShowTicketReferences}))}>{companySettings.invoiceShowTicketReferences ? 'Masquer references ticket' : 'Afficher references ticket'}</button>
                      <button type="button" className={companySettings.invoiceShowTicketDates ? 'primary-action' : 'ghost-action'} onClick={() => setCompanySettings(s => ({...s, invoiceShowTicketDates: !s.invoiceShowTicketDates}))}>{companySettings.invoiceShowTicketDates ? 'Masquer dates ticket' : 'Afficher dates ticket'}</button>
                    </div>
                  </div>
                </div>
                <div className="field-cluster" style={{ gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                  <label><span>Titre du document</span><input value={companySettings.invoiceHeader} onChange={e => setCompanySettings(s => ({...s, invoiceHeader: e.target.value}))} placeholder="Ex: FACTURE" /></label>
                  <label><span>Conditions de vente / Pied de page</span><textarea value={companySettings.invoiceFooter} onChange={e => setCompanySettings(s => ({...s, invoiceFooter: e.target.value}))} style={{ height: '88px', resize: 'none', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbe3ee', fontFamily: 'inherit' }} /></label>
                  <label><span>CSS personnalise (avance)</span><textarea value={companySettings.customInvoiceCss} onChange={e => setCompanySettings(s => ({...s, customInvoiceCss: e.target.value}))} style={{ height: '88px', fontFamily: 'monospace', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbe3ee' }} placeholder=".invoice-table { border: 1px solid black; }" /></label>
                </div>
              </div>
              <div className="live-receipt-preview">
                <div style={{ background: '#fff', width: '100%', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '0.72rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${companySettings.primaryColor}`, paddingBottom: '1rem', marginBottom: '1rem', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {companySettings.logoUrl && <img src={companySettings.logoUrl} style={{ maxWidth: '100px', maxHeight: '40px', objectFit: 'contain' }} />}
                      <div><h1 style={{ margin: 0, color: companySettings.primaryColor, fontSize: '1.2rem', textTransform: 'uppercase' }}>{companySettings.invoiceHeader || 'FACTURE'}</h1><span style={{ color: '#64748b' }}>No FAC-2026-001</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}><strong>{companySettings.companyName}</strong><br />{companySettings.address}<br />{companySettings.phone}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.6rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}><span style={{ color: '#64748b' }}>Mode</span><strong style={{ display: 'block' }}>{companySettings.invoiceTicketDisplay === 'DETAILED' ? 'Detaille' : 'Resume'}</strong></div>
                    <div style={{ padding: '0.6rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}><span style={{ color: '#64748b' }}>Ref ticket</span><strong style={{ display: 'block' }}>{companySettings.invoiceShowTicketReferences ? 'Oui' : 'Non'}</strong></div>
                    <div style={{ padding: '0.6rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}><span style={{ color: '#64748b' }}>Date ticket</span><strong style={{ display: 'block' }}>{companySettings.invoiceShowTicketDates ? 'Oui' : 'Non'}</strong></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}><span>Description</span><span>Total</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1x Service</span><span>1500.00 {companySettings.currency}</span></div>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ marginBottom: '0.5rem' }}>RC: {companySettings.rc} | ICE: {companySettings.ice} | IF: {companySettings.if} | Patente: {companySettings.patente}</div>
                    <div style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{companySettings.invoiceFooter}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'locations' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><p>Emplacements</p><h2>Gestion des Boutiques</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Gérez vos succursales et magasins.</span></div>
              <button className="primary-action" onClick={async () => {
                try {
                  const response = await apiFetch(`/api/locations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: `Nouvelle Boutique ${locations.length + 1}` }),
                  });
                  if (!response.ok) throw new Error();
                  const loc = (await response.json()).location;
                  setLocations([...locations, { id: loc.id, name: loc.name, address: loc.address || '', phone: '' }]);
                  setStatus('Boutique ajoutée');
                } catch {
                  setStatus('Erreur: Impossible de créer la boutique');
                }
              }}><Plus size={16} /> Ajouter une boutique</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {locations.map((loc, idx) => (
                <div key={loc.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                  <button onClick={() => {
                    if (locations.length > 1) {
                      setLocations(locations.filter(l => l.id !== loc.id));
                      if (currentLocationId === loc.id) setCurrentLocationId(locations.find(l => l.id !== loc.id)!.id);
                    } else {
                      setStatus('Vous devez garder au moins une boutique.');
                    }
                  }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#fee2e2', color: '#ef4444', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>
                  <div className="field-cluster" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingRight: '2.5rem' }}>
                    <label><span>Nom de la boutique</span><input value={loc.name} onChange={e => {
                      const updated = [...locations];
                      updated[idx].name = e.target.value;
                      setLocations(updated);
                    }} /></label>
                    <label><span>Téléphone</span><input value={loc.phone} onChange={e => {
                      const updated = [...locations];
                      updated[idx].phone = e.target.value;
                      setLocations(updated);
                    }} /></label>
                    <label style={{ gridColumn: '1 / -1' }}><span>Adresse complète</span><input value={loc.address} onChange={e => {
                      const updated = [...locations];
                      updated[idx].address = e.target.value;
                      setLocations(updated);
                    }} /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {settingsTab === 'hardware' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Périphériques</p><h2>Balance & Code-barres</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Configuration des codes-barres issus de balances intelligentes.</span></div>
            </div>
            
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="scaleEnabled" checked={companySettings.scaleEnabled} onChange={e => setCompanySettings(s => ({...s, scaleEnabled: e.target.checked}))} style={{ width: '18px', height: '18px' }} />
              <label htmlFor="scaleEnabled" style={{ fontWeight: 700, cursor: 'pointer', margin: 0 }}>Activer l'analyse des codes-barres de balance</label>
            </div>

            {companySettings.scaleEnabled && (
              <div className="field-cluster" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <label>
                  <span>Préfixe de la balance</span>
                  <input type="text" value={companySettings.scalePrefix} onChange={e => setCompanySettings(s => ({...s, scalePrefix: e.target.value}))} placeholder="Ex: 20" />
                </label>
                <label>
                  <span>Longueur du code (SKU)</span>
                  <input type="number" min="4" max="6" value={companySettings.scaleSkuLength} onChange={e => setCompanySettings(s => ({...s, scaleSkuLength: Number(e.target.value)}))} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span>Donnée encodée à la fin du code-barres</span>
                  <select value={companySettings.scaleType} onChange={e => setCompanySettings(s => ({...s, scaleType: e.target.value as any}))}>
                    <option value="WEIGHT">Poids (en grammes)</option>
                    <option value="PRICE">Prix total (en centimes)</option>
                  </select>
                </label>
              </div>
            )}
            
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
              <strong style={{ color: '#3730a3', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Comment ça marche ?</strong>
              <p style={{ color: '#4338ca', fontSize: '0.8rem', margin: 0 }}>Si votre balance imprime un code "20 0145 01250 X" et que vous avez choisi "Poids", le système lira l'article "0145" et ajoutera 1.250 Kg au panier.</p>
            </div>
          </div>
        )}

        {settingsTab === 'users' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Accès</p><h2>Utilisateurs et Rôles</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Gérez les accès à l'application.</span></div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', padding: '12px 16px', background: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>
                <span>Utilisateur</span><span>Rôle</span><span>Statut</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', padding: '16px', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #9333ea)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
                  <div><strong>admin@taysr.com</strong><br/><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Administrateur principal</span></div>
                </div>
                <div><span style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>SUPER ADMIN</span></div>
                <div><span style={{ padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>Actif</span></div>
              </div>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button className="primary-action" disabled style={{ opacity: 0.5 }}>+ Ajouter un utilisateur</button>
            </div>
          </div>
        )}

        {settingsTab === 'permissions' && (
          <div className="product-form-panel" style={{ padding: '2rem' }}>
            <div className="panel-title" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div><p>Accès</p><h2>Rôles & Permissions</h2><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Définissez les modules accessibles pour chaque rôle.</span></div>
              <button className="ghost-action" style={{ color: '#ef4444', fontWeight: 700 }} onClick={() => saveRolePermissions({...defaultRolePermissions})}><RefreshCw size={14} style={{ marginRight: '6px' }} />Réinitialiser</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0' }}>Module</th>
                    {(['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[]).map(role => (
                      <th key={role} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: role === 'ADMIN' ? '#6366f1' : role === 'MANAGER' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', borderBottom: '2px solid #e2e8f0' }}>{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allModuleLabels.filter(m => {
                    const entry = baseModules.find(([label]) => label === m);
                    return entry && (entry[2] === 'POS' || enabledModules.includes(entry[2] as any));
                  }).map((mod, idx) => (
                    <tr key={mod} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }}>{mod}</td>
                      {(['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[]).map(role => {
                        const checked = rolePermissions[role]?.includes(mod) ?? false;
                        const isAdmin = role === 'ADMIN';
                        return (
                          <td key={role} style={{ textAlign: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', cursor: isAdmin ? 'not-allowed' : 'pointer', background: checked ? (isAdmin ? '#eef2ff' : '#f0fdf4') : '#f8fafc', border: `2px solid ${checked ? (isAdmin ? '#a5b4fc' : '#86efac') : '#e2e8f0'}`, transition: 'all 0.15s', opacity: isAdmin ? 0.7 : 1 }}>
                              <input type="checkbox" checked={checked} disabled={isAdmin} onChange={() => {
                                if (isAdmin) return;
                                const current = rolePermissions[role] || [];
                                const updated = checked ? current.filter(m => m !== mod) : [...current, mod];
                                saveRolePermissions({ ...rolePermissions, [role]: updated });
                              }} style={{ width: '16px', height: '16px', cursor: isAdmin ? 'not-allowed' : 'pointer', accentColor: isAdmin ? '#6366f1' : '#16a34a' }} />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', fontSize: '0.85rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} />
              <span>Les permissions <strong>Admin</strong> sont verrouillées pour la sécurité. Modifiez les accès <strong>Manager</strong> et <strong>Caissier</strong> selon vos besoins.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderRegisters = () => {
    const localLogs = registerLogs.filter(log => !log.locationId || log.locationId === currentLocationId);
    return (
    <section className="panel table-section flush-top">
      <div style={{ padding: '1.5rem 1.5rem 0' }}>
        <PageHeader 
          icon={Lock}
          title="Historique des Caisses" 
          subtitle="Suivi des ouvertures et clôtures de caisse" 
        />
      </div>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1.5rem 1.5rem' }}>
        <div className="table-toolbar-stats">
          <div className="toolbar-stat-item">
            <span className="toolbar-stat-value">{localLogs.length}</span>
            <span className="toolbar-stat-label">Sessions</span>
          </div>
        </div>
      </div>
      <div className="data-table">
        <div className="data-head" style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr' }}>
          <span>ID</span><span>Ouverture</span><span>Clôture</span><span>Caissier</span><span>Attendu</span><span>Déclaré</span><span>Écart</span>
        </div>
        {localLogs.map(log => (
          <div className="data-row" style={{ gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1fr 1fr 1fr' }} key={log.id}>
            <span>#{log.id}</span>
            <span>{log.openedAt}</span>
            <span>{log.closedAt}</span>
            <span>{log.cashierName}</span>
            <span>{formatMoney(log.expectedCash)}</span>
            <span>{formatMoney(log.actualCash)}</span>
            <span className={log.difference === 0 ? 'badge ok' : log.difference > 0 ? 'badge ok' : 'badge warn'}>
              {formatMoney(log.difference)}
            </span>
          </div>
        ))}
        {localLogs.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Aucun historique disponible.</div>
        )}
      </div>
    </section>
  )};

  const renderPage = () => {
    if (page === 'Tableau de bord') return renderDashboard();
    if (page === 'POS') return renderRegister();
    if (page === 'Produits') return renderProducts();
    if (page === 'Clients') return renderContacts('Client');
    if (page === 'Fournisseurs') return renderContacts('Fournisseur');
    if (page === 'Stock') return renderStock();
    if (page === 'Achats') return renderPurchases();
    if (page === 'Depenses') return renderExpenses();
    if (page === 'Ventes') return renderSales();
      if (page === 'Factures') return renderFactures();
    if (page === 'Paiements') return renderPayments();
    if (page === 'Rapports') return renderReports();
    if (page === 'Tables') return renderTables();
    if (page === 'Cuisine') return renderKitchen();
    if (page === 'Parametres') return renderSettings();
    if (page === 'Caisses') return renderRegisters();
    return renderDashboard();
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-layout">
        <div className="auth-visual">
          <div style={{ marginBottom: '1.5rem', zIndex: 1 }}>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#ffffff' }}>
              taysr<span style={{ color: '#9333ea' }}>.</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.05em', marginTop: '-4px' }}>
              POS
            </div>
          </div>
          <p>Le systeme de gestion nouvelle generation. Connectez-vous pour acceder a votre espace de travail, gerer vos ventes, votre stock et analyser vos performances en temps reel.</p>
        </div>
        <div className="auth-form-container">
          <div className="auth-form-box" style={{ maxWidth: '400px' }}>
            {(!isLocked || !currentUser) ? (
              <form onSubmit={handleLogin}>
                <h2>Connexion</h2>
                <p>Connectez-vous a l'aide de votre identifiant et mot de passe.</p>
                <div className="form-group" style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1e293b' }}>Email ou identifiant</label>
                  <input type="text" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginAccounts([]); setSelectedLoginAccountId(''); }} required placeholder="admin@taysr.ma ou identifiant" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                {loginAccounts.length > 0 && (
                  <div className="form-group" style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1e293b' }}>Choisir le compte</label>
                    <select value={selectedLoginAccountId} onChange={e => setSelectedLoginAccountId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}>
                      {loginAccounts.map(option => (
                        <option key={option.accountId} value={option.accountId}>{option.companyName} - ACC{String(option.accountId).padStart(6, '0')}</option>
                      ))}
                    </select>
                    <p style={{ marginTop: '8px', color: '#64748b', fontSize: '0.85rem' }}>Utilisez cette liste seulement si le meme email ou identifiant existe dans plusieurs comptes.</p>
                  </div>
                )}
                <div className="form-group" style={{ marginTop: '1rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1e293b' }}>Mot de passe (ex: admin123)</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <button type="submit" className="primary-action" style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
                  Se connecter
                </button>
              </form>
            ) : (
              <>
                <h2>Ecran verrouille</h2>
                <p>Entrez le code PIN pour {currentUser.fullName}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ width: '40px', height: '40px', borderBottom: '3px solid ' + (pinEntry.length > i ? '#6366f1' : '#cbd5e1'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                      {pinEntry.length > i ? '*' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '250px', margin: '0 auto' }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button key={num} onClick={() => setPinEntry(p => p.length < 4 ? p + num.toString() : p)} style={{ padding: '15px', fontSize: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>{num}</button>
                  ))}
                  <button onClick={() => { setIsLocked(false); setCurrentUser(null); setLoginEmail(''); setLoginPassword(''); }} style={{ padding: '15px', fontSize: '14px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>Quitter</button>
                  <button onClick={() => setPinEntry(p => p.length < 4 ? p + '0' : p)} style={{ padding: '15px', fontSize: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>0</button>
                  <button onClick={() => setPinEntry(p => p.slice(0, -1))} style={{ padding: '15px', fontSize: '14px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>Effacer</button>
                </div>
                <button className="primary-action" style={{ width: '100%', marginTop: '20px', padding: '12px' }} onClick={handlePinUnlock} disabled={pinEntry.length !== 4}>Deverrouiller</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {(!isFullscreen || page !== 'POS') && (
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-wordmark">
            <div className="brand-line">
              <strong>taysr<span>.</span></strong>
            </div>
            <em>POS</em>
          </div>
        </div>
        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
          <select 
            value={currentLocationId} 
            onChange={(e) => setCurrentLocationId(Number(e.target.value))}
            style={{ width: '100%', padding: '0.6rem', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="sidebar-search"><button><Search size={18} /><span>Recherche rapide</span><kbd>Ctrl K</kbd></button></div>
        <nav>{visibleModules.map(([label, Icon]) => <button className={label === page ? 'active' : ''} key={label as string} onClick={() => setPage(label as any)}><Icon size={18} /><span>{label as string}</span></button>)}</nav>
        <div className="sidebar-footer">
          {currentUser ? (
            <button className="user-chip" onClick={() => { setIsAuthenticated(false); setCurrentUser(null); }}>
              {currentUser.avatarUrl && <img src={currentUser.avatarUrl} alt={currentUser.fullName || currentUser.username} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}
              <strong>{((currentUser.fullName || currentUser.username || '').split(' ')[0])}</strong>
              <small>{currentUser.role}</small>
            </button>
          ) : (
            <button className="user-chip"><span>A</span><strong>admin</strong><small>ADMIN</small></button>
          )}
        </div>
      </aside>
      )}
      <main className={page === 'POS' ? 'pos-main' : undefined}>
        {renderPage()}
        {receiptSale && <ReceiptPanel sale={receiptSale} settings={companySettings} serialPort={serialPort} onClose={() => setReceiptSale(null)} onReturn={currentUser?.role !== 'CASHIER' ? () => handleReturnSale(receiptSale.id) : undefined} onLoadToCart={() => handleLoadToCart(receiptSale)} onInvoice={() => { const sale = receiptSale; setReceiptSale(null); setInvoiceSale(sale); }} />}
        {purchaseModalOpen && <CreatePurchaseModal suppliers={contacts.filter(c => c.type.includes('Fournisseur'))} warehouses={locations} products={products} formatMoney={formatMoney} onClose={() => setPurchaseModalOpen(false)} onSubmit={async (data) => {
          try {
            const finalItems = [];
            for (const item of data.items) {
              if (item.productId === 'new' && item.newProductName) {
                const newProdRes = await apiFetch('/api/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: item.newProductName,
                    type: 'RETAIL',
                    price: Number(item.cost) * 1.5,
                    costPrice: Number(item.cost),
                    stock: 0
                  })
                });
                if (newProdRes.ok) {
                  const newProd = await newProdRes.json();
                  finalItems.push({ productId: newProd.id, quantity: Number(item.quantity), unitCost: Number(item.cost) });
                }
              } else {
                finalItems.push({ productId: Number(item.productId), quantity: Number(item.quantity), unitCost: Number(item.cost) });
              }
            }

            const res = await apiFetch('/api/purchases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                supplierId: data.supplierId,
                locationId: locations.find(w => w.id === data.warehouseId)?.id || currentLocationId,
                total: data.items.reduce((sum: number, i: any) => sum + (i.quantity * i.cost), 0),
                items: finalItems
              })
            });
            if (res.ok) {
              setPurchaseModalOpen(false);
              setStatus('Bon de commande créé avec succès');
              loadPurchases();
              loadLocations();
              loadProducts();
            } else {
              setStatus('Erreur de création');
            }
          } catch {
            setStatus('Erreur');
          }
        }} />}
        {invoiceSale && <InvoicePanel sale={invoiceSale} settings={companySettings} onClose={() => setInvoiceSale(null)} />}
        {selectedFacture && <FacturePanel facture={selectedFacture} settings={companySettings} onClose={() => setSelectedFacture(null)} />}
        {invoicePaymentTarget && (
          <div className="receipt-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setInvoicePaymentTarget(null); }}>
            <section className="receipt-panel" style={{ maxWidth: '560px', width: '94%' }}>
              <div className="receipt-header"><div><p>Facturation</p><h2>Encaisser une facture</h2></div><button onClick={() => setInvoicePaymentTarget(null)}><XCircle size={18} /></button></div>
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                <div style={{ padding: '0.95rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{invoicePaymentTarget.number}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{invoicePaymentTarget.customer?.name || 'Client inconnu'}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#64748b' }}>Total: <strong style={{ color: '#0f172a' }}>{formatMoney(Number(invoicePaymentTarget.total || 0))}</strong></span>
                    <span style={{ color: '#64748b' }}>Reste: <strong style={{ color: '#c2410c' }}>{formatMoney(getInvoiceDueAmount(invoicePaymentTarget))}</strong></span>
                  </div>
                </div>
                <label><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>Montant</span><input value={invoicePaymentForm.amount} onChange={event => setInvoicePaymentForm(current => ({ ...current, amount: event.target.value }))} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
                <label><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>Mode de paiement</span><select value={invoicePaymentForm.method} onChange={event => setInvoicePaymentForm(current => ({ ...current, method: event.target.value }))} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}><option value="CASH">Especes</option><option value="CARD">Carte</option><option value="TRANSFER">Virement</option><option value="CHECK">Cheque</option><option value="OTHER">Autre</option></select></label>
                <label><span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>Note</span><textarea value={invoicePaymentForm.note} onChange={event => setInvoicePaymentForm(current => ({ ...current, note: event.target.value }))} style={{ width: '100%', height: '92px', resize: 'none', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }} /></label>
              </div>
              <div className="receipt-actions no-print">
                <button type="button" className="ghost-action" onClick={() => setInvoicePaymentTarget(null)}><XCircle size={18} /> Fermer</button>
                <button type="button" className="primary-action" onClick={handleRecordInvoicePayment}><CreditCard size={18} /> Enregistrer le paiement</button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

const Metric = ({ title, value, detail, tone, icon: Icon }: { title: string; value: string; detail: string; tone: string; icon: typeof BarChart3 }) => (
  <div className={`metric-card ${tone}`}><div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div><Icon size={38} /></div>
);

const RecordTable = ({ sales, onOpenReceipt, onOpenInvoice, onResumeSale, onSettleSale, selectedSaleIds, onToggleSaleSelection, isSaleSelectable }: { sales: SaleRecord[]; onOpenReceipt?: (sale: SaleRecord) => void; onOpenInvoice?: (sale: SaleRecord) => void; onResumeSale?: (sale: SaleRecord) => void; onSettleSale?: (sale: SaleRecord) => void; selectedSaleIds?: number[]; onToggleSaleSelection?: (sale: SaleRecord) => void; isSaleSelectable?: (sale: SaleRecord) => boolean }) => (
  <div className="data-table sales-table">
    <div className="data-head"><span style={{ width: '38px' }}></span><span>Ticket</span><span>Client</span><span>Total</span><span>Reste</span><span>Paiement</span><span>Statut</span><span>Action</span></div>
    {sales.map(sale => {
      const isDraftLike = ['Suspendue', 'Brouillon', 'Devis'].includes(sale.status);
      const isPayable = sale.status === 'Payee' || sale.status === 'Credit';
      const paidAmount = sale.splitPayments?.filter(payment => payment.method !== 'CREDIT').reduce((sum, payment) => sum + payment.amount, 0) ?? (sale.status === 'Payee' ? sale.total : 0);
      const dueAmount = Math.max(0, sale.total - paidAmount);
      return (
        <div className="data-row" key={sale.id}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {onToggleSaleSelection && isSaleSelectable ? (
              <input type="checkbox" checked={selectedSaleIds?.includes(sale.id) || false} disabled={!isSaleSelectable(sale)} onChange={() => onToggleSaleSelection(sale)} style={{ width: '16px', height: '16px', cursor: isSaleSelectable(sale) ? 'pointer' : 'not-allowed' }} />
            ) : null}
          </span>
          <span><strong>{sale.ticket}</strong><small>{sale.createdAt}</small></span>
          <span>{sale.customer}<small>{sale.items} article(s)</small></span>
          <span>{formatMoney(sale.total)}</span>
          <span>{sale.status === 'Credit' ? formatMoney(dueAmount) : '-'}</span>
          <span>{methodLabel[sale.method]}</span>
          <span className={sale.status === 'Credit' ? 'badge warn' : sale.status === 'Suspendue' || sale.status === 'Brouillon' || sale.status === 'Devis' ? 'badge neutral' : 'badge ok'}>{sale.status}</span>
          <span>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="row-action" onClick={() => onOpenReceipt?.(sale)}>{isDraftLike ? 'Details' : 'Ticket'}</button>
              {(isPayable || sale.status === 'Devis') && <button className="ghost-action" onClick={() => onOpenInvoice?.(sale)}>Facture</button>}
              {sale.status === 'Credit' && <button className="primary-action" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => onSettleSale?.(sale)}><Banknote size={15} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> Encaisser</button>}
              {isDraftLike && <button className="ghost-action" onClick={() => onResumeSale?.(sale)}>Reprendre</button>}
            </div>
          </span>
        </div>
      );
    })}
  </div>
);

const InvoicePanel = ({ sale, settings, onClose }: { sale: SaleRecord; settings: any; onClose: () => void }) => {
  const isQuotation = sale.status === 'Brouillon' || sale.status === 'Devis';
  const companyAddress = settings.address || settings.companyAddress || '';
  const companyPhone = settings.phone || settings.companyPhone || '';
  const companyIce = settings.ice || settings.companyIce || '';
  const subtotal = sale.lines ? sale.lines.reduce((sum, line) => sum + (line.unitPrice * line.quantity), 0) : sale.total;
  const vatAmount = sale.total - (sale.total / 1.20);
  const htTotal = sale.total - vatAmount;

  return (
  <div className="receipt-backdrop print-a4" role="dialog" aria-modal="true">
    <section className="invoice-panel">
      <div className="invoice-container">
        <div className="invoice-header-row">
          <div className="invoice-brand">
            {settings.showLogo && settings.logoUrl && <img src={settings.logoUrl} alt="Logo" />}
            <h1>{settings.companyName}</h1>
            {companyAddress && <p>{companyAddress}</p>}
            {companyPhone && <p>{companyPhone}</p>}
            <p>ICE: {companyIce || '_________________'}</p>
          </div>
          <div className="invoice-title">
            <h2>{isQuotation ? 'DEVIS' : 'FACTURE'}</h2>
            <p>No {sale.ticket}</p>
          </div>
        </div>

        <div className="invoice-meta-row">
          <div className="invoice-meta-col">
            <span>Date</span>
            <strong>{sale.createdAt.split(' ')[0]}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Client</span>
            <strong>{sale.customer !== 'Client Divers' ? sale.customer : '______________________'}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Methode de paiement</span>
            <strong>{sale.method} {sale.status !== 'Payee' && !isQuotation ? '(Non paye)' : ''}</strong>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Qte</th>
              <th className="right">Prix unitaire</th>
              <th className="right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {(sale.lines || []).map((line, idx) => (
              <tr key={idx}>
                <td>{line.name}</td>
                <td className="right">{line.quantity}</td>
                <td className="right">{formatMoney(line.unitPrice)}</td>
                <td className="right">{formatMoney(line.unitPrice * line.quantity)}</td>
              </tr>
            ))}
            {(!sale.lines || sale.lines.length === 0) && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>
                  Aucun article detaille disponible.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="invoice-summary">
          <div className="invoice-summary-box">
            <div className="invoice-summary-row">
              <span>Total HT</span>
              <span>{formatMoney(htTotal)}</span>
            </div>
            <div className="invoice-summary-row">
              <span>TVA (20%)</span>
              <span>{formatMoney(vatAmount)}</span>
            </div>
            <div className="invoice-summary-row total">
              <span>NET A PAYER</span>
              <span>{formatMoney(sale.total)}</span>
            </div>
          </div>
        </div>

        <div className="invoice-footer">
          {settings.receiptFooter || "Merci de votre confiance. En cas de litige, seul le tribunal de commerce est competent."}
        </div>
      </div>
      <div className="receipt-actions no-print" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '16px' }}>
        <button onClick={onClose}><XCircle size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Fermer</button>
        <button className="primary-action" onClick={() => window.open(`${apiBase}/api/sales/${sale.id}/invoice`, '_blank')}>
          <FileText size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Imprimer (PDF)
        </button>
      </div>
    </section>
  </div>
)};
const ReceiptPanel = ({ sale, settings, onClose, onReturn, onLoadToCart, onInvoice, serialPort }: { sale: SaleRecord; settings: any; onClose: () => void, onReturn?: () => void, onLoadToCart?: () => void, onInvoice?: () => void, serialPort?: any }) => (
  <div className="receipt-backdrop print-receipt" role="dialog" aria-modal="true">
    <section className="receipt-panel" style={{ width: `${settings.ticketPaperWidth * 4}px`, margin: '0 auto' }}>
      <div className="receipt-print-header" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        {settings.showLogo && settings.logoUrl ? (
          <img src={settings.logoUrl} style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} alt="Logo" />
        ) : settings.showLogo ? (
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{settings.companyName}</div>
        ) : null}
        <div style={{ fontSize: '12px', color: '#334155' }}>{settings.address}</div>
        <div style={{ fontSize: '12px', color: '#334155' }}>Tél: {settings.phone}</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '8px' }}>{settings.ticketHeader}</div>
      </div>
      <div className="receipt-header" style={{ background: 'none', border: 'none', padding: 0 }}>
        <div><h2>{sale.ticket}</h2><span style={{ color: '#64748b', fontSize: '12px' }}>{sale.createdAt}</span></div>
        <button onClick={onClose} className="no-print"><XCircle size={18} /></button>
      </div>
      <div className="receipt-meta" style={{ background: 'none', padding: '12px 0', borderBottom: '1px dashed #cbd5e1', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Client:</span><strong>{sale.customer}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Paiement:</span><strong>{methodLabel[sale.method]}</strong></div>
        {sale.splitPayments && sale.splitPayments.map((sp, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px' }}><span>- {methodLabel[sp.method]}:</span><strong>{formatMoney(sp.amount)}</strong></div>
        ))}
      </div>
      <div className="receipt-lines" style={{ padding: '12px 0', borderBottom: '1px dashed #cbd5e1' }}>
        {(sale.lines || []).length ? sale.lines!.map(line => <div key={`${line.productId}-${line.sku}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}><span style={{ flex: 1 }}><strong>{line.name}</strong><br/><small style={{ color: '#64748b' }}>{line.quantity} x {formatMoney(line.unitPrice)}</small></span><b style={{ marginLeft: '12px' }}>{formatMoney(line.lineTotal)}</b></div>) : <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span><strong>{sale.items} article(s)</strong></span><b>{formatMoney(sale.total)}</b></div>}
      </div>
      <div className="receipt-totals" style={{ padding: '12px 0', background: 'none', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>Sous-total</span><strong>{formatMoney(sale.subtotal ?? sale.total)}</strong></div>
        {sale.discountTotal ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>Remise</span><strong>-{formatMoney(sale.discountTotal)}</strong></div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>TVA</span><strong>{formatMoney(sale.taxTotal ?? 0)}</strong></div>
        <div className="grand" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}><span>Total</span><strong>{formatMoney(sale.total)}</strong></div>
      </div>
      {(sale.pointsEarned || sale.pointsUsed) ? (
        <div style={{ padding: '12px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '12px', textAlign: 'center' }}>
          <strong>*** Programme de Fidélité ***</strong>
          {sale.pointsEarned ? <div>Points gagnés: +{sale.pointsEarned}</div> : null}
          {sale.pointsUsed ? <div>Points utilisés: -{sale.pointsUsed}</div> : null}
        </div>
      ) : null}
      <div className="receipt-print-footer" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '11px', color: '#64748b' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>{settings.ticketFooter}</p>
        <p style={{ margin: '2px 0' }}>ICE: {settings.ice} | RC: {settings.rc}</p>
        <p style={{ margin: '2px 0' }}>IF: {settings.if} | Patente: {settings.patente}</p>
      </div>
      <div className="receipt-actions no-print" style={{ marginTop: '2rem', flexWrap: 'wrap' }}>
        <button className="primary-action" onClick={async () => {
          if (serialPort) {
            const data = generateESCPOS(sale, settings);
            await sendToPrinter(serialPort, data);
          } else {
            window.print();
          }
        }}><ReceiptText size={16} style={{marginRight: '6px'}} /> {serialPort ? 'Impression Thermique' : 'Imprimer'}</button>
        <button onClick={onClose}>Fermer</button>
        <button onClick={() => alert('Reçu envoyé par Email à ' + sale.customer)} style={{ color: '#0ea5e9', background: '#e0f2fe', border: 'none' }}><Mail size={16} style={{marginRight: '6px'}} /> Email</button>
        <button onClick={() => alert('Reçu envoyé par SMS à ' + sale.customer)} style={{ color: '#10b981', background: '#d1fae5', border: 'none' }}>SMS</button>
        {onLoadToCart && ['Devis', 'Brouillon', 'Suspendue'].includes(sale.status) && (
          <button className="primary-action" onClick={onLoadToCart} style={{ flex: 1 }}>
            <ShoppingCart size={16} style={{ marginRight: '8px' }} /> Charger dans la caisse
          </button>
        )}
        {onReturn && sale.status === 'Payee' && (
          <button className="secondary-action" onClick={onReturn} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
            <RotateCcw size={16} style={{ marginRight: '8px' }} /> Retourner
          </button>
        )}
        {onInvoice && (
          <button className="ghost-action" onClick={onInvoice}>
            <FileText size={16} style={{ marginRight: '8px' }} /> {sale.status === 'Devis' || sale.status === 'Brouillon' ? 'Ouvrir devis' : 'Facture (A4)'}
          </button>
        )}
        <button className="primary-action" onClick={() => window.open(`${apiBase}/api/sales/${sale.id}/receipt`, '_blank')}>
          <ReceiptText size={16} /> Imprimer
        </button>
      </div>
    </section>
  </div>
);

const ProductsTable = ({ products, filter, setFilter, search, setSearch, visibleTypes, addToCart }: { products: Product[]; filter: ProductType | 'ALL'; setFilter: (value: ProductType | 'ALL') => void; search: string; setSearch: (value: string) => void; visibleTypes: ProductType[]; addToCart: (product: Product) => void }) => (
  <section className="table-section product-list-section">
    <div className="table-toolbar product-list-toolbar">
      <div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher produit, SKU, code-barres..." /></div>
      <div className="filter-row">{(['ALL', ...visibleTypes] as const).map(type => <button className={filter === type ? 'selected' : ''} onClick={() => setFilter(type)} key={type}>{type === 'ALL' ? 'Tous' : typeLabel[type]}</button>)}</div>
    </div>
    <div className="product-table modern-product-table">
      <div className="table-head"><span>Produit</span><span>Catalogue</span><span>Prix</span><span>Stock</span><span>Actions</span></div>
      {products.map(product => <div className="table-row" key={product.id}>
        <span className="product-cell">
          <span className="product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageIcon size={18} />}</span>
          <span>
            <strong>{product.name} {product.isVariable && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#3b82f6', color: 'white', borderRadius: '4px', marginLeft: '6px', verticalAlign: 'middle' }}>Variable ({product.variations?.length || 0})</span>}</strong>
            <small>{product.sku}{product.barcode ? ` / ${product.barcode}` : ''}</small>
          </span>
        </span>
        <span>{product.category}<small>{product.brand || 'Sans marque'} / {product.unit || 'pcs'} / {typeLabel[product.type]}</small></span>
        <span>{product.isVariable ? '-' : formatMoney(product.salePrice)}<small>{product.isVariable ? 'Prix multiples' : `Achat ${formatMoney(product.purchasePrice)} / TVA ${product.tvaRate}%`}</small></span>
        <span><b className={!product.isVariable && product.trackStock && product.stock <= product.lowStockAlert ? 'stock-warn' : 'stock-ok'}>{product.isVariable ? '-' : (product.trackStock ? product.stock : '-')}</b><small>{product.isVariable ? 'Stock par variation' : (product.trackStock ? `Alerte ${product.lowStockAlert}` : 'Non suivi')}</small></span>
        <span className="list-actions"><button className="row-action" onClick={() => addToCart(product)}>Vendre</button><button className="ghost-action">Stock</button></span>
      </div>)}
    </div>
  </section>
);

const CustomerDisplay = () => {
  const [cartState, setCartState] = useState<any>(null);

  useEffect(() => {
    const channel = new BroadcastChannel('taysr-pos-channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'SYNC_CART') {
        setCartState(event.data);
      }
    };
    return () => channel.close();
  }, []);

  if (!cartState || !cartState.cart || cartState.cart.length === 0) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <img src="https://ui-avatars.com/api/?name=Taysr&background=3b82f6&color=fff&size=120&rounded=true" alt="Taysr Logo" style={{ marginBottom: '2rem', boxShadow: '0 10px 25px rgba(59,130,246,0.3)' }} />
        <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>Bienvenue!</h1>
        <p style={{ fontSize: '1.5rem', color: '#94a3b8', marginTop: '1rem' }}>Votre commande s'affichera ici.</p>
      </div>
    );
  }

  const formatMoney = (val: number) => val.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' });

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ flex: 1, padding: '3rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 2rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ShoppingCart size={36} color="#3b82f6" /> Votre Commande
        </h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {cartState.cart.map((line: any, i: number) => {
            const price = line.customPrice ?? (line.variation ? line.variation.salePrice : line.product.salePrice);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '1.5rem 2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>
                    {line.quantity}x
                  </div>
                  <div>
                    <strong style={{ fontSize: '1.5rem', display: 'block' }}>{line.product.name}</strong>
                    {line.variation && <span style={{ fontSize: '1rem', color: '#64748b' }}>{line.variation.name}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{formatMoney(Math.max(0, price - line.discount) * line.quantity)}</strong>
                  {line.discount > 0 && <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>Remise: -{formatMoney(line.discount * line.quantity)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div style={{ width: '400px', background: 'linear-gradient(180deg, #1e293b, #0f172a)', color: '#fff', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Client</div>
          <strong style={{ fontSize: '1.5rem', display: 'block', paddingBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{cartState.customerName}</strong>
          
          <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem', fontSize: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}><span>Sous-total</span><span>{formatMoney(cartState.cartSubtotal)}</span></div>
            {(cartState.cartLineDiscount > 0 || cartState.orderDiscount > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}><span>Remise totale</span><span>-{formatMoney(cartState.cartLineDiscount + cartState.orderDiscount)}</span></div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}><span>TVA</span><span>{formatMoney(cartState.cartTax)}</span></div>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Total à payer</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>{formatMoney(cartState.cartTotal)}</div>
        </div>
      </div>
    </div>
  );
};


class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
          <h2>Something went wrong in the frontend!</h2>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
            {this.state.error?.toString()}
            <br/><br/>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '10px', marginTop: '20px' }}>
            Clear Data & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const parseInvoiceMeta = (notes?: string | null) => {
  if (!notes) {
    return {
      mode: 'FROM_TICKETS' as 'FROM_TICKETS' | 'MANUAL',
      displayMode: 'SUMMARY' as 'SUMMARY' | 'DETAILED',
      manualLines: [] as { description: string; quantity: number; unitPrice: number; tvaRate?: number }[],
      userNote: '',
      payments: [] as { id: string; amount: number; method: string; paidAt: string; note?: string }[]
    };
  }

  try {
    const parsed = JSON.parse(notes);
    return {
      mode: parsed?.mode === 'MANUAL' ? 'MANUAL' as const : 'FROM_TICKETS' as const,
      displayMode: parsed?.displayMode === 'DETAILED' ? 'DETAILED' as const : 'SUMMARY' as const,
      manualLines: Array.isArray(parsed?.manualLines) ? parsed.manualLines : [],
      userNote: typeof parsed?.userNote === 'string' ? parsed.userNote : '',
      payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
    };
  } catch {
    return {
      mode: 'FROM_TICKETS' as const,
      displayMode: 'SUMMARY' as const,
      manualLines: [],
      userNote: notes || '',
      payments: [],
    };
  }
};

const invoiceStatusLabel = (status?: string) => ({
  DRAFT: 'Brouillon',
  SENT: 'Validee',
  PARTIAL: 'Partiellement payee',
  PAID: 'Payee',
  CANCELLED: 'Annulee',
}[status || 'SENT'] || 'Validee');

const invoiceStatusTone = (status?: string) => ({
  DRAFT: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  SENT: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  PARTIAL: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  PAID: { bg: '#ecfdf5', text: '#15803d', border: '#86efac' },
  CANCELLED: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
}[status || 'SENT'] || { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' });

const invoicePaymentMethodLabel = (method?: string) => ({
  CASH: 'Especes',
  CARD: 'Carte',
  TRANSFER: 'Virement',
  CHECK: 'Cheque',
  OTHER: 'Autre',
}[method || 'CASH'] || 'Especes');

const getInvoicePaidAmount = (invoice: any) => parseInvoiceMeta(invoice?.notes).payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
const getInvoiceDueAmount = (invoice: any) => Math.max(0, Number(invoice?.total || 0) - getInvoicePaidAmount(invoice));

const getInvoiceManualLines = (facture: any) => {
  if (Array.isArray(facture?.lines) && facture.lines.length > 0) {
    return facture.lines.map((line: any) => ({
      description: line.description || line.product?.name || '',
      quantity: Number(line.quantity) || 0,
      unitPrice: Number(line.unitPrice) || 0,
      tvaRate: Number(line.tvaRate) || 0,
    }));
  }

  const meta = parseInvoiceMeta(facture?.notes);
  return (meta.manualLines || []).map((line: any) => ({
    description: line.description || '',
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    tvaRate: Number(line.tvaRate) || 0,
  }));
};

const buildInvoiceExportHtml = (facture: any, settings: any) => {
  const meta = parseInvoiceMeta(facture.notes);
  const statusLabel = invoiceStatusLabel(facture.status);
  const paidAmount = getInvoicePaidAmount(facture);
  const dueAmount = getInvoiceDueAmount(facture);
  const sourceLabel = meta.mode === 'MANUAL' ? 'Facture libre' : `${facture.sales?.length || 0} ticket(s)`;
  const manualLines = getInvoiceManualLines(facture);
  const ticketItems = (facture.sales || []).flatMap((sale: any) => sale.items || []);
  const consolidatedTicketItems = Object.values(ticketItems.reduce((acc: any, item: any) => {
    const key = `${item.productId}-${item.variationId || ''}`;
    if (!acc[key]) acc[key] = { name: item.name, quantity: 0, unitPrice: item.unitPrice };
    acc[key].quantity += item.quantity;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; unitPrice: number }>));

  const rows = meta.mode === 'MANUAL'
    ? manualLines.map((line: any) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.unitPrice * line.quantity * (1 + (line.tvaRate || 0) / 100),
      }))
    : (consolidatedTicketItems as any[]).map((line: any) => ({
        description: line.name,
        quantity: line.quantity,
        unitPrice: Number(line.unitPrice || 0),
        total: Number(line.unitPrice || 0) * Number(line.quantity || 0),
      }));

  const footer = (settings.invoiceFooter || '').split('\n').filter(Boolean).map((line: string) => `<div>${line}</div>`).join('');
  const paymentRows = (meta.payments || []).map((payment: any) => `
    <tr>
      <td>${invoicePaymentMethodLabel(payment.method)}</td>
      <td>${new Date(payment.paidAt).toLocaleString('fr-FR')}</td>
      <td style="text-align:right;">${formatMoney(Number(payment.amount || 0))}</td>
    </tr>
  `).join('');
  const lineRows = rows.map((row: any) => `
    <tr>
      <td>${row.description}</td>
      <td style="text-align:right;">${row.quantity}</td>
      <td style="text-align:right;">${formatMoney(row.unitPrice)}</td>
      <td style="text-align:right;">${formatMoney(row.total)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${facture.number}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .page { max-width: 920px; margin: 32px auto; background: #fff; padding: 32px; border-radius: 18px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid ${settings.primaryColor || '#2563eb'}; }
    .title { color: ${settings.primaryColor || '#2563eb'}; font-size: 28px; font-weight: 800; margin: 0; }
    .muted { color: #64748b; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
    .meta-card strong { display: block; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { text-align: left; color: #475569; }
    .totals { margin-top: 20px; margin-left: auto; width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .grand { font-size: 18px; font-weight: 800; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
    .payments { margin-top: 24px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 13px; }
    .toolbar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 16px; }
    button { border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
    .print { background: ${settings.primaryColor || '#2563eb'}; color: #fff; }
    .close { background: #e2e8f0; color: #0f172a; }
    @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; border-radius: 0; max-width: none; } .toolbar { display: none; } }
    ${settings.customInvoiceCss || ''}
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button class="print" onclick="window.print()">Imprimer</button>
      <button class="close" onclick="window.close()">Fermer</button>
    </div>
    <div class="header">
      <div>
        <div class="title">${settings.invoiceHeader || 'FACTURE'}</div>
        <div class="muted">No ${facture.number}</div>
        <div class="muted">${settings.companyName || ''}</div>
        <div class="muted">${settings.address || ''}</div>
        <div class="muted">${settings.phone || ''}</div>
      </div>
      <div style="text-align:right;">
        <div><strong>Client</strong></div>
        <div>${facture.customer?.name || 'Client inconnu'}</div>
        <div class="muted">${sourceLabel}</div>
        <div class="muted">Statut: ${statusLabel}</div>
      </div>
    </div>
    <div class="meta-grid">
      <div class="meta-card"><span class="muted">Date</span><strong>${new Date(facture.createdAt).toLocaleDateString('fr-FR')}</strong></div>
      <div class="meta-card"><span class="muted">Source</span><strong>${sourceLabel}</strong></div>
      <div class="meta-card"><span class="muted">Deja regle</span><strong>${formatMoney(paidAmount)}</strong></div>
      <div class="meta-card"><span class="muted">Reste a regler</span><strong>${formatMoney(dueAmount)}</strong></div>
    </div>
    <table>
      <thead>
        <tr><th>Description</th><th style="text-align:right;">Qte</th><th style="text-align:right;">PU</th><th style="text-align:right;">Total</th></tr>
      </thead>
      <tbody>${lineRows || '<tr><td colspan="4">Aucune ligne disponible.</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Total HT</span><strong>${formatMoney(Number(facture.subtotal || (Number(facture.total) - Number(facture.taxTotal))))}</strong></div>
      <div class="totals-row"><span>TVA</span><strong>${formatMoney(Number(facture.taxTotal || 0))}</strong></div>
      <div class="totals-row grand"><span>Total TTC</span><strong>${formatMoney(Number(facture.total || 0))}</strong></div>
    </div>
    ${paymentRows ? `<div class="payments"><h3>Historique des paiements</h3><table><thead><tr><th>Methode</th><th>Date</th><th style="text-align:right;">Montant</th></tr></thead><tbody>${paymentRows}</tbody></table></div>` : ''}
    <div class="footer">${footer}</div>
  </div>
</body>
</html>`;
};

const openInvoiceDocument = (facture: any, settings: any, mode: 'print' | 'view' = 'view') => {
  const html = buildInvoiceExportHtml(facture, settings);
  const win = window.open('', '_blank', 'width=980,height=900');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (mode === 'print') {
    win.focus();
    win.print();
  }
};

const downloadInvoiceDocument = (facture: any, settings: any) => {
  const html = buildInvoiceExportHtml(facture, settings);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${facture.number}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const shareInvoiceDocument = async (facture: any) => {
  const shareText = [
    `${facture.number} - ${facture.customer?.name || 'Client inconnu'}`,
    `Total: ${formatMoney(Number(facture.total || 0))}`,
    `Reste: ${formatMoney(getInvoiceDueAmount(facture))}`,
    `Statut: ${invoiceStatusLabel(facture.status)}`
  ].join('\n');

  if (navigator.share) {
    await navigator.share({
      title: facture.number,
      text: shareText,
    });
    return 'shared';
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareText);
    return 'copied';
  }

  return 'unsupported';
};

const FacturePanel = ({ facture, settings, onClose }: { facture: any; settings: any; onClose: () => void }) => {
  const meta = parseInvoiceMeta(facture.notes);
  const companyAddress = settings.address || settings.companyAddress || '';
  const companyPhone = settings.phone || settings.companyPhone || '';
  const companyIce = settings.ice || settings.companyIce || '';
  const [mode, setMode] = useState<'SUMMARY' | 'DETAILED'>(meta.displayMode || settings.invoiceTicketDisplay || 'SUMMARY');

  const ticketItems = (facture.sales || []).flatMap((sale: any) => sale.items || []);
  const consolidatedTicketItems = Object.values(ticketItems.reduce((acc: any, item: any) => {
    const key = `${item.productId}-${item.variationId || ''}`;
    if (!acc[key]) {
      acc[key] = { name: item.name, quantity: 0, unitPrice: item.unitPrice };
    }
    acc[key].quantity += item.quantity;
    return acc;
  }, {}));

  const manualLines = getInvoiceManualLines(facture);

  const sourceLabel = meta.mode === 'MANUAL' ? 'Facture libre' : `${facture.sales?.length || 0} ticket(s)`;
  const paidAmount = getInvoicePaidAmount(facture);
  const dueAmount = getInvoiceDueAmount(facture);
  const statusTone = invoiceStatusTone(facture.status);

  return (
  <div className="receipt-backdrop print-a4" role="dialog" aria-modal="true">
    <section className="invoice-panel">
      <div className="invoice-container">
        <div className="invoice-header-row">
          <div className="invoice-brand">
            {settings.showLogo && settings.logoUrl && <img src={settings.logoUrl} alt="Logo" />}
            <h1>{settings.companyName}</h1>
            {companyAddress && <p>{companyAddress}</p>}
            {companyPhone && <p>{companyPhone}</p>}
            <p>ICE: {companyIce || '_________________'}</p>
          </div>
          <div className="invoice-title">
            <h2>{meta.mode === 'MANUAL' ? 'FACTURE' : 'FACTURE GLOBALE'}</h2>
            <p>No {facture.number}</p>
            <div className="no-print" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={`ghost-action ${mode === 'SUMMARY' ? 'selected' : ''}`} onClick={() => setMode('SUMMARY')} style={{ padding: '0.25rem 0.5rem', border: mode === 'SUMMARY' ? '1px solid #cbd5e1' : 'none', borderRadius: '4px' }}>Resumee</button>
              <button type="button" className={`ghost-action ${mode === 'DETAILED' ? 'selected' : ''}`} onClick={() => setMode('DETAILED')} style={{ padding: '0.25rem 0.5rem', border: mode === 'DETAILED' ? '1px solid #cbd5e1' : 'none', borderRadius: '4px' }}>Detaillee</button>
            </div>
          </div>
        </div>

        <div className="invoice-meta-row">
          <div className="invoice-meta-col">
            <span>Date</span>
            <strong>{new Date(facture.createdAt).toLocaleDateString('fr-FR')}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Client</span>
            <strong>{facture.customer?.name || '______________________'}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Source</span>
            <strong>{sourceLabel}</strong>
          </div>
          <div className="invoice-meta-col">
            <span>Statut</span>
            <strong style={{ color: statusTone.text }}>{invoiceStatusLabel(facture.status)}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}><span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem' }}>Total facture</span><strong style={{ color: '#0f172a' }}>{formatMoney(Number(facture.total || 0))}</strong></div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #bbf7d0', background: '#ecfdf5' }}><span style={{ display: 'block', color: '#15803d', fontSize: '0.8rem' }}>Deja regle</span><strong style={{ color: '#15803d' }}>{formatMoney(paidAmount)}</strong></div>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #fdba74', background: '#fff7ed' }}><span style={{ display: 'block', color: '#9a3412', fontSize: '0.8rem' }}>Reste a regler</span><strong style={{ color: '#c2410c' }}>{formatMoney(dueAmount)}</strong></div>
        </div>

        {meta.userNote && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#334155' }}>
            <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Note</strong>
            <span>{meta.userNote}</span>
          </div>
        )}

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Qte</th>
              <th className="right">Prix unitaire</th>
              <th className="right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {meta.mode === 'MANUAL' ? (
              manualLines.map((line: { description: string; quantity: number; unitPrice: number; tvaRate: number }, idx: number) => (
                <tr key={idx}>
                  <td>{line.description}</td>
                  <td className="right">{line.quantity}</td>
                  <td className="right">{formatMoney(line.unitPrice)}</td>
                  <td className="right">{formatMoney(line.unitPrice * line.quantity * (1 + (line.tvaRate || 0) / 100))}</td>
                </tr>
              ))
            ) : mode === 'DETAILED' ? (
              (facture.sales || []).map((sale: any) => (
                <React.Fragment key={sale.id}>
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={4} style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                      {(settings.invoiceShowTicketReferences ?? true) ? `Ticket ${sale.ticketNumber || sale.ticket || sale.id}` : ''}
                      {(settings.invoiceShowTicketReferences ?? true) && (settings.invoiceShowTicketDates ?? true) ? ' - ' : ''}
                      {(settings.invoiceShowTicketDates ?? true) ? new Date(sale.createdAt).toLocaleDateString('fr-FR') : ''}
                    </td>
                  </tr>
                  {(sale.items || []).map((line: any, idx: number) => (
                    <tr key={`${sale.id}-${idx}`}>
                      <td>{line.name}</td>
                      <td className="right">{line.quantity}</td>
                      <td className="right">{formatMoney(line.unitPrice)}</td>
                      <td className="right">{formatMoney(line.unitPrice * line.quantity)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            ) : (
              (consolidatedTicketItems as any[]).map((line: any, idx: number) => (
                <tr key={idx}>
                  <td>{line.name}</td>
                  <td className="right">{line.quantity}</td>
                  <td className="right">{formatMoney(line.unitPrice)}</td>
                  <td className="right">{formatMoney(line.unitPrice * line.quantity)}</td>
                </tr>
              ))
            )}
            {meta.mode === 'MANUAL' && manualLines.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>Aucune ligne manuelle disponible.</td>
              </tr>
            )}
            {meta.mode !== 'MANUAL' && ticketItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>Aucune ligne ticket disponible.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div className="invoice-total-row">
            <span>Total HT:</span>
            <span>{formatMoney(Number(facture.subtotal || (Number(facture.total) - Number(facture.taxTotal))))}</span>
          </div>
          <div className="invoice-total-row">
            <span>TVA:</span>
            <span>{formatMoney(Number(facture.taxTotal || 0))}</span>
          </div>
          <div className="invoice-total-row grand-total">
            <span>Net a payer TTC:</span>
            <span>{formatMoney(Number(facture.total || 0))}</span>
          </div>
        </div>

        {meta.payments.length > 0 && (
          <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.65rem', color: '#0f172a' }}>Historique des paiements</strong>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {meta.payments.map((payment: any) => (
                <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.8rem 0.95rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>{invoicePaymentMethodLabel(payment.method)}</strong>
                    <small style={{ color: '#64748b' }}>{new Date(payment.paidAt).toLocaleString('fr-FR')}</small>
                    {payment.note ? <small style={{ display: 'block', color: '#64748b', marginTop: '0.2rem' }}>{payment.note}</small> : null}
                  </div>
                  <strong style={{ color: '#15803d' }}>{formatMoney(Number(payment.amount || 0))}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="invoice-footer">
          {settings.invoiceFooter?.split('\n').map((line: string, i: number) => <p key={i}>{line}</p>)}
        </div>
      </div>
      <div className="receipt-actions no-print">
        <button type="button" className="ghost-action" onClick={() => openInvoiceDocument(facture, settings, 'view')}><FileText size={18} /> Ouvrir</button>
        <button type="button" className="ghost-action" onClick={() => downloadInvoiceDocument(facture, settings)}><Download size={18} /> Exporter</button>
        <button type="button" className="primary-action" onClick={() => openInvoiceDocument(facture, settings, 'print')}><FileText size={18} /> Imprimer</button>
        <button type="button" className="ghost-action" onClick={onClose}><XCircle size={18} /> Fermer</button>
      </div>
    </section>
  </div>
  );
};




















const isCustomerDisplay = new URLSearchParams(window.location.search).get('mode') === 'customer';

createRoot(document.getElementById('root')!).render(isCustomerDisplay ? <CustomerDisplay /> : <ErrorBoundary><App /></ErrorBoundary>);


