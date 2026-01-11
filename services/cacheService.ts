
/**
 * Orin AI Neural Cache Engine
 * Centralized service for local persistence and session management.
 */

export enum CacheKey {
  USER = 'orin_user',
  HISTORY = 'orin_history_v3', // Incremented version for stability
  ACTIVE_CONV = 'orin_active_conv_id',
  DRAFT_PROMPT = 'orin_draft_prompt',
  LANG = 'orin_lang',
  THEME = 'orin_theme',
  USAGE_COUNT = 'orin_usage_count',
  LAST_RESET = 'orin_last_reset',
  HARDWARE_MODE = 'orin_hw_mode'
}

export class CacheService {
  /**
   * Stores an item in local storage with automatic serialization.
   */
  set<T>(key: CacheKey, value: T): void {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.error(`Neural Cache: Write failure for ${key}`, e);
    }
  }

  /**
   * Retrieves an item from local storage with safe deserialization.
   */
  get<T>(key: CacheKey, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data === null) return fallback;
      
      // If it looks like JSON, try to parse it
      if (data.startsWith('{') || data.startsWith('[')) {
        return JSON.parse(data) as T;
      }
      
      // Otherwise return as is (for strings like theme/lang)
      return data as unknown as T;
    } catch (e) {
      console.warn(`Neural Cache: Corruption detected for ${key}. Reverting to fallback.`);
      return fallback;
    }
  }

  /**
   * Clears a specific key or all Orin-related data.
   */
  remove(key: CacheKey): void {
    localStorage.removeItem(key);
  }

  clearAll(): void {
    Object.values(CacheKey).forEach(key => localStorage.removeItem(key));
  }

  /**
   * Quick check for data existence.
   */
  has(key: CacheKey): boolean {
    return localStorage.getItem(key) !== null;
  }
}

export const cacheService = new CacheService();
