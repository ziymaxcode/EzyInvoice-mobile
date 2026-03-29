/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './presentation/widgets/Layout';
import { BillingScreen } from './presentation/billing/BillingScreen';
import { InventoryScreen } from './presentation/inventory/InventoryScreen';
import { ReportsScreen } from './presentation/reports/ReportsScreen';
import { SettingsScreen } from './presentation/settings/SettingsScreen';
import { LoginScreen } from './presentation/auth/LoginScreen';
import { useAuthStore } from './presentation/auth/store/useAuthStore';

export default function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/billing" replace />} />
          <Route path="billing" element={<BillingScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
