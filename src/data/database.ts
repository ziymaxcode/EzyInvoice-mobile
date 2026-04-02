import Dexie, { type EntityTable } from 'dexie';

export interface Shop {
  id?: number;
  name: string;
  address: string;
  phone: string;
  gstNo: string;
  upiId?: string;
  logoPath: string;
  createdAt: Date;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Product {
  id?: number;
  name: string;
  categoryId: number;
  price: number;
  taxRate: number;
  hsnCode: string;
  imagePath: string;
  stockQty: number;
  isAvailable: boolean;
  createdAt: Date;
}

export interface Bill {
  id?: number;
  billNo: string;
  customerName: string;
  tableNo: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paymentMode: string;
  status: string;
  createdAt: Date;
}

export interface BillItem {
  id?: number;
  billId: number;
  productId: number;
  productName: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface User {
  id?: number;
  name: string;
  role: string;
  pinHash: string;
  createdAt: Date;
}

export interface PrinterConfig {
  id?: number;
  name: string;
  address: string;
  type: string; // BT/WiFi
  paperSize: string; // 58mm/80mm
  isDefault: boolean;
}

export interface Setting {
  key: string;
  value: string;
}

export class PosDatabase extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  products!: EntityTable<Product, 'id'>;
  bills!: EntityTable<Bill, 'id'>;
  billItems!: EntityTable<BillItem, 'id'>;
  users!: EntityTable<User, 'id'>;
  printerConfigs!: EntityTable<PrinterConfig, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('PosDatabase');
    this.version(1).stores({
      shops: '++id, name',
      categories: '++id, name, sortOrder',
      products: '++id, name, categoryId, isAvailable',
      bills: '++id, billNo, createdAt, paymentMode, status',
      billItems: '++id, billId, productId',
      users: '++id, name, role',
      printerConfigs: '++id, name, isDefault',
      settings: 'key'
    });
  }
}

export const db = new PosDatabase();
