import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  
  // Allow access if user was manually upgraded by admin (check user role or subscription status)
  const isAdminUpgraded = user && (
    user.role === 'admin' || 
    user.role === 'premium' ||
    (subscription && subscription.status === 'active' && subscription.adminUpgraded)
  );

  if (!hasActiveSubscription && !isAdminUpgraded) {
    return <Navigate to="/pricing" replace />;
  }

  return children;
}
