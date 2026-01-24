
import { firebaseService } from './firebaseService';
import { collection, doc, setDoc, getDocs, getDoc, addDoc, query, where, updateDoc } from "firebase/firestore";
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
   * Sync user data to Firestore 'users' collection.
   */
  async syncUser(user: UserAccount): Promise<void> {
    if (!user || !user.id) return;
    const db = firebaseService.getDb();
    if (!db) return;
    
    console.log(`[Firestore] Syncing user: ${user.email}`);
    
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        email: user.email,
        name: user.name,
        avatar_url: user.avatar || "",
        last_login: new Date().toISOString()
      }, { merge: true }); // Merge true preserves existing data like historyBlob
    } catch (e) {
      console.error("[Firestore] Sync Exception:", e);
    }
  }

  /**
   * Fetch all available pricing plans from Firestore.
   * Auto-seeds if empty.
   */
  async getPlans(): Promise<DbPlan[]> {
    const db = firebaseService.getDb();
    if (!db) return DEFAULT_PLANS.map((p, i) => ({ ...p, id: `local-${i}` })) as DbPlan[];

    try {
      const plansRef = collection(db, 'plans');
      const snapshot = await getDocs(plansRef);
      
      if (snapshot.empty) {
        console.log("[Firestore] Seeding default plans...");
        await this.seedPlans();
        // Return defaults immediately for speed while async seed happens
        return DEFAULT_PLANS.map((p, i) => ({ ...p, id: `seeded-${i}` })) as DbPlan[]; 
      }

      const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DbPlan));
      // Sort by price
      return plans.sort((a, b) => a.price_lkr - b.price_lkr);
    } catch (e) {
      console.error("[Firestore] Error fetching plans:", e);
      return DEFAULT_PLANS.map((p, i) => ({ ...p, id: `local-${i}` })) as DbPlan[];
    }
  }

  /**
   * Seed the database with default plans.
   */
  private async seedPlans(): Promise<void> {
    const db = firebaseService.getDb();
    if (!db) return;
    
    const plansRef = collection(db, 'plans');
    for (const plan of DEFAULT_PLANS) {
      await addDoc(plansRef, plan);
    }
  }

  /**
   * Get the active subscription for a specific User ID.
   */
  async getUserSubscription(userId: string): Promise<DbSubscription | null> {
    const db = firebaseService.getDb();
    if (!db) return null;

    try {
      const q = query(
        collection(db, 'subscriptions'),
        where('user_id', '==', userId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const subDoc = snapshot.docs[0];
      const subData = subDoc.data();
      
      // Fetch plan details to join
      let planData = undefined;
      if (subData.plan_id) {
         const planSnap = await getDoc(doc(db, 'plans', subData.plan_id));
         if (planSnap.exists()) {
            planData = { id: planSnap.id, ...planSnap.data() } as DbPlan;
         }
      }

      return {
        id: subDoc.id,
        ...subData,
        plan: planData
      } as DbSubscription;

    } catch (e) {
      console.error("[Firestore] Get Subscription Error:", e);
      return null;
    }
  }

  /**
   * Subscribe a user to a plan. 
   */
  async subscribeUser(userId: string, plan: DbPlan): Promise<boolean> {
    const db = firebaseService.getDb();
    if (!db) return false;

    try {
      // 1. Deactivate any existing active subscriptions
      const q = query(
        collection(db, 'subscriptions'),
        where('user_id', '==', userId),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => {
         await updateDoc(doc(db, 'subscriptions', d.id), {
            status: 'cancelled',
            end_date: new Date().toISOString()
         });
      });

      // 2. Create new subscription
      await addDoc(collection(db, 'subscriptions'), {
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: null
      });

      // 3. Log payment
      await addDoc(collection(db, 'payments'), {
        user_id: userId,
        amount_lkr: plan.price_lkr,
        plan_name: plan.name,
        payment_method: 'simulation',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error("[Firestore] Subscription failed:", error);
      return false;
    }
  }
}

export const subscriptionService = new SubscriptionService();
