/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Layout } from './presentation/widgets/Layout';
import { BillingScreen } from './presentation/billing/BillingScreen';
import { InventoryScreen } from './presentation/inventory/InventoryScreen';
import { ReportsScreen } from './presentation/reports/ReportsScreen';
import { SettingsScreen } from './presentation/settings/SettingsScreen';
import { LoginScreen } from './presentation/auth/LoginScreen';
import { useAuthStore } from './presentation/auth/store/useAuthStore';
import { useEffect } from 'react';

function PayRedirect() {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const pa = searchParams.get('pa');
    const pn = searchParams.get('pn');
    const am = searchParams.get('am');
    const cu = searchParams.get('cu') || 'INR';

    if (pa && pn && am) {
      const upiUrl = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=${cu}`;
      window.location.href = upiUrl;
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F7] p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full">
        <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Redirecting to UPI...</h2>
        <p className="text-[#6E6E73] mb-6">Please complete the payment in your UPI app.</p>
        
        <div className="text-sm text-[#6E6E73] bg-[#F2F2F7] p-4 rounded-xl">
          <p className="font-semibold mb-1">If it doesn't open automatically:</p>
          <p className="break-all">UPI ID: {searchParams.get('pa')}</p>
          <p>Amount: ₹{searchParams.get('am')}</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/billing" replace />} />
        <Route path="billing" element={<BillingScreen />} />
        <Route path="inventory" element={<InventoryScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/pay" element={<PayRedirect />} />
        <Route path="*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
