import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
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
import { DomainEmailSendingPage } from './pages/DomainEmailSendingPage';
import { DomainInboxPage } from './pages/DomainInboxPage';
import { ManagePlanPage } from './pages/ManagePlanPage';
import { BillingOverviewPage } from './pages/BillingOverviewPage';
import { BillingMonthlyPlanPage } from './pages/BillingMonthlyPlanPage';
import { BillingInformationPage } from './pages/BillingInformationPage';
import { BillingHistoryPage } from './pages/BillingHistoryPage';
import { BillingExtraCreditPage } from './pages/BillingExtraCreditPage';
import { PricingPlansPage } from './pages/PricingPlansPage';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { PricingPage } from './pages/PricingPage';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { AdminLoginPage } from './pages/bl-admin/AdminLoginPage';
import { AdminLayout } from './layout/AdminLayout';
import { AdminOverviewPage } from './pages/bl-admin/AdminOverviewPage';
import { AdminUsersPage } from './pages/bl-admin/AdminUsersPage';
import { AdminSubscriptionsPage } from './pages/bl-admin/AdminSubscriptionsPage';
import { AdminMessagesPage } from './pages/bl-admin/AdminMessagesPage';
import { GlobalPreloaderGate } from './components/GlobalPreloaderGate';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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

function AdminProtectedLayout() {
  const { isAdmin, adminChecked } = useAdmin();
  if (!adminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg-app">
        <div className="animate-pulse text-blaster-muted">Loading…</div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/bl-admin/login" replace />;
  return <AdminLayout />;
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
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/bl-admin" element={<AdminProvider><Outlet /></AdminProvider>}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="login" element={<AdminLoginPage />} />
          <Route element={<AdminProtectedLayout />}>
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
          </Route>
        </Route>
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
          <Route path="domain-email-sending" element={<DomainEmailSendingPage />} />
          <Route path="domain-inbox" element={<DomainInboxPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="settings" element={<Navigate to="/app/account/settings/usage" replace />} />
            <Route path="settings/usage" element={<BillingOverviewPage />} />
            <Route path="settings/current-plan" element={<Navigate to="/app/account/settings/usage" replace />} />
            <Route path="settings/manage-plan" element={<ManagePlanPage />} />
            <Route path="billing" element={<Navigate to="/app/account/settings/usage" replace />} />
            <Route path="billing/monthly-plan" element={<BillingMonthlyPlanPage />} />
            <Route path="billing/information" element={<BillingInformationPage />} />
            <Route path="billing/history" element={<BillingHistoryPage />} />
            <Route path="billing/extra-credit" element={<BillingExtraCreditPage />} />
            <Route path="pricing" element={<PricingPlansPage />} />
          </Route>
          <Route path="settings/*" element={<Navigate to="/app/settings" replace />} />
          <Route path="profile" element={<Navigate to="/app/account" replace />} />
          <Route path="profile/*" element={<Navigate to="/app/account" replace />} />
          <Route path="billing" element={<Navigate to="/app/account/settings/usage" replace />} />
          <Route path="billing/*" element={<Navigate to="/app/account/settings/usage" replace />} />
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
      <ScrollToTop />
      <AuthProvider>
        <GlobalPreloaderGate>
          <AppRoutes />
        </GlobalPreloaderGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
