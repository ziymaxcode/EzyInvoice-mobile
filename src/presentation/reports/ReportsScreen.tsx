import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Bill } from '../../data/database';
import { Search, Calendar, Filter, TrendingUp, Receipt, IndianRupee, Printer } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, isAfter, startOfDay, endOfDay } from 'date-fns';
import { printerService } from '../../services/printerService';
import { buildReceipt } from '../../services/receiptBuilder';

export function ReportsScreen() {
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

  const handleReprint = async (bill: Bill) => {
    try {
      const items = await db.billItems.where('billId').equals(bill.id!).toArray();
      if (!printerService.isConnected()) {
        await printerService.connect();
      }
      const receiptData = buildReceipt(bill, items, shopName, paperSize);
      await printerService.print(receiptData);
    } catch (error: any) {
      alert("Print failed: " + error.message);
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
    </div>
  );
}
