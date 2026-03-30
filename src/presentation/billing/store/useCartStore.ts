import { create } from 'zustand';
import { Product } from '../../../data/database';

export interface CartItem extends Product {
  cartItemId: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  customerName: string;
  tableNo: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  taxRate: number; // e.g., 5 for 5%
  paymentMode: 'Cash' | 'UPI' | 'Card';
  editBillId: number | null;
  editBillNo: string | null;
  editCreatedAt: Date | null;
  
  addItem: (product: Product) => void;
  removeItem: (cartItemId: string) => void;
  updateQty: (cartItemId: string, qty: number) => void;
  setCustomerInfo: (name: string, tableNo: string) => void;
  setDiscount: (type: 'flat' | 'percent', value: number) => void;
  setTaxRate: (rate: number) => void;
  setPaymentMode: (mode: 'Cash' | 'UPI' | 'Card') => void;
  loadBill: (bill: any, billItems: any[], products: Product[]) => void;
  clearCart: () => void;
  getTotals: () => { subtotal: number; discountAmount: number; taxAmount: number; total: number };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerName: '',
  tableNo: '',
  discountType: 'flat',
  discountValue: 0,
  taxRate: 0,
  paymentMode: 'Cash',
  editBillId: null,
  editBillNo: null,
  editCreatedAt: null,

  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          ),
        };
      }
      return {
        items: [...state.items, { ...product, cartItemId: Math.random().toString(36).substr(2, 9), qty: 1 }],
      };
    });
  },

  removeItem: (cartItemId) => {
    set((state) => ({
      items: state.items.filter((item) => item.cartItemId !== cartItemId),
    }));
  },

  updateQty: (cartItemId, qty) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.cartItemId === cartItemId ? { ...item, qty: Math.max(1, qty) } : item
      ),
    }));
  },

  setCustomerInfo: (customerName, tableNo) => set({ customerName, tableNo }),
  
  setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),
  
  setTaxRate: (taxRate) => set({ taxRate }),
  
  setPaymentMode: (paymentMode) => set({ paymentMode }),

  loadBill: (bill, billItems, products) => {
    const items: CartItem[] = billItems.map(bItem => {
      const product = products.find(p => p.id === bItem.productId);
      return {
        id: bItem.productId,
        name: bItem.productName,
        price: bItem.unitPrice,
        taxRate: bItem.taxRate,
        categoryId: product?.categoryId || 0,
        stockQty: product?.stockQty || 0,
        isAvailable: true,
        hsnCode: product?.hsnCode || '',
        imagePath: product?.imagePath || '',
        createdAt: product?.createdAt || new Date(),
        cartItemId: Math.random().toString(36).substr(2, 9),
        qty: bItem.qty
      };
    });

    set({
      items,
      customerName: bill.customerName || '',
      tableNo: bill.tableNo || '',
      discountType: 'flat',
      discountValue: bill.discount || 0,
      taxRate: bill.taxAmount > 0 ? Math.round((bill.taxAmount / (bill.subtotal - bill.discount)) * 100) : 0,
      paymentMode: bill.paymentMode as any,
      editBillId: bill.id,
      editBillNo: bill.billNo,
      editCreatedAt: bill.createdAt
    });
  },

  clearCart: () => set({
    items: [],
    customerName: '',
    tableNo: '',
    discountType: 'flat',
    discountValue: 0,
    taxRate: 0,
    paymentMode: 'Cash',
    editBillId: null,
    editBillNo: null,
    editCreatedAt: null
  }),

  getTotals: () => {
    const { items, discountType, discountValue, taxRate } = get();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    
    let discountAmount = 0;
    if (discountType === 'flat') {
      discountAmount = discountValue;
    } else {
      discountAmount = subtotal * (discountValue / 100);
    }
    
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  },
}));
