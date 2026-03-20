
/**
 * Orin AI Neural Cache Engine
 * Centralized service for local persistence and session management.
 */

export enum CacheKey {
  USER = 'orin_user',
  HISTORY = 'orin_history_v3',
  ACTIVE_CONV = 'orin_active_conv_id',
  LANG = 'orin_lang',
  THEME = 'orin_theme',          // system dark/light
  USER_THEME = 'orin_user_theme' // Orin workspace visual theme
}

export class CacheService {
  /**
   * Stores an item in local storage with automatic serialization.
   */
  set<T>(key: CacheKey, value: T): void {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // Quota or privacy mode; fail silently in production
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
      if (data.startsWith('{') || data.startsWith('[')) return JSON.parse(data) as T;
      return data as unknown as T;
    } catch {
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
    for (const key of Object.values(CacheKey)) localStorage.removeItem(key);
  }

  /**
   * Quick check for data existence.
   */
  has(key: CacheKey): boolean {
    return localStorage.getItem(key) !== null;
  }
}

export const cacheService = new CacheService();
