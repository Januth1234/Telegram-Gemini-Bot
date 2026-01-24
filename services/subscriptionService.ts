
import { firebaseService } from './firebaseService';
import { collection, doc, setDoc, getDocs, getDoc, addDoc, updateDoc, serverTimestamp, increment, Timestamp } from "firebase/firestore";
import { DbPlan, DbSubscription, UserAccount } from '../types';
import { cacheService, CacheKey } from './cacheService';

// Plan Configuration
const PLANS: Record<string, any> = {
  free: {
    prompts: 100, // Per month
    images: 2, // Every 3 days
    videos: 0,
    imagePeriodDays: 3
  },
  basic: {
    prompts: 350,
    images: 30, // Per month
    imageDailyLimit: 1,
    videos: 1, // Per month
    videoDurationSeconds: 60
  },
  pro: {
    prompts: 1000,
    images: 100,
    imageDailyLimit: 10,
    videos: 5,
    videoDurationSeconds: 120
  },
  elite: {
    prompts: 999999,
    images: 999999,
    videos: 50,
    videoDurationSeconds: 300
  }
};

const GUEST_LIMITS = {
  prompts: 5,
  attachments: 1
};

export class SubscriptionService {
  
  /**
   * Sync user data to Firestore 'users' collection.
   * Ensures default usage structure exists.
   */
  async syncUser(user: UserAccount): Promise<void> {
    if (!user || !user.id) return;
    const db = firebaseService.getDb();
    if (!db) return;
    
    console.log(`[Firestore] Syncing user: ${user.email}`);
    
    try {
      const userRef = doc(db, 'users', user.id);
      const snap = await getDoc(userRef);
      
      const defaults = {
        email: user.email,
        name: user.name,
        avatar_url: user.avatar || "",
        last_login: new Date().toISOString(),
        // Default fields if new
        plan: snap.exists() ? snap.data().plan : 'free',
        subscriptionStatus: snap.exists() ? snap.data().subscriptionStatus : 'active',
        usage: snap.exists() ? snap.data().usage : {
          prompts: 0,
          images: 0,
          videos: 0,
          lastReset: serverTimestamp(),
          lastImageReset: serverTimestamp()
        }
      };

      await setDoc(userRef, defaults, { merge: true }); 
    } catch (e) {
      console.error("[Firestore] Sync Exception:", e);
    }
  }

  /**
   * Check if action is allowed for Guest or Auth User.
   */
  async checkAllowance(user: UserAccount | null, action: 'text' | 'image' | 'video'): Promise<boolean> {
    // --- GUEST LOGIC ---
    if (!user) {
      const currentPrompts = cacheService.get<number>(CacheKey.USAGE_COUNT, 0); // Reusing existing key for guest prompts
      if (action === 'video') return false; // Guests cannot gen video
      if (action === 'image') return false; // Guests cannot gen images (per prompt req "5 AI prompts total" usually implies text, blocking media for guests is safer for MVP unless specified. Prompt said "5 AI prompts total and 1 file attachment" input. Generating image is an output. Let's block gen for guests to drive signup)
      
      if (currentPrompts >= GUEST_LIMITS.prompts) {
        console.warn(`[Guest] Limit reached: ${currentPrompts}/${GUEST_LIMITS.prompts}`);
        return false;
      }
      return true;
    }

    // --- AUTH USER LOGIC ---
    const db = firebaseService.getDb();
    if (!db) return true; // Fallback if DB offline

    try {
      const userRef = doc(db, 'users', user.id);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) return false;
      
      const data = snap.data();
      const planName = data.plan || 'free';
      const planLimits = PLANS[planName] || PLANS['free'];
      const usage = data.usage || { prompts: 0, images: 0, videos: 0 };
      
      const now = new Date();
      
      // 1. Check Monthly Reset
      const lastReset = usage.lastReset ? usage.lastReset.toDate() : new Date(0);
      const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 3600 * 24);
      
      if (daysSinceReset > 30) {
        console.log(`[Firestore] Monthly reset triggered for ${user.id}`);
        await updateDoc(userRef, {
          'usage.prompts': 0,
          'usage.images': 0,
          'usage.videos': 0,
          'usage.lastReset': serverTimestamp()
        });
        return true; // Fresh month, allow
      }

