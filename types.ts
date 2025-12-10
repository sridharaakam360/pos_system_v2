export enum Currency {
  INR = 'INR',
  USD = 'USD',
  AED = 'AED',
  EUR = 'EUR'
}

export type DataSource = 'MYSQL_API' | 'LOCAL_STORAGE';

export interface GlobalSettings {
  dataSource: DataSource;
  mysqlApiUrl: string; // The backend endpoint for MySQL connection
  defaultTaxPresets: number[];
}

export interface Store {
  id: string;
  name: string;
  ownerName: string;
  currency: Currency;
  gstNumber?: string;
  address: string;
  primaryUpiId?: string;
  secondaryUpiId?: string;
  activeUpiIdType?: 'PRIMARY' | 'SECONDARY';
  isActive: boolean;
  email?: string;
  mobile?: string;
  logoUrl?: string;
  timezone?: string;
  globalDiscount?: number; // Store-wide default discount (Limited period)
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  defaultGST: number; // Percentage
  defaultDiscount?: number; // Default category discount %
  lowStockThreshold?: number; // Quantity at which to trigger alert
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  price: number;
  stockQty: number;
  taxOverride?: number | null; // If null, use category default
  sku?: string;
  imageUrl?: string;
  costPrice?: number; // Cost Price for profit calculation
}

export interface CartItem extends Product {
  quantity: number;
  appliedTaxPercent: number;
  appliedDiscountPercent: number;
  lineTotal: number;
}

export interface Customer {
  id?: string;
  storeId: string;
  name: string;
  mobile?: string;
  email?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  place?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;                    // will be real UUID from server
  invoiceNumber: string;
  storeId: string;
  customerId?: string;           // Optional customer reference
  customerInfo?: Customer;       // Optional customer details
  date: string;
  items: CartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'QR';
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'RETRY';  // Payment status tracking
  retryCount?: number;           // Number of retry attempts
  synced: boolean;
}

export type ViewMode = 'SUPER_ADMIN' | 'STORE_ADMIN' | 'POS' | 'PROFILE';
export type UserRole = 'SUPER_ADMIN' | 'STORE_ADMIN' | 'CASHIER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  storeId?: string; // specific store assignment
  displayName?: string;
  phoneNumber?: string;
  email?: string;
  imageUrl?: string;
}

export interface UserContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  activeStoreId: string | null;
  setActiveStoreId: (id: string) => void;
}

export interface DataContextType {
  stores: Store[];
  categories: Category[];
  products: Product[];
  invoices: Invoice[];
  addStore: (store: Store) => void;
  addCategory: (cat: Category) => void;
  addProduct: (prod: Product) => void;
  addInvoice: (inv: Invoice) => void;
  updateProductStock: (id: string, qty: number) => void;
}

export interface ReportData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  taxCollected: number;
  netIncome: number;
  margin: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  profit: number;
}

export interface TopProduct {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  revenue: number;
  profit: number;
  itemCount: number;
}

export interface HeatmapData {
  dayOfWeek: string; // 'Mon', 'Tue', etc.
  hour: number; // 0-23
  salesCount: number;
  revenue: number;
}

export interface PaymentStats {
  method: string;
  count: number;
  revenue: number;
}

export interface DrillDownInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  items: string; // Summary of items
  total: number;
  profit: number;
}