import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase.js';
import { supabaseAPI } from '../supabase-api.js';
import { sendVerificationEmail } from '../utils/resend.js';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within SupabaseAuthProvider');
  }
  return ctx;
}

export function SupabaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Fetch subscription data
          const { data: subscriptionData } = await supabaseAPI.getSubscription(session.user.id);
          setSubscription(subscriptionData);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (session?.user) {
          setUser(session.user);
          
          // Fetch subscription data
          const { data: subscriptionData } = await supabaseAPI.getSubscription(session.user.id);
          setSubscription(subscriptionData);
        } else {
          setUser(null);
          setSubscription(null);
        }
        
        setLoading(false);
      }
    );

    return () => authSubscription.unsubscribe();
  }, []);

  // Sign up
  const signUp = useCallback(async (email, password, name) => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAPI.signUp(email, password, name);
      
      if (error) throw error;
      
      // Log activity
      if (data.user) {
        await supabaseAPI.logActivity({
          user_id: data.user.id,
          type: 'user_registered',
          payload: { email }
        });
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign in
  const signIn = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAPI.signIn(email, password);
      
      if (error) throw error;
      
      // Log activity
      if (data.user) {
        await supabaseAPI.logActivity({
          user_id: data.user.id,
          type: 'user_login',
          payload: { email }
        });
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabaseAPI.signOut();
      
      if (error) throw error;
      
      setUser(null);
      setSubscription(null);
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Google sign in
  const signInWithGoogle = useCallback(async () => {
    try {
      // Use production URL or fallback to current origin
      const redirectUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectUrl}/app/dashboard`
        }
      });
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    try {
      const { data, error } = await supabase.auth.updateUser(updates);
      
      if (error) throw error;
      
      setUser(data.user);
      return { success: true, data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Authenticated fetch function (for compatibility)
  const authFetch = useCallback(async (url, options = {}) => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`
      };

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Auth fetch error:', error);
      throw error;
    }
  }, []);

  const value = {
    user,
    subscription,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    authFetch,
    isAuthenticated: !!user,
    isAdmin: user?.email?.endsWith('@wiblaster.com') || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
