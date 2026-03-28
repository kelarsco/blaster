import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/SupabaseAuthContext';
import { PLANS } from '../data/plans';

export function SubscriptionGuard({ children }) {
  const { user, subscription, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blaster-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blaster-accent"></div>
      </div>
    );
  }

  // Allow access if user has an active subscription (not free trial)
  const hasActiveSubscription = subscription && subscription.status === 'active' && subscription.planId !== 'free';
  
  // Allow access if user was manually upgraded by admin or has any paid plan
  const isAdminUpgraded = user && (
    user.role === 'admin' || 
    user.role === 'premium' ||
    (subscription && subscription.planId && subscription.planId !== 'free') ||
    (subscription && subscription.status === 'active' && subscription.adminUpgraded) ||
    (user && user.planId && user.planId !== 'free')
  );

  if (!hasActiveSubscription && !isAdminUpgraded) {
    return <Navigate to="/pricing" replace />;
  }

  return children;
}
