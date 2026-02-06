import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToolStateProvider } from './context/ToolStateContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AppLayout } from './layout/AppLayout';
import { AccountLayout } from './layout/AccountLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ScannerPage } from './pages/ScannerPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { SendersPage } from './pages/SendersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { ManagePlanPage } from './pages/ManagePlanPage';
import { BillingOverviewPage } from './pages/BillingOverviewPage';
import { BillingMonthlyPlanPage } from './pages/BillingMonthlyPlanPage';
import { BillingInformationPage } from './pages/BillingInformationPage';
import { BillingHistoryPage } from './pages/BillingHistoryPage';
import { PricingPlansPage } from './pages/PricingPlansPage';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app">
        <div className="animate-pulse text-blaster-muted">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <ToolStateProvider>
                <AppLayout />
              </ToolStateProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="senders" element={<SendersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="settings" element={<Navigate to="/app/account/settings/users" replace />} />
            <Route path="settings/users" element={<UsersPage />} />
            <Route path="settings/manage-plan" element={<ManagePlanPage />} />
            <Route path="billing" element={<BillingOverviewPage />} />
            <Route path="billing/monthly-plan" element={<BillingMonthlyPlanPage />} />
            <Route path="billing/information" element={<BillingInformationPage />} />
            <Route path="billing/history" element={<BillingHistoryPage />} />
            <Route path="pricing" element={<PricingPlansPage />} />
          </Route>
          <Route path="settings/*" element={<Navigate to="/app/settings" replace />} />
          <Route path="profile" element={<Navigate to="/app/account" replace />} />
          <Route path="profile/*" element={<Navigate to="/app/account" replace />} />
          <Route path="billing" element={<Navigate to="/app/account/billing" replace />} />
          <Route path="billing/*" element={<Navigate to="/app/account/billing" replace />} />
          <Route path="pricing" element={<Navigate to="/app/account/pricing" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
