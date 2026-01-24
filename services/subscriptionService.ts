
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
    if (!user || !user.id) return;
    
    console.log(`[Supabase] Syncing user: ${user.email} (${user.id})`);
    
    try {
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar || "",
        last_login: new Date().toISOString()
      };

      // Upsert: Create if not exists, update if exists
      const { data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (error) {
        console.error("[Supabase] Sync Error:", error.message, error.details);
        // Fallback: If table doesn't exist, we can't do much from frontend logic alone
      } else {
        console.log("[Supabase] User synced successfully.", data);
      }
    } catch (e) {
      console.error("[Supabase] Sync Exception:", e);
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
      console.error("[Supabase] Error fetching plans:", error.message);
      return DEFAULT_PLANS.map((p, i) => ({ ...p, id: `local-${i}` })) as DbPlan[];
    }

    // Auto-seed if empty
    if (!data || data.length === 0) {
      console.log("[Supabase] No plans found. Seeding defaults...");
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
      console.error("[Supabase] Seeding failed:", error.message);
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
      return null;
    }
    return data as DbSubscription;
  }

  /**
   * Subscribe a user to a plan. 
   */
  async subscribeUser(userId: string, plan: DbPlan): Promise<boolean> {
    // 1. Deactivate any existing active subscriptions
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', end_date: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'active');

    // 2. Create new subscription
    const { error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        start_date: new Date().toISOString()
      });

    if (error) {
      console.error("[Supabase] Subscription failed:", error.message);
      return false;
    }

    // 3. Log payment
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
