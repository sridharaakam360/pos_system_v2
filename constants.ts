import { Currency, Store, Category, Product, Invoice, GlobalSettings } from './types';

export const INITIAL_GLOBAL_SETTINGS: GlobalSettings = {
  dataSource: 'MYSQL_API',
  mysqlApiUrl: 'https://apipostest.yugan.tech/api',
  defaultTaxPresets: [0, 5, 12, 18, 28]
};

export const INITIAL_STORES: Store[] = [
  {
    id: 'store_1',
    name: 'Tech Haven Electronics',
    ownerName: 'Alice Smith',
    currency: Currency.USD,
    gstNumber: 'US123456789',
    address: '123 Tech Blvd, San Francisco, CA',
    isActive: true,
    primaryUpiId: 'techhaven@bank',
    secondaryUpiId: 'alice.smith@upi',
    activeUpiIdType: 'PRIMARY'
  },
  {
    id: 'store_2',
    name: 'Fresh Mart Grocery',
    ownerName: 'Bob Jones',
    currency: Currency.INR,
    gstNumber: '27ABCDE1234F1Z5',
    address: '45 Market St, Mumbai, MH',
    isActive: true,
    primaryUpiId: 'freshmart@upi',
    activeUpiIdType: 'PRIMARY'
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_1', storeId: 'store_1', name: 'Laptops', defaultGST: 18 },
  { id: 'cat_2', storeId: 'store_1', name: 'Accessories', defaultGST: 12 },
  { id: 'cat_3', storeId: 'store_2', name: 'Vegetables', defaultGST: 0 },
  { id: 'cat_4', storeId: 'store_2', name: 'Packaged Foods', defaultGST: 5 },
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: 'prod_1', storeId: 'store_1', categoryId: 'cat_1', name: 'MacBook Pro M3', price: 1599, stockQty: 10, taxOverride: null, sku: 'MBP-M3' },
  { id: 'prod_2', storeId: 'store_1', categoryId: 'cat_2', name: 'USB-C Cable', price: 19.99, stockQty: 50, taxOverride: null, sku: 'CABLE-C' },
  { id: 'prod_3', storeId: 'store_2', categoryId: 'cat_3', name: 'Potatoes (1kg)', price: 40, stockQty: 200, taxOverride: null, sku: 'POT-1KG' },
  { id: 'prod_4', storeId: 'store_2', categoryId: 'cat_4', name: 'Biscuits', price: 20, stockQty: 100, taxOverride: null, sku: 'BISC-G' },
];

export const INITIAL_INVOICES: Invoice[] = []; // Start empty or add historical data if needed