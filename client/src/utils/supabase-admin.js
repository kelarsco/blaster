import { supabase } from './supabase.js';

// Supabase Admin API - Direct database access for admin functions

export const supabaseAdminAPI = {
  // Get sidebar counts
  async getSidebarCounts() {
    try {
      const [usersCount, subscriptionsCount, messagesCount] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('id', { count: 'exact', head: true })
      ]);

      return {
        users: usersCount.count || 0,
        subscriptions: subscriptionsCount.count || 0,
        messages: messagesCount.count || 0
      };
    } catch (error) {
      console.error('Error fetching admin counts:', error);
      return { users: 0, subscriptions: 0, messages: 0 };
    }
  },

  // Get all users with pagination
  async getUsers(page = 1, limit = 50) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, created_at, updated_at, auth_provider')
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get total count
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      return {
        users: data || [],
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [], total: 0, page, limit };
    }
  },

  // Get user subscriptions
  async getUserSubscriptions(userId) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }
  },

  // Get all subscriptions
  async getSubscriptions(page = 1, limit = 50) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          users!inner(email, name)
        `)
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get total count
      const { count } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true });

      return {
        subscriptions: data || [],
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return { subscriptions: [], total: 0, page, limit };
    }
  },

  // Get activity logs
  async getActivityLogs(page = 1, limit = 50) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          users!inner(email, name)
        `)
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get total count
      const { count } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true });

      return {
        messages: data || [],
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return { messages: [], total: 0, page, limit };
    }
  },

  // Update user admin status
  async updateUserAdminStatus(userId, isAdmin) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ admin_upgraded: isAdmin })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user admin status:', error);
      throw error;
    }
  }
};

export default supabaseAdminAPI;
