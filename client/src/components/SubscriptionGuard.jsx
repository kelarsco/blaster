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

  // Check for any paid access - either through subscription OR admin upgrade
  const hasPaidAccess = (
    // Has active paid subscription
    (subscription && subscription.planId && subscription.planId !== 'free') ||
    // OR was manually upgraded by admin (check user role/plan)
    (user && (
      user.role === 'admin' || 
      user.role === 'premium' ||
      user.planId && user.planId !== 'free' ||
      user.subscriptionPlan && user.subscriptionPlan !== 'free'
    ))
  );

  if (!hasPaidAccess) {
    return <Navigate to="/pricing" replace />;
  }

  return children;
}
