import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToolStateProvider } from './context/ToolStateContext';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AppLayout } from './layout/AppLayout';
import { AccountLayout } from './layout/AccountLayout';
import DashboardPage from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import ScannerPage from './pages/ScannerPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ManualSendPage } from './pages/ManualSendPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ReferralPage } from './pages/ReferralPage';
import { StoresPage } from './pages/StoresPage';
import { ProfilePage } from './pages/ProfilePage';
import { OverviewPage } from './pages/OverviewPage';
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
import { AdminResourcesPage } from './pages/bl-admin/AdminResourcesPage';
import { AdminLeadEnginePage } from './pages/bl-admin/AdminLeadEnginePage';
import { AdminScrapeDashboardPage } from './pages/bl-admin/AdminScrapeDashboardPage';
import { AdminAddLeadsPage } from './pages/bl-admin/AdminAddLeadsPage';
import { AdminReferralsPage } from './pages/bl-admin/AdminReferralsPage';
import { AdminCampaignPage } from './pages/bl-admin/AdminCampaignPage';
import { GlobalPreloaderGate } from './components/GlobalPreloaderGate';
import { PlanAccessProvider } from './context/PlanAccessContext.jsx';
import { NavNotificationsProvider } from './context/NavNotificationsContext.jsx';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Preserve Paystack callback query params when redirecting billing → usage. */
function BillingRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/app/account/settings/usage${search}`} replace />;
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
            <Route path="campaign" element={<AdminCampaignPage />} />
            <Route path="referrals" element={<AdminReferralsPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="resources" element={<AdminResourcesPage />} />
            <Route path="lead-engine" element={<AdminLeadEnginePage />} />
            <Route path="lead-engine/scrape" element={<AdminScrapeDashboardPage />} />
            <Route path="lead-engine/add" element={<AdminAddLeadsPage />} />
          </Route>
        </Route>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
            <ToolStateProvider>
              <PlanAccessProvider>
                <NavNotificationsProvider>
                  <AppLayout />
                </NavNotificationsProvider>
              </PlanAccessProvider>
            </ToolStateProvider>
          </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/send/:runId" element={<ManualSendPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="referral" element={<ReferralPage />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="settings" element={<Navigate to="/app/account/settings/usage" replace />} />
            <Route path="settings/usage" element={<BillingOverviewPage />} />
            <Route path="settings/current-plan" element={<Navigate to="/app/account/settings/usage" replace />} />
            <Route path="settings/manage-plan" element={<ManagePlanPage />} />
            <Route path="billing" element={<BillingRedirect />} />
            <Route path="billing/monthly-plan" element={<BillingMonthlyPlanPage />} />
            <Route path="billing/information" element={<BillingInformationPage />} />
            <Route path="billing/history" element={<BillingHistoryPage />} />
            <Route path="billing/extra-credit" element={<BillingExtraCreditPage />} />
            <Route path="pricing" element={<PricingPlansPage />} />
          </Route>
          <Route path="settings/*" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="profile" element={<Navigate to="/app/account" replace />} />
          <Route path="profile/*" element={<Navigate to="/app/account" replace />} />
          <Route path="billing" element={<BillingRedirect />} />
          <Route path="billing/*" element={<BillingRedirect />} />
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
        <ConfirmDialogProvider>
          <GlobalPreloaderGate>
            <AppRoutes />
          </GlobalPreloaderGate>
        </ConfirmDialogProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
