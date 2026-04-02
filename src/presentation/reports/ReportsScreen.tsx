import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../billing/store/useCartStore';
import { db, Bill } from '../../data/database';
import { Search, Calendar, Filter, TrendingUp, Receipt, IndianRupee, Printer, X, Download, MessageCircle, Edit } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, isAfter, startOfDay, endOfDay } from 'date-fns';
import { printerService } from '../../services/printerService';
import { buildReceipt } from '../../services/receiptBuilder';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import QRCode from 'qrcode';

export function ReportsScreen() {
  const navigate = useNavigate();
  const { loadBill } = useCartStore();
  const [activeTab, setActiveTab] = useState<'history' | 'analytics'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const paperSizeSetting = useLiveQuery(() => db.settings.get('printerPaperSize'));
  const paperSize = (paperSizeSetting?.value as '58mm' | '80mm') || '58mm';
  
  const shopProfile = useLiveQuery(() => db.shops.toCollection().first());
  const shopName = shopProfile?.name || "MY SHOP";

  const bills = useLiveQuery(() => {
    let collection = db.bills.orderBy('createdAt').reverse();
    return collection.toArray();
  }, []) || [];

  const filteredBills = useMemo(() => {
    let result = bills;

    // Date Filter
    const now = new Date();
    if (dateFilter === 'today') {
      const start = startOfDay(now);
      result = result.filter(b => b.createdAt >= start);
    } else if (dateFilter === 'week') {
      const start = subDays(now, 7);
      result = result.filter(b => b.createdAt >= start);
    } else if (dateFilter === 'month') {
      const start = subDays(now, 30);
      result = result.filter(b => b.createdAt >= start);
    }

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.billNo.toLowerCase().includes(q) || 
        (b.customerName && b.customerName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [bills, dateFilter, searchQuery]);

  // Analytics Data
  const { totalRevenue, totalBills, avgBillValue, chartData } = useMemo(() => {
    const revenue = filteredBills.reduce((sum, b) => sum + b.total, 0);
    const count = filteredBills.length;
    const avg = count > 0 ? revenue / count : 0;

    // Group by day for chart
    const dailyData: Record<string, number> = {};
    filteredBills.forEach(b => {
      const dateStr = format(b.createdAt, 'MMM dd');
      dailyData[dateStr] = (dailyData[dateStr] || 0) + b.total;
    });

    // Convert to array and sort chronologically (since we reversed earlier)
    const chart = Object.entries(dailyData)
      .map(([date, amount]) => ({ date, amount }))
      .reverse()
      .slice(-7); // Last 7 days of data

    return { totalRevenue: revenue, totalBills: count, avgBillValue: avg, chartData: chart };
  }, [filteredBills]);

  const selectedBillItems = useLiveQuery(
    () => selectedBill ? db.billItems.where('billId').equals(selectedBill.id!).toArray() : [],
    [selectedBill]
  );

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBill && shopProfile?.upiId) {
      const upiLink = `upi://pay?pa=${shopProfile.upiId}&pn=${encodeURIComponent(shopName)}&am=${selectedBill.total.toFixed(2)}&cu=INR`;
      QRCode.toDataURL(upiLink, { margin: 1, width: 150 })
        .then(setQrCodeUrl)
        .catch(console.error);
    } else {
      setQrCodeUrl(null);
    }
  }, [selectedBill, shopProfile, shopName]);

  const handleReprint = async (bill: Bill) => {

    try {
      const items = await db.billItems.where('billId').equals(bill.id!).toArray();
      if (!printerService.isConnected()) {
        await printerService.connect();
      }
      const receiptData = buildReceipt(bill, items, shopProfile || null, paperSize);
      await printerService.print(receiptData);
    } catch (error: any) {
      alert("Print failed: " + error.message);
    }
  };

  const handleDownloadPDF = async (bill: Bill) => {
    try {
      const items = await db.billItems.where('billId').equals(bill.id!).toArray();
      
      // Calculate height
      let lineCount = 15 + items.length;
      if (bill.customerName) lineCount++;
      if (bill.tableNo) lineCount++;
      if (bill.discount > 0) lineCount++;
      if (bill.taxAmount > 0) lineCount++;
      
      const lineHeight = 3.5;
      let pageHeight = lineCount * lineHeight + 20;
      if (shopProfile?.upiId) {
        pageHeight += 45; // Space for QR code
      }

      const pageWidth = paperSize === '80mm' ? 80 : 58;
      const doc = new jsPDF({
        unit: 'mm',
        format: [pageWidth, pageHeight]
      });
      
      const margin = 4;
      const maxChars = paperSize === '80mm' ? 48 : 32;
      const baseFontSize = 7.5;
      
      let currentY = 10;
      
      const printCenter = (text: string, isBold = false, size = baseFontSize) => {
        doc.setFont("courier", isBold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.text(text, pageWidth / 2, currentY, { align: 'center' });
        currentY += size === baseFontSize ? lineHeight : lineHeight * 1.5;
      };

      const printLeft = (text: string, isBold = false) => {
        doc.setFont("courier", isBold ? "bold" : "normal");
        doc.setFontSize(baseFontSize);
        doc.text(text, margin, currentY);
        currentY += lineHeight;
      };

      const printRight = (text: string, isBold = false) => {
        doc.setFont("courier", isBold ? "bold" : "normal");
        doc.setFontSize(baseFontSize);
        doc.text(text, pageWidth - margin, currentY, { align: 'right' });
        currentY += lineHeight;
      };

      const printLine = () => {
        doc.setFont("courier", "normal");
        doc.setFontSize(baseFontSize);
        doc.text("-".repeat(maxChars), margin, currentY);
        currentY += lineHeight;
      };

      // Header
      printCenter(shopName, true, 11);
      printLeft(`Bill No: ${bill.billNo}`);
      printLeft(`Date: ${format(bill.createdAt, 'dd MMM yyyy, hh:mm a')}`);
      
      if (bill.customerName) printLeft(`Customer: ${bill.customerName}`);
      if (bill.tableNo) printLeft(`Table: ${bill.tableNo}`);
      
      printLine();
      
      // Items Header
      const qtyWidth = 4;
      const amtWidth = 8;
      const nameWidth = maxChars - qtyWidth - amtWidth - 2;
      
      const headerStr = "Item".padEnd(nameWidth, ' ') + " " + 
                        "Qty".padStart(qtyWidth, ' ') + " " + 
                        "Amount".padStart(amtWidth, ' ');
      printLeft(headerStr, true);
      printLine();
      
      // Items
      items.forEach(item => {
        let name = item.productName;
        if (name.length > nameWidth) {
          name = name.substring(0, nameWidth - 2) + "..";
        } else {
          name = name.padEnd(nameWidth, ' ');
        }
        const qty = `${item.qty}`.padStart(qtyWidth, ' ');
        const amt = `${(item.qty * item.unitPrice).toFixed(2)}`.padStart(amtWidth, ' ');
        printLeft(`${name} ${qty} ${amt}`);
      });
      
      printLine();
      
      // Totals
      printRight(`Subtotal: ${bill.subtotal.toFixed(2)}`);
      if (bill.discount > 0) printRight(`Discount: -${bill.discount.toFixed(2)}`);
      if (bill.taxAmount > 0) printRight(`Tax: +${bill.taxAmount.toFixed(2)}`);
      
      printRight(`Total: ${bill.total.toFixed(2)}`, true);
      printLeft(`Paid via: ${bill.paymentMode}`);
      
      currentY += lineHeight;

      if (shopProfile?.upiId) {
        const upiLink = `upi://pay?pa=${shopProfile.upiId}&pn=${encodeURIComponent(shopName)}&am=${bill.total.toFixed(2)}&cu=INR`;
        try {
          const qrDataUrl = await QRCode.toDataURL(upiLink, { margin: 1, width: 120 });
          printCenter("Scan to Pay", true);
          doc.addImage(qrDataUrl, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30);
          currentY += 35;
        } catch (qrErr) {
          console.error("QR Code generation failed", qrErr);
        }
      }

      printCenter("Thank you! Visit again.");

      const fileName = `Bill_${bill.billNo}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        try {
          // Use Cache directory to avoid permission issues on Android
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
          });
          
          await Share.share({
            title: fileName,
            text: `Bill ${bill.billNo}`,
            url: savedFile.uri,
            dialogTitle: 'Save or Share Bill'
          });
        } catch (fsError: any) {
          console.error("Filesystem error:", fsError);
          alert("Failed to save PDF to device: " + fsError.message);
        }
      } else {
        // Web fallback (Mobile browsers, etc.)
        try {
          const pdfBlob = doc.output('blob');
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          
          // Try native Web Share API first (works well on mobile browsers)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: fileName,
              text: `Bill ${bill.billNo}`
            });
          } else {
            // Fallback to standard download
            doc.save(fileName);
          }
        } catch (webError) {
          console.error("Web share error:", webError);
          // Ultimate fallback
          doc.save(fileName);
        }
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    }
  };

  const handleWhatsAppShare = async (bill: Bill) => {
    const phone = window.prompt("Enter customer's WhatsApp number:");
    if (!phone) return;

    try {
      const items = await db.billItems.where('billId').equals(bill.id!).toArray();
      
      let text = `*${shopName}*\n`;
      text += `Bill No: ${bill.billNo}\n`;
      text += `Date: ${format(bill.createdAt, 'dd MMM yyyy, hh:mm a')}\n`;
      if (bill.customerName) text += `Customer: ${bill.customerName}\n`;
      if (bill.tableNo) text += `Table: ${bill.tableNo}\n`;
      text += `------------------------\n`;
      
      items.forEach(item => {
        text += `${item.productName}\n${item.qty} x Rs.${item.unitPrice.toFixed(2)} = Rs.${(item.qty * item.unitPrice).toFixed(2)}\n`;
      });
      
      text += `------------------------\n`;
      text += `Subtotal: Rs.${bill.subtotal.toFixed(2)}\n`;
      if (bill.discount > 0) text += `Discount: -Rs.${bill.discount.toFixed(2)}\n`;
      if (bill.taxAmount > 0) text += `Tax: +Rs.${bill.taxAmount.toFixed(2)}\n`;
      text += `*Total: Rs.${bill.total.toFixed(2)}*\n`;
      text += `Payment Mode: ${bill.paymentMode}\n`;

      if (shopProfile?.upiId) {
        const upiLink = `upi://pay?pa=${shopProfile.upiId}&pn=${encodeURIComponent(shopName)}&am=${bill.total.toFixed(2)}&cu=INR`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
        // const clickableLink = `${window.location.origin}/pay?pa=${shopProfile.upiId}&pn=${encodeURIComponent(shopName)}&am=${bill.total.toFixed(2)}`;
        
        text += `\n*Pay via UPI*\n`;
        // text += `Click the link below to pay directly via any UPI app:\n${clickableLink}\n\n`;
        text += `scan the QR code here:\n${qrUrl}\n`;
      }

      text += `\nThank you for your visit!`;

      const encodedText = encodeURIComponent(text);
      const cleanPhone = phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error("Error sharing to WhatsApp:", error);
      alert("Failed to generate WhatsApp message.");
    }
  };

  const handleEditBill = async (bill: Bill) => {
    try {
      const items = await db.billItems.where('billId').equals(bill.id!).toArray();
      const products = await db.products.toArray();
      loadBill(bill, items, products);
      navigate('/billing');
    } catch (error) {
      console.error("Error loading bill:", error);
      alert("Failed to load bill for editing.");
    }
  };

  return (
    <div className="flex h-full md:h-screen overflow-hidden bg-[#F2F2F7]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden max-w-5xl mx-auto w-full">
        
        {/* Header */}
        <div className="p-4 md:p-8 pb-4 bg-[#F2F2F7] z-10">
          <h1 className="text-3xl font-bold tracking-tight mb-6">Reports</h1>
          
          {/* Segmented Control */}
          <div className="bg-[#E3E3E8] p-1 rounded-xl flex max-w-sm">
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                'flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all',
                activeTab === 'history' ? 'bg-white shadow-sm text-black' : 'text-[#6E6E73]'
              )}
            >
              Order History
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                'flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all',
                activeTab === 'analytics' ? 'bg-white shadow-sm text-black' : 'text-[#6E6E73]'
              )}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Filters (Shared) */}
        <div className="px-4 md:px-8 pb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E6E73]" />
            <input
              type="text"
              placeholder="Search bill no or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-none rounded-xl pl-10 pr-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.05)] focus:ring-2 focus:ring-[#007AFF] outline-none"
            />
          </div>
          <div className="flex bg-white rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-1 overflow-x-auto hide-scrollbar">
            {(['today', 'week', 'month', 'all'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap transition-colors",
                  dateFilter === filter 
                    ? "bg-[#007AFF]/10 text-[#007AFF]" 
                    : "text-[#6E6E73] hover:bg-[#F2F2F7]"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-0">
          {activeTab === 'analytics' ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3 text-[#6E6E73] mb-2">
                    <IndianRupee className="w-5 h-5" />
                    <h3 className="font-semibold">Revenue</h3>
                  </div>
                  <p className="text-3xl font-bold text-[#1C1C1E]">₹{totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3 text-[#6E6E73] mb-2">
                    <Receipt className="w-5 h-5" />
                    <h3 className="font-semibold">Total Bills</h3>
                  </div>
                  <p className="text-3xl font-bold text-[#1C1C1E]">{totalBills}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3 text-[#6E6E73] mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <h3 className="font-semibold">Avg. Bill Value</h3>
                  </div>
                  <p className="text-3xl font-bold text-[#1C1C1E]">₹{avgBillValue.toFixed(2)}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] h-80">
                <h3 className="font-semibold text-[#1C1C1E] mb-6">Sales Trend</h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6E6E73', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6E6E73', fontSize: 12 }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip 
                        cursor={{ fill: '#F2F2F7' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#007AFF' : '#A1C6F5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[#6E6E73]">
                    No data for selected period
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              {filteredBills.length === 0 ? (
                <div className="text-center py-12 text-[#6E6E73]">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No bills found.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#C6C6C8]/50">
                  {filteredBills.map(bill => (
                    <div 
                      key={bill.id} 
                      onClick={() => setSelectedBill(bill)}
                      className="p-4 hover:bg-[#F2F2F7] cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[#1C1C1E]">{bill.billNo}</span>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                            bill.paymentMode === 'Cash' ? "bg-green-100 text-green-700" :
                            bill.paymentMode === 'UPI' ? "bg-purple-100 text-purple-700" :
                            "bg-blue-100 text-blue-700"
                          )}>
                            {bill.paymentMode}
                          </span>
                        </div>
                        <div className="text-sm text-[#6E6E73] flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(bill.createdAt, 'MMM dd, yyyy • hh:mm a')}
                          {bill.customerName && ` • ${bill.customerName}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-[#1C1C1E]">₹{bill.total.toFixed(2)}</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleReprint(bill); }}
                          className="text-[#007AFF] text-sm font-semibold flex items-center gap-1 mt-1 hover:underline ml-auto"
                        >
                          <Printer className="w-4 h-4" /> Reprint
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center justify-between bg-[#F2F2F7] shrink-0">
              <h2 className="text-lg font-bold text-[#1C1C1E]">Bill Details</h2>
              <button 
                onClick={() => setSelectedBill(null)}
                className="p-2 text-[#6E6E73] hover:bg-[#E3E3E8] rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-[#1C1C1E]">{shopName}</h3>
                <p className="text-sm text-[#6E6E73]">Bill No: {selectedBill.billNo}</p>
                <p className="text-sm text-[#6E6E73]">{format(selectedBill.createdAt, 'dd MMM yyyy, hh:mm a')}</p>
              </div>

              {(selectedBill.customerName || selectedBill.tableNo) && (
                <div className="mb-6 p-4 bg-[#F2F2F7] rounded-xl text-sm flex justify-between items-center">
                  {selectedBill.customerName && (
                    <div>
                      <span className="text-[#6E6E73] block text-xs uppercase tracking-wider font-bold mb-1">Customer</span> 
                      <span className="font-semibold text-[#1C1C1E]">{selectedBill.customerName}</span>
                    </div>
                  )}
                  {selectedBill.tableNo && (
                    <div className="text-right">
                      <span className="text-[#6E6E73] block text-xs uppercase tracking-wider font-bold mb-1">Table</span> 
                      <span className="font-semibold text-[#1C1C1E]">{selectedBill.tableNo}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs font-bold text-[#6E6E73] uppercase tracking-wider border-b border-[#C6C6C8]/50 pb-2">
                  <span>Item</span>
                  <span>Amount</span>
                </div>
                {selectedBillItems?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm items-center">
                    <div>
                      <p className="font-semibold text-[#1C1C1E]">{item.productName}</p>
                      <p className="text-[#6E6E73] text-xs">{item.qty} x ₹{item.unitPrice.toFixed(2)}</p>
                    </div>
                    <p className="font-medium text-[#1C1C1E]">₹{(item.qty * item.unitPrice).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm border-t border-[#C6C6C8]/50 pt-4">
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Subtotal</span>
                  <span>₹{selectedBill.subtotal.toFixed(2)}</span>
                </div>
                {selectedBill.discount > 0 && (
                  <div className="flex justify-between text-[#34C759]">
                    <span>Discount</span>
                    <span>-₹{selectedBill.discount.toFixed(2)}</span>
                  </div>
                )}
                {selectedBill.taxAmount > 0 && (
                  <div className="flex justify-between text-[#6E6E73]">
                    <span>Tax</span>
                    <span>+₹{selectedBill.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-[#1C1C1E] pt-2 border-t border-[#C6C6C8]/50 mt-2">
                  <span>Total</span>
                  <span>₹{selectedBill.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <span className={cn(
                  "text-xs px-3 py-1 rounded-full font-bold uppercase",
                  selectedBill.paymentMode === 'Cash' ? "bg-green-100 text-green-700" :
                  selectedBill.paymentMode === 'UPI' ? "bg-purple-100 text-purple-700" :
                  "bg-blue-100 text-blue-700"
                )}>
                  Paid via {selectedBill.paymentMode}
                </span>
                
                {qrCodeUrl && (
                  <div className="mt-6 flex flex-col items-center">
                    <p className="text-sm font-bold text-[#1C1C1E] mb-2">Scan to Pay</p>
                    <img src={qrCodeUrl} alt="UPI QR Code" className="w-32 h-32 border border-[#C6C6C8]/50 rounded-xl p-2 bg-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#C6C6C8]/50 bg-white shrink-0 pb-safe flex flex-col gap-3">
              <div className="flex gap-3">
                <button 
                  onClick={() => handleReprint(selectedBill)}
                  className="flex-1 bg-[#F2F2F7] text-[#1C1C1E] py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Printer className="w-5 h-5" />
                  Reprint
                </button>
                <button 
                  onClick={() => handleDownloadPDF(selectedBill)}
                  className="flex-1 bg-[#007AFF] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Download className="w-5 h-5" />
                  Save PDF
                </button>
              </div>
              <button 
                onClick={() => handleWhatsAppShare(selectedBill)}
                className="w-full bg-[#25D366] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <MessageCircle className="w-5 h-5" />
                Share via WhatsApp
              </button>
              <button 
                onClick={() => handleEditBill(selectedBill)}
                className="w-full bg-[#FF9500] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Edit className="w-5 h-5" />
                Edit Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
