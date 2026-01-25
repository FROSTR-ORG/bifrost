import {
  DEFAULT_ECDH_CACHE_SIZE,
  DEFAULT_CACHE_TTL,
  CACHE_CLEANUP_INTERVAL
} from '@/const.js'

/**
 * Configuration options for a Cache instance.
 */
export interface CacheConfig {
  /** Maximum number of entries (0 = unlimited, default: 1000) */
  max_size?: number
  /** Time-to-live in milliseconds (0 = no expiration, default: 0) */
  ttl?: number
  /** Interval for cleanup of expired entries in ms (default: 60000) */
  cleanup_interval?: number
}

/**
 * Metadata stored with each cache entry.
 */
interface CacheEntry<V> {
  value       : V
  created_at  : number
  access_order: number
}

/**
 * A generic cache with optional TTL expiration and LRU eviction.
 *
 * Features:
 * - Optional TTL-based expiration (entries expire after ttl ms)
 * - Optional LRU eviction when max_size is reached
 * - Periodic cleanup of expired entries (if TTL enabled)
 * - Same get/set interface as Map for compatibility
 *
 * @example
 * ```typescript
 * const cache = new Cache<string, string>({
 *   max_size: 100,
 *   ttl: 60000  // 1 minute
 * })
 * cache.set('key', 'value')
 * const value = cache.get('key')  // 'value' or undefined if expired
 * cache.destroy()  // cleanup when done
 * ```
 */
export class Cache<K, V> {
  private readonly _entries : Map<K, CacheEntry<V>>
  private readonly _max_size: number
  private readonly _ttl     : number

  private _cleanup_timer: ReturnType<typeof setInterval> | null = null
  private _access_counter: number = 0

  /**
   * Creates a new Cache instance.
   *
   * @param config - Optional configuration options.
   */
  constructor(config: CacheConfig = {}) {
    this._entries  = new Map()
    this._max_size = config.max_size ?? DEFAULT_ECDH_CACHE_SIZE
    this._ttl      = config.ttl ?? DEFAULT_CACHE_TTL

    // Start cleanup timer if TTL is enabled
    if (this._ttl > 0) {
      const interval = config.cleanup_interval ?? CACHE_CLEANUP_INTERVAL
      this._cleanup_timer = setInterval(() => this._cleanup(), interval)
      // Don't block process exit
      if (this._cleanup_timer.unref) {
        this._cleanup_timer.unref()
      }
    }
  }

  /**
   * Gets a value from the cache.
   *
   * Returns undefined if the key doesn't exist or if the entry has expired.
   * Updates the access order on hit (for LRU).
   *
   * @param key - The key to look up.
   * @returns The value or undefined.
   */
  get(key: K): V | undefined {
    const entry = this._entries.get(key)
    if (entry === undefined) {
      return undefined
    }

    // Check TTL expiration
    if (this._is_expired(entry)) {
      this._entries.delete(key)
      return undefined
    }

    // Update access order for LRU
    entry.access_order = ++this._access_counter
    return entry.value
  }

  /**
   * Sets a value in the cache.
   *
   * If the cache is at max_size, the least recently used entry is evicted.
   *
   * @param key - The key to set.
   * @param value - The value to store.
   */
  set(key: K, value: V): void {
    // If key already exists, update it
    const existing = this._entries.get(key)
    if (existing) {
      existing.value = value
      existing.access_order = ++this._access_counter
      return
    }

    // Evict LRU entry if at capacity (and max_size > 0)
    if (this._max_size > 0 && this._entries.size >= this._max_size) {
      this._evict_lru()
    }

    // Add new entry
    this._entries.set(key, {
      value,
      created_at: Date.now(),
      access_order: ++this._access_counter
    })
  }

  /**
   * Checks if a key exists in the cache and is not expired.
   *
   * @param key - The key to check.
   * @returns True if the key exists and is not expired.
   */
  has(key: K): boolean {
    const entry = this._entries.get(key)
    if (entry === undefined) {
      return false
    }
    if (this._is_expired(entry)) {
      this._entries.delete(key)
      return false
    }
    return true
  }

  /**
   * Deletes a key from the cache.
   *
   * @param key - The key to delete.
   * @returns True if the key existed and was deleted.
   */
  delete(key: K): boolean {
    return this._entries.delete(key)
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this._entries.clear()
  }

  /**
   * Gets the current number of entries in the cache.
   *
   * Note: This may include expired entries that haven't been cleaned up yet.
   */
  get size(): number {
    return this._entries.size
  }

  /**
   * Destroys the cache, stopping cleanup timers and clearing entries.
   *
   * Call this when the cache is no longer needed to prevent memory leaks.
   */
  destroy(): void {
    if (this._cleanup_timer !== null) {
      clearInterval(this._cleanup_timer)
      this._cleanup_timer = null
    }
    this._entries.clear()
  }

  /**
   * Checks if an entry has expired based on TTL.
   */
  private _is_expired(entry: CacheEntry<V>): boolean {
    if (this._ttl === 0) {
      return false
    }
    return Date.now() - entry.created_at > this._ttl
  }

  /**
   * Evicts the least recently used entry from the cache.
   */
  private _evict_lru(): void {
    let oldest_key: K | null = null
    let oldest_order = Infinity

    for (const [key, entry] of this._entries) {
      if (entry.access_order < oldest_order) {
        oldest_order = entry.access_order
        oldest_key = key
      }
    }

    if (oldest_key !== null) {
      this._entries.delete(oldest_key)
    }
  }

  /**
   * Removes all expired entries from the cache.
   * Called periodically by the cleanup timer.
   */
  private _cleanup(): void {
    if (this._ttl === 0) return

    const now = Date.now()
    for (const [key, entry] of this._entries) {
      if (now - entry.created_at > this._ttl) {
        this._entries.delete(key)
      }
    }
  }
}
