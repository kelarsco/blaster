import { supabase } from './utils/supabase.js';
import { sendVerificationEmail } from './utils/resend.js';

// Supabase Direct API - No Railway Backend Needed

export const supabaseAPI = {
  // Authentication
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: 'https://wiblaster.com/app/dashboard'
      }
    });
    
    // Don't send verification email - let Resend handle it
    return { data, error };
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Scans
  async createScan(scanData) {
    const { data, error } = await supabase
      .from('scans')
      .insert(scanData)
      .select()
      .single();
    return { data, error };
  },

  async getScans(userId) {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateScan(id, updates) {
    const { data, error } = await supabase
      .from('scans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Scan Results
  async getScanResults(scanId) {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('scan_id', scanId);
    return { data, error };
  },

  async addScanResults(results) {
    const { data, error } = await supabase
      .from('scan_results')
      .insert(results)
      .select();
    return { data, error };
  },

  // Campaigns
  async getCampaigns(userId) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createCampaign(campaignData) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();
    return { data, error };
  },

  async updateCampaign(id, updates) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Senders
  async getSenders(userId) {
    const { data, error } = await supabase
      .from('senders')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  },

  async createSender(senderData) {
    const { data, error } = await supabase
      .from('senders')
      .insert(senderData)
      .select()
      .single();
    return { data, error };
  },

  // Activity Logs
  async getActivity(userId) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data, error };
  },

  async logActivity(activityData) {
    try {
      // Add unique ID and timestamp to prevent exact duplicates
      const activityWithUniqueData = {
        ...activityData,
        id: `${activityData.user_id}_${activityData.type}_${Date.now()}`,
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('activity_logs')
        .insert(activityWithUniqueData)
        .select();
      
      // Handle duplicate entries gracefully
      if (error && error.code === '23505') {
        console.warn('Activity log already exists:', activityData);
        return { data: null, error: null };
      }
      
      return { data, error };
    } catch (error) {
      console.error('Error logging activity:', error);
      return { data: null, error };
    }
  },

  // Subscriptions
  async getSubscription(userId) {
    try {
      // Add retry logic for lock conflicts
      let retries = 3;
      let lastError = null;
      
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          
          if (error && error.code === 'PGRST116') {
            console.log('No subscription found for user:', userId);
            return { data: null, error: null };
          }
          
          if (error) {
            throw error;
          }
          
          return { data, error: null };
        } catch (error) {
          lastError = error;
          
          // Check if it's a lock conflict
          if (error.message && error.message.includes('Lock')) {
            console.warn(`Lock conflict on attempt ${attempt + 1}/${retries}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          
          throw error;
        }
      }
      
      throw lastError || new Error('Failed to fetch subscription after retries');
    } catch (error) {
      console.error('Subscription fetch error:', error);
      return { data: null, error };
    }
  },

  async createSubscription(subscriptionData) {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();
    return { data, error };
  },

  // Plans
  async getPlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('amount', { ascending: true });
    return { data, error };
  }
};

export default supabaseAPI;
