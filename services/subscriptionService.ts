
import { supabase } from './supabaseClient';
import { DbPlan, DbSubscription, UserAccount } from '../types';

const DEFAULT_PLANS = [
  {
    name: 'Basic',
    price_lkr: 0,
    daily_limit_text: 200,
    daily_limit_images: 5,
    features: ['Standard Reasoning', 'Basic Chat', 'Community Support']
  },
  {
    name: 'Pro',
    price_lkr: 1500,
    daily_limit_text: 1000,
    daily_limit_images: 50,
    features: ['Advanced Reasoning', 'Faster Response', 'Priority Support', 'Vision Access']
  },
  {
    name: 'Elite',
    price_lkr: 3500,
    daily_limit_text: 10000,
    daily_limit_images: 200,
    features: ['Unlimited Access', 'Veo Video Generation', 'Dedicated Support', 'Early Access Features']
  }
];

export class SubscriptionService {
  
  /**
   * Sync user data to Supabase 'users' table.
   * This ensures we have a record of every logged-in user's email.
   */
  async syncUser(user: UserAccount): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar || null,
          last_login: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error("Failed to sync user to Supabase:", error.message);
      } else {
        console.log("User synced to Supabase DB:", user.email);
      }
    } catch (e) {
      console.error("Exception syncing user:", e);
    }
  }

  /**
   * Fetch all available pricing plans from Supabase.
   * If no plans exist, it attempts to seed the database with defaults.
   */
  async getPlans(): Promise<DbPlan[]> {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('price_lkr', { ascending: true });

    if (error) {
      console.error("Error fetching plans:", error);
      return [];
    }

    // Auto-seed if empty
    if (data.length === 0) {
      console.log("No plans found in DB. Attempting to seed defaults...");
      return await this.seedPlans();
    }

    return data as DbPlan[];
  }

  /**
   * Seed the database with default plans.
   */
  private async seedPlans(): Promise<DbPlan[]> {
    const { data, error } = await supabase
      .from('plans')
      .insert(DEFAULT_PLANS)
      .select();

    if (error) {
      console.error("Seeding failed:", error);
      // Return local defaults with fake IDs if DB insert fails (fallback mode)
      return DEFAULT_PLANS.map((p, i) => ({ ...p, id: `local-${i}` })) as DbPlan[];
    }
    
    return data as DbPlan[];
  }

  /**
   * Get the active subscription for a specific Firebase User ID.
   */
  async getUserSubscription(userId: string): Promise<DbSubscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      // It's normal to have no rows if user hasn't subscribed
      return null;
    }
    return data as DbSubscription;
  }

  /**
   * Subscribe a user to a plan. 
   * NOTE: In a real production app, this would happen AFTER a successful payment gateway callback.
   * For this phase, we are directly inserting the record to simulate a successful purchase.
   */
  async subscribeUser(userId: string, plan: DbPlan): Promise<boolean> {
    // 1. Check if user already has a sub, if so, we might want to update it or cancel old one
    // For simplicity, we just insert a new active one.
    
    const { error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        start_date: new Date().toISOString()
      });

    if (error) {
      console.error("Subscription failed:", error);
      return false;
    }

    // Record the "Payment" in history
    await supabase.from('payments').insert({
        user_id: userId,
        amount_lkr: plan.price_lkr,
        plan_name: plan.name,
        payment_method: 'simulation',
        status: 'success'
    });

    return true;
  }
}

export const subscriptionService = new SubscriptionService();