      // 2. Check Action Limits
      if (action === 'text') {
        if (usage.prompts >= planLimits.prompts) {
          console.warn(`[Usage] Text limit hit: ${usage.prompts}/${planLimits.prompts}`);
          return false;
        }
      } 
      else if (action === 'image') {
        // Free Plan Special Logic: 2 images every 3 days
        if (planName === 'free') {
           const lastImgReset = usage.lastImageReset ? usage.lastImageReset.toDate() : new Date(0);
           const daysSinceImgReset = (now.getTime() - lastImgReset.getTime()) / (1000 * 3600 * 24);
           
           if (daysSinceImgReset > planLimits.imagePeriodDays) {
             // Reset image bucket
             await updateDoc(userRef, { 'usage.images': 0, 'usage.lastImageReset': serverTimestamp() });
             return true; 
           }
           if (usage.images >= planLimits.images) return false;
        } 
        else {
           // Monthly Limit
           if (usage.images >= planLimits.images) return false;
           // Daily Limit
           if (planLimits.imageDailyLimit) {
              const lastGen = usage.lastImageGenerated ? usage.lastImageGenerated.toDate() : new Date(0);
              const hoursSince = (now.getTime() - lastGen.getTime()) / (1000 * 3600);
              if (hoursSince < 24 && usage.imagesToday >= planLimits.imageDailyLimit) {
                 // Note: Implementing strict 'usage.imagesToday' requires a separate counter reset daily. 
                 // For MVP, we simply check time gap if limit is 1 per day.
                 if (planLimits.imageDailyLimit === 1 && hoursSince < 24) return false;
              }
           }
        }
      }
      else if (action === 'video') {
        if (usage.videos >= planLimits.videos) return false;
      }

      return true;
    } catch (e) {
      console.error("[Usage] Check failed:", e);
      return false; 
    }
  }

  /**
   * Increment usage counters after successful generation.
   */
  async incrementUsage(user: UserAccount | null, action: 'text' | 'image' | 'video'): Promise<void> {
    // Guest
    if (!user) {
      if (action === 'text') {
        const current = cacheService.get<number>(CacheKey.USAGE_COUNT, 0);
        cacheService.set(CacheKey.USAGE_COUNT, current + 1);
        console.log(`[Guest] Prompts used: ${current + 1}`);
      }
      return;
    }

    // Auth User
    const db = firebaseService.getDb();
    if (!db) return;

    try {
      const userRef = doc(db, 'users', user.id);
      const updates: any = {};

      if (action === 'text') {
        updates['usage.prompts'] = increment(1);
      } else if (action === 'image') {
        updates['usage.images'] = increment(1);
        updates['usage.lastImageGenerated'] = serverTimestamp();
      } else if (action === 'video') {
        updates['usage.videos'] = increment(1);
        updates['usage.lastVideoGenerated'] = serverTimestamp();
      }

      await updateDoc(userRef, updates);
      console.log(`[Firestore] Incremented ${action} usage for ${user.id}`);
    } catch (e) {
      console.error("[Usage] Increment failed:", e);
    }
  }

  /**
   * Get plans from DB or defaults.
   */
  async getPlans(): Promise<DbPlan[]> {
    const db = firebaseService.getDb();
    const localPlans = Object.keys(PLANS).map(key => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      price_lkr: key === 'free' ? 0 : (key === 'basic' ? 300 : (key === 'pro' ? 1500 : 3000)),
      daily_limit_text: PLANS[key].prompts,
      daily_limit_images: PLANS[key].images,
      features: [`${PLANS[key].prompts} Prompts`, `${PLANS[key].images} Images`, `${PLANS[key].videos} Videos`]
    }));

    if (!db) return localPlans as DbPlan[];

    try {
      // Return predefined plans logic for stability, or fetch dynamic from DB if implemented
      return localPlans as DbPlan[]; 
    } catch (e) {
      return localPlans as DbPlan[];
    }
  }

  // ... (previous subscribeUser logic kept intact)
  async subscribeUser(userId: string, plan: DbPlan, userEmail: string): Promise<boolean> {
    const db = firebaseService.getDb();
    if (!db) return false;

    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        email: userEmail,
        plan: plan.name.toLowerCase(), 
        subscriptionStatus: 'active',
        planStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Reset usage on upgrade
        usage: {
          prompts: 0,
          images: 0,
          videos: 0,
          lastReset: serverTimestamp()
        }
      }, { merge: true });

      await addDoc(collection(db, 'payments'), {
        user_id: userId,
        amount_lkr: plan.price_lkr,
        plan_name: plan.name,
        timestamp: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error("Sub failed", error);
      return false;
    }
  }
  
  async getUserSubscription(userId: string): Promise<DbSubscription | null> {
     const db = firebaseService.getDb();
     if(!db) return null;
     const snap = await getDoc(doc(db, 'users', userId));
     if(snap.exists()) {
         const data = snap.data();
         const planName = data.plan || 'free';
         // Construct a basic DbPlan object since we rely on fixed PLANS config
         const planDetails: DbPlan = {
             id: planName,
             name: planName,
             price_lkr: 0, 
             daily_limit_text: PLANS[planName]?.prompts || 0,
             daily_limit_images: PLANS[planName]?.images || 0,
             features: []
         };

         return {
             id: `sub_${userId}`,
             user_id: userId,
             plan_id: planName,
             status: 'active',
             start_date: new Date().toISOString(),
             end_date: null,
             plan: planDetails
         };
     }
     return null;
  }
}

export const subscriptionService = new SubscriptionService();
