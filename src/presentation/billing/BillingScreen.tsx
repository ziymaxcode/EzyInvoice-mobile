import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Bill, BillItem } from '../../data/database';
import { useCartStore } from './store/useCartStore';
import { printerService } from '../../services/printerService';
import { buildReceipt } from '../../services/receiptBuilder';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, QrCode, Printer, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../core/utils/cn';

export function BillingScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTotalsExpanded, setIsTotalsExpanded] = useState(false);

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray()) || [];
  
  const products = useLiveQuery(() => {
    let collection = db.products.toCollection();
    
    if (selectedCategory !== null) {
      collection = db.products.where('categoryId').equals(selectedCategory);
    }
    
    return collection.filter(product => 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) && product.isAvailable
    ).toArray();
  }, [searchQuery, selectedCategory]) || [];

  const paperSizeSetting = useLiveQuery(() => db.settings.get('printerPaperSize'));
  const paperSize = (paperSizeSetting?.value as '58mm' | '80mm') || '58mm';
  
  const shopProfile = useLiveQuery(() => db.shops.toCollection().first());
  const shopName = shopProfile?.name || "Ezy POS";

  const { 
    items, addItem, removeItem, updateQty, 
    customerName, tableNo, setCustomerInfo,
    discountType, discountValue, setDiscount,
    taxRate, setTaxRate,
    paymentMode, setPaymentMode,
    clearCart, getTotals,
    editBillId, editBillNo, editCreatedAt
  } = useCartStore();

  const { subtotal, discountAmount, taxAmount, total } = getTotals();

  const handleCheckout = async (printReceipt: boolean = false) => {
    if (items.length === 0) return;
    setIsProcessing(true);

    try {
      let billId = editBillId;
      let billNo = editBillNo;

      if (!billId) {
        // Generate Bill Number
        const today = new Date();
        const dateStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
        const count = await db.bills.count();
        billNo = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
      }

      // Save Bill
      const billData: Bill = {
        billNo: billNo!,
        customerName,
        tableNo,
        subtotal,
        discount: discountAmount,
        taxAmount,
        total,
        paymentMode,
        status: 'completed',
        createdAt: editCreatedAt || new Date(),
      };
      
      if (billId) {
        billData.id = billId;
        await db.bills.update(billId, billData);
        
        // Revert old stock
        const oldItems = await db.billItems.where('billId').equals(billId).toArray();
        for (const oldItem of oldItems) {
          const product = await db.products.get(oldItem.productId);
          if (product) {
            await db.products.update(product.id!, {
              stockQty: product.stockQty + oldItem.qty
            });
          }
        }
        // Delete old items
        await db.billItems.where('billId').equals(billId).delete();
      } else {
        billId = await db.bills.add(billData) as number;
        billData.id = billId;
      }

      // Save Bill Items and Update Stock
      const billItemsData: BillItem[] = [];
      for (const item of items) {
        const bItem: BillItem = {
          billId: billId as number,
          productId: item.id!,
          productName: item.name,
          qty: item.qty,
          unitPrice: item.price,
          taxRate: item.taxRate,
          amount: item.price * item.qty,
        };
        await db.billItems.add(bItem);
        billItemsData.push(bItem);

        // Update stock
        const product = await db.products.get(item.id!);
        if (product) {
          await db.products.update(item.id!, {
            stockQty: Math.max(0, product.stockQty - item.qty)
          });
        }
      }

      if (printReceipt) {
        try {
          if (!printerService.isConnected()) {
            await printerService.connect();
          }
          const receiptData = buildReceipt(billData, billItemsData, shopProfile || null, paperSize);
          await printerService.print(receiptData);
        } catch (printError: any) {
          console.error("Print failed:", printError);
          alert("Bill saved, but printing failed: " + printError.message);
        }
      } else {
        alert(`Bill ${billNo} saved successfully!`);
      }

      clearCart();
      setIsCartOpen(false);
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Failed to save bill. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="flex h-full md:h-screen overflow-hidden bg-[#F2F2F7]">
      {/* Left Panel: Products */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header & Search */}
        <div className="p-4 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] z-10">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E6E73]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F2F2F7] border-none rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none transition-shadow"
            />
          </div>
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="px-4 py-3 overflow-x-auto whitespace-nowrap hide-scrollbar border-b border-[#C6C6C8]/50 bg-white">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "inline-block px-5 py-2 rounded-full text-sm font-semibold mr-2 transition-colors",
              selectedCategory === null 
                ? "bg-[#007AFF] text-white shadow-md" 
                : "bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E3E3E8]"
            )}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id!)}
              className={cn(
                "inline-block px-5 py-2 rounded-full text-sm font-semibold mr-2 transition-colors",
                selectedCategory === cat.id 
                  ? "bg-[#007AFF] text-white shadow-md" 
                  : "bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E3E3E8]"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => addItem(product)}
                className="bg-white p-4 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] flex flex-col items-center text-center active:scale-95 transition-transform"
              >
                {product.imagePath ? (
                  <img src={product.imagePath} alt={product.name} className="w-16 h-16 rounded-full mb-3 object-cover bg-[#F2F2F7]" />
                ) : (
                  <div className="w-16 h-16 bg-[#F2F2F7] rounded-full mb-3 flex items-center justify-center text-2xl">
                    📦
                  </div>
                )}
                <h3 className="font-semibold text-[#1C1C1E] text-sm line-clamp-2 mb-1">{product.name}</h3>
                <p className="text-[#007AFF] font-bold mt-auto">₹{product.price.toFixed(2)}</p>
              </button>
            ))}
            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#6E6E73]">
                No products found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle */}
      <button 
        onClick={() => setIsCartOpen(true)}
        className="md:hidden fixed bottom-20 right-4 bg-[#007AFF] text-white p-4 rounded-full shadow-lg z-40 flex items-center justify-center"
      >
        <ShoppingCart className="w-6 h-6" />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#FF3B30] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
            {totalItems}
          </span>
        )}
      </button>

      {/* Right Panel: Cart (Sidebar on Desktop, Modal on Mobile) */}
      <div className={cn(
        "fixed inset-0 z-[45] bg-black/50 transition-opacity md:hidden",
        isCartOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsCartOpen(false)} />

      <div className={cn(
        "fixed md:static top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 right-0 z-[45] w-full md:w-96 bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.05)] flex flex-col transition-transform duration-300 ease-in-out",
        isCartOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {/* Cart Header */}
        <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-bold text-[#1C1C1E]">
            {editBillNo ? `Editing ${editBillNo}` : 'Current Bill'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={clearCart} className="text-[#FF3B30] text-sm font-semibold px-3 py-1 bg-[#FF3B30]/10 rounded-full">
              Clear
            </button>
            <button onClick={() => setIsCartOpen(false)} className="md:hidden p-2 text-[#6E6E73] hover:bg-[#F2F2F7] rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Customer Info */}
          <div className="p-4 border-b border-[#C6C6C8]/50 flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="Customer Name" 
              value={customerName}
              onChange={(e) => setCustomerInfo(e.target.value, tableNo)}
              className="flex-1 bg-[#F2F2F7] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
            <input 
              type="text" 
              placeholder="Table" 
              value={tableNo}
              onChange={(e) => setCustomerInfo(customerName, e.target.value)}
              className="w-20 bg-[#F2F2F7] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#6E6E73] space-y-3">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>Cart is empty</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.cartItemId} className="flex items-center justify-between bg-white border border-[#C6C6C8]/30 p-3 rounded-2xl shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-semibold text-sm text-[#1C1C1E] truncate">{item.name}</h4>
                    <p className="text-[#007AFF] text-sm font-medium">₹{(item.price * item.qty).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-[#F2F2F7] rounded-full p-1">
                    <button 
                      onClick={() => item.qty > 1 ? updateQty(item.cartItemId, item.qty - 1) : removeItem(item.cartItemId)}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-[#1C1C1E] active:scale-95"
                    >
                      {item.qty > 1 ? <Minus className="w-4 h-4" /> : <Trash2 className="w-4 h-4 text-[#FF3B30]" />}
                    </button>
                    <span className="font-semibold w-4 text-center text-sm">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.cartItemId, item.qty + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-[#1C1C1E] active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Payment Modes */}
          <div className="bg-white border-t border-[#C6C6C8]/50 p-4 space-y-4 shrink-0">
            {/* Collapsible Header for Mobile */}
            <button 
              onClick={() => setIsTotalsExpanded(!isTotalsExpanded)}
              className="w-full flex items-center justify-between md:hidden text-[#1C1C1E] font-semibold"
            >
              <div className="flex items-center gap-2">
                <span>Total: ₹{total.toFixed(2)}</span>
              </div>
              {isTotalsExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>

            <div className={cn(
              "space-y-4 md:block",
              isTotalsExpanded ? "block" : "hidden"
            )}>
              {/* Discount & Tax Toggles */}
              <div className="flex gap-2">
                <div className="flex-1 flex bg-[#F2F2F7] rounded-xl p-1">
                  <input 
                    type="number" 
                    placeholder="Discount" 
                    value={discountValue || ''}
                    onChange={(e) => setDiscount(discountType, parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent px-2 text-sm outline-none"
                  />
                  <button 
                    onClick={() => setDiscount(discountType === 'flat' ? 'percent' : 'flat', discountValue)}
                    className="bg-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm"
                  >
                    {discountType === 'flat' ? '₹' : '%'}
                  </button>
                </div>
                <div className="flex-1 flex bg-[#F2F2F7] rounded-xl p-1 items-center px-3">
                  <span className="text-xs font-semibold text-[#6E6E73] mr-2">Tax %</span>
                  <input 
                    type="number" 
                    value={taxRate || ''}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#34C759]">
                    <span>Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-[#6E6E73]">
                    <span>Tax ({taxRate}%)</span>
                    <span>+₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-[#1C1C1E] pt-2 border-t border-[#C6C6C8]/50">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Modes */}
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Card'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={cn(
                    "py-2 rounded-xl text-sm font-semibold flex flex-col items-center gap-1 transition-colors",
                    paymentMode === mode 
                      ? "bg-[#007AFF]/10 text-[#007AFF] border-2 border-[#007AFF]" 
                      : "bg-[#F2F2F7] text-[#6E6E73] border-2 border-transparent"
                  )}
                >
                  {mode === 'Cash' && <Banknote className="w-5 h-5" />}
                  {mode === 'UPI' && <QrCode className="w-5 h-5" />}
                  {mode === 'Card' && <CreditCard className="w-5 h-5" />}
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions (Fixed at bottom) */}
        <div className="p-4 bg-white border-t border-[#C6C6C8]/50 shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
          <div className="flex gap-2">
            <button 
              onClick={() => handleCheckout(true)}
              disabled={items.length === 0 || isProcessing}
              className="flex-1 bg-[#F2F2F7] text-[#1C1C1E] py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button 
              onClick={() => handleCheckout(false)}
              disabled={items.length === 0 || isProcessing}
              className="flex-[2] bg-[#34C759] disabled:bg-[#34C759]/50 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {editBillId ? 'Update Bill' : 'Save Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

