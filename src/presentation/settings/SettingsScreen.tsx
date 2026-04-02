import React, { useState, useEffect } from 'react';
import { printerService } from '../../services/printerService';
import { EscPosEncoder } from '../../services/escPosEncoder';
import { db, User } from '../../data/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer, Bluetooth, CheckCircle2, AlertCircle, Store, Save, Download, Trash2, Users, UserPlus, LogOut, Upload, Database } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { useAuthStore } from '../auth/store/useAuthStore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shop Profile State
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopGst, setShopGst] = useState('');
  const [shopUpiId, setShopUpiId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // User Management State
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Cashier');
  const [newUserPin, setNewUserPin] = useState('');
  const users = useLiveQuery(() => db.users.toArray()) || [];

  // Load existing shop profile
  const shop = useLiveQuery(() => db.shops.toCollection().first());

  // Load settings
  const paperSizeSetting = useLiveQuery(() => db.settings.get('printerPaperSize'));
  const paperSize = paperSizeSetting?.value || '58mm';

  const handlePaperSizeChange = async (size: string) => {
    await db.settings.put({ key: 'printerPaperSize', value: size });
  };

  useEffect(() => {
    if (shop) {
      setShopName(shop.name);
      setShopAddress(shop.address);
      setShopPhone(shop.phone);
      setShopGst(shop.gstNo);
      setShopUpiId(shop.upiId || '');
    }
  }, [shop]);

  const saveShopProfile = async () => {
    setIsSaving(true);
    try {
      if (shop?.id) {
        await db.shops.update(shop.id, {
          name: shopName,
          address: shopAddress,
          phone: shopPhone,
          gstNo: shopGst,
          upiId: shopUpiId
        });
      } else {
        await db.shops.add({
          name: shopName,
          address: shopAddress,
          phone: shopPhone,
          gstNo: shopGst,
          upiId: shopUpiId,
          logoPath: '',
          createdAt: new Date()
        });
      }
      alert("Shop profile saved!");
    } catch (e) {
      alert("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const connectPrinter = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const name = await printerService.connect();
      setPrinterName(name);
    } catch (e: any) {
      setError(e.message || "Failed to connect to printer");
    } finally {
      setIsConnecting(false);
    }
  };

  const testPrint = async () => {
    try {
      const encoder = new EscPosEncoder();
      const data = encoder.initialize()
        .alignCenter()
        .bold(true)
        .size(2, 2)
        .line("TEST PRINT")
        .size(1, 1)
        .bold(false)
        .newline()
        .line("If you can read this,")
        .line("your printer is working!")
        .newline()
        .newline()
        .newline()
        .cut()
        .encode();
      
      await printerService.print(data);
      alert("Test print sent successfully!");
    } catch (e: any) {
      alert('Print failed: ' + e.message);
    }
  };

  const handleExportData = async () => {
    try {
      // Simple CSV export of bills
      const bills = await db.bills.toArray();
      if (bills.length === 0) {
        alert("No data to export.");
        return;
      }

      const headers = "Bill No,Date,Customer,Total,Payment Mode\n";
      const rows = bills.map(b => `${b.billNo},${b.createdAt.toISOString()},${b.customerName || 'Walk-in'},${b.total},${b.paymentMode}`).join("\n");
      const csv = headers + rows;
      const fileName = `pos_export_${new Date().getTime()}.csv`;

      if (Capacitor.isNativePlatform()) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: csv,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          
          await Share.share({
            title: fileName,
            text: `POS Export Data`,
            url: savedFile.uri,
            dialogTitle: 'Save or Share Export'
          });
        } catch (fsError: any) {
          console.error("Filesystem error:", fsError);
          alert("Failed to save export to device: " + fsError.message);
        }
      } else {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert("Export failed.");
    }
  };

  const handleBackupData = async () => {
    try {
      const backup = {
        shops: await db.shops.toArray(),
        categories: await db.categories.toArray(),
        products: await db.products.toArray(),
        bills: await db.bills.toArray(),
        billItems: await db.billItems.toArray(),
        users: await db.users.toArray(),
        printerConfigs: await db.printerConfigs.toArray(),
        settings: await db.settings.toArray(),
      };

      const json = JSON.stringify(backup);
      const fileName = `pos_backup_${new Date().getTime()}.json`;

      if (Capacitor.isNativePlatform()) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: json,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          
          await Share.share({
            title: fileName,
            text: `POS Backup Data`,
            url: savedFile.uri,
            dialogTitle: 'Save or Share Backup'
          });
        } catch (fsError: any) {
          console.error("Filesystem error:", fsError);
          alert("Failed to save backup to device: " + fsError.message);
        }
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      alert("Backup failed.");
    }
  };

  const handleRestoreData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: Restoring a backup will overwrite ALL current data. Are you sure you want to proceed?")) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Basic validation
      if (!backup.shops || !backup.categories || !backup.products || !backup.bills) {
        throw new Error("Invalid backup file format.");
      }

      // Convert date strings back to Date objects
      if (backup.shops) backup.shops.forEach((s: any) => s.createdAt = new Date(s.createdAt));
      if (backup.products) backup.products.forEach((p: any) => p.createdAt = new Date(p.createdAt));
      if (backup.bills) backup.bills.forEach((b: any) => b.createdAt = new Date(b.createdAt));
      if (backup.users) backup.users.forEach((u: any) => u.createdAt = new Date(u.createdAt));

      await db.transaction('rw', [db.shops, db.categories, db.products, db.bills, db.billItems, db.users, db.printerConfigs, db.settings], async () => {
        await db.shops.clear();
        await db.categories.clear();
        await db.products.clear();
        await db.bills.clear();
        await db.billItems.clear();
        await db.users.clear();
        await db.printerConfigs.clear();
        await db.settings.clear();

        if (backup.shops.length) await db.shops.bulkAdd(backup.shops);
        if (backup.categories.length) await db.categories.bulkAdd(backup.categories);
        if (backup.products.length) await db.products.bulkAdd(backup.products);
        if (backup.bills.length) await db.bills.bulkAdd(backup.bills);
        if (backup.billItems.length) await db.billItems.bulkAdd(backup.billItems);
        if (backup.users.length) await db.users.bulkAdd(backup.users);
        if (backup.printerConfigs.length) await db.printerConfigs.bulkAdd(backup.printerConfigs);
        if (backup.settings.length) await db.settings.bulkAdd(backup.settings);
      });

      alert("Data restored successfully! The app will now reload.");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert("Restore failed: " + e.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleWipeData = async () => {
    const pin = prompt("Enter Admin PIN to wipe data:");
    if (pin === user?.pinHash) {
      if (confirm("WARNING: This will delete ALL data permanently. Are you sure?")) {
        await db.delete();
        await db.open(); // Recreate schema
        logout();
        alert("Database wiped successfully. Please reload the app.");
        window.location.reload();
      }
    } else if (pin !== null) {
      alert("Incorrect PIN.");
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || newUserPin.length !== 4) {
      alert("Please enter a valid name and 4-digit PIN.");
      return;
    }
    await db.users.add({
      name: newUserName.trim(),
      role: newUserRole,
      pinHash: newUserPin,
      createdAt: new Date()
    });
    setNewUserName('');
    setNewUserPin('');
    alert("User added successfully.");
  };

  const handleDeleteUser = async (id: number) => {
    if (id === user?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (confirm("Are you sure you want to delete this user?")) {
      await db.users.delete(id);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-[#6E6E73]">Configure your shop and hardware.</p>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 bg-[#FF3B30]/10 text-[#FF3B30] px-4 py-2 rounded-xl font-semibold hover:bg-[#FF3B30]/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* Shop Profile Section */}
      <section className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center gap-3">
          <div className="bg-[#007AFF]/10 p-2 rounded-xl text-[#007AFF]">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold">Shop Profile</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#6E6E73] mb-1">Shop Name</label>
            <input 
              type="text" 
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
              placeholder="e.g. Sharma General Store"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#6E6E73] mb-1">Address</label>
            <input 
              type="text" 
              value={shopAddress}
              onChange={e => setShopAddress(e.target.value)}
              className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
              placeholder="e.g. 123 Main St, City"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#6E6E73] mb-1">Phone</label>
              <input 
                type="tel" 
                value={shopPhone}
                onChange={e => setShopPhone(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#6E6E73] mb-1">GST Number (Optional)</label>
              <input 
                type="text" 
                value={shopGst}
                onChange={e => setShopGst(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[#6E6E73] mb-1">UPI ID / Phone Number for Payments (Optional)</label>
              <input 
                type="text" 
                value={shopUpiId}
                onChange={e => setShopUpiId(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="e.g. 9876543210@upi or shop@ybl"
              />
            </div>
          </div>
          
          <button 
            onClick={saveShopProfile}
            disabled={isSaving}
            className="w-full bg-[#007AFF] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mt-4 active:scale-95 transition-transform"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </section>

      {/* Printer Configuration Section */}
      <section className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center gap-3">
          <div className="bg-[#007AFF]/10 p-2 rounded-xl text-[#007AFF]">
            <Printer className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold">Printer Setup</h2>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#1C1C1E]">Bluetooth Printer</h3>
              <p className="text-sm text-[#6E6E73]">Connect to a thermal printer</p>
            </div>
            {printerName ? (
              <div className="flex items-center gap-2 text-[#34C759] bg-[#34C759]/10 px-3 py-1.5 rounded-full text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Connected
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#FF9500] bg-[#FF9500]/10 px-3 py-1.5 rounded-full text-sm font-semibold">
                <AlertCircle className="w-4 h-4" />
                Not Connected
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-[#F2F2F7] p-4 rounded-xl">
            <div>
              <h4 className="font-semibold text-[#1C1C1E] text-sm">Paper Size</h4>
              <p className="text-xs text-[#6E6E73]">Select your printer's paper width</p>
            </div>
            <div className="flex bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => handlePaperSizeChange('58mm')}
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold rounded-md transition-colors",
                  paperSize === '58mm' ? "bg-[#007AFF] text-white" : "text-[#6E6E73] hover:bg-gray-50"
                )}
              >
                58mm
              </button>
              <button
                onClick={() => handlePaperSizeChange('80mm')}
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold rounded-md transition-colors",
                  paperSize === '80mm' ? "bg-[#007AFF] text-white" : "text-[#6E6E73] hover:bg-gray-50"
                )}
              >
                80mm
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#FF3B30]/10 text-[#FF3B30] p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={connectPrinter}
              disabled={isConnecting}
              className={cn(
                "flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95",
                printerName 
                  ? "bg-[#F2F2F7] text-[#1C1C1E]" 
                  : "bg-[#007AFF] text-white shadow-md",
                isConnecting && "opacity-50 cursor-not-allowed"
              )}
            >
              <Bluetooth className="w-5 h-5" />
              {isConnecting ? "Scanning..." : printerName ? "Pair Another Printer" : "Scan & Pair Printer"}
            </button>
            
            {printerName && (
              <button
                onClick={testPrint}
                className="flex-1 bg-[#F2F2F7] text-[#1C1C1E] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Printer className="w-5 h-5" />
                Test Print
              </button>
            )}
          </div>
          
          {printerName && (
            <p className="text-xs text-center text-[#6E6E73]">
              Currently paired with: <span className="font-semibold text-[#1C1C1E]">{printerName}</span>
            </p>
          )}
        </div>
      </section>

      {/* Data Management Section */}
      <section className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center gap-3">
          <div className="bg-[#007AFF]/10 p-2 rounded-xl text-[#007AFF]">
            <Download className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold">Data Management</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={handleBackupData}
              className="w-full bg-[#34C759]/10 text-[#34C759] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Database className="w-5 h-5" />
              Backup Data (JSON)
            </button>
            
            <label className="w-full bg-[#FF9500]/10 text-[#FF9500] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer">
              <Upload className="w-5 h-5" />
              Restore Data
              <input 
                type="file" 
                accept=".json" 
                onChange={handleRestoreData} 
                className="hidden" 
              />
            </label>
          </div>

          <button 
            onClick={handleExportData}
            className="w-full bg-[#F2F2F7] text-[#1C1C1E] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            Export Sales Data (CSV)
          </button>
          
          <button 
            onClick={handleWipeData}
            className="w-full bg-[#FF3B30]/10 text-[#FF3B30] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Trash2 className="w-5 h-5" />
            Wipe All Data (Reset App)
          </button>
        </div>
      </section>

      {/* User Management Section (Admin Only) */}
      {user?.role === 'Admin' && (
        <section className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-4 border-b border-[#C6C6C8]/50 flex items-center gap-3">
            <div className="bg-[#007AFF]/10 p-2 rounded-xl text-[#007AFF]">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold">User Management</h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Add New User */}
            <div className="bg-[#F2F2F7] p-4 rounded-xl space-y-4">
              <h3 className="font-semibold text-[#1C1C1E] flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add New User
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E6E73] mb-1">Name</label>
                  <input 
                    type="text" 
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF] outline-none"
                    placeholder="e.g. Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6E6E73] mb-1">Role</label>
                  <select 
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value)}
                    className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF] outline-none"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6E6E73] mb-1">4-Digit PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={newUserPin}
                    onChange={e => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF] outline-none font-mono tracking-widest"
                    placeholder="••••"
                  />
                </div>
              </div>
              <button 
                onClick={handleAddUser}
                className="w-full bg-[#007AFF] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#007AFF]/90 transition-colors"
              >
                Add User
              </button>
            </div>

            {/* User List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-[#1C1C1E] mb-3">Existing Users</h3>
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-white border border-[#E3E3E8] p-3 rounded-xl">
                  <div>
                    <p className="font-semibold text-[#1C1C1E]">{u.name}</p>
                    <p className="text-xs text-[#6E6E73]">{u.role}</p>
                  </div>
                  {u.id !== user?.id && (
                    <button 
                      onClick={() => handleDeleteUser(u.id!)}
                      className="text-[#FF3B30] p-2 hover:bg-[#FF3B30]/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
