import { supabase } from './utils/supabase.js';

// Supabase Direct API - No Railway Backend Needed

export const supabaseAPI = {
  // Authentication
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
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
    const { data, error } = await supabase
      .from('activity_logs')
      .insert(activityData)
      .select();
    return { data, error };
  },

  // Subscriptions
  async getSubscription(userId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    return { data, error };
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
