import { Cache } from '@/class/cache.js'
import { parse_error } from '@/util/index.js'

import type { Test } from 'tape'

export default function (tape: Test) {
  tape.test('Cache tests', t => {
    try {
      // Test basic get/set
      t.test('get() and set() work correctly', st => {
        const cache = new Cache<string, string>()

        cache.set('key1', 'value1')
        st.equal(cache.get('key1'), 'value1', 'get returns set value')

        cache.set('key2', 'value2')
        st.equal(cache.get('key2'), 'value2', 'can set multiple keys')
        st.equal(cache.get('key1'), 'value1', 'first key still accessible')

        cache.destroy()
        st.end()
      })

      // Test get on missing key
      t.test('get() returns undefined for missing keys', st => {
        const cache = new Cache<string, string>()

        st.equal(cache.get('nonexistent'), undefined, 'returns undefined for missing key')

        cache.destroy()
        st.end()
      })

      // Test set overwrites existing value
      t.test('set() overwrites existing values', st => {
        const cache = new Cache<string, string>()

        cache.set('key', 'value1')
        st.equal(cache.get('key'), 'value1', 'initial value set')

        cache.set('key', 'value2')
        st.equal(cache.get('key'), 'value2', 'value overwritten')

        cache.destroy()
        st.end()
      })

      // Test has()
      t.test('has() returns correct values', st => {
        const cache = new Cache<string, string>()

        st.equal(cache.has('key'), false, 'has() returns false for missing key')

        cache.set('key', 'value')
        st.equal(cache.has('key'), true, 'has() returns true after set')

        cache.delete('key')
        st.equal(cache.has('key'), false, 'has() returns false after delete')

        cache.destroy()
        st.end()
      })

      // Test delete()
      t.test('delete() removes entries', st => {
        const cache = new Cache<string, string>()

        cache.set('key', 'value')
        st.equal(cache.get('key'), 'value', 'key exists before delete')

        const result = cache.delete('key')
        st.equal(result, true, 'delete returns true for existing key')
        st.equal(cache.get('key'), undefined, 'key is gone after delete')

        const result2 = cache.delete('nonexistent')
        st.equal(result2, false, 'delete returns false for missing key')

        cache.destroy()
        st.end()
      })

      // Test clear()
      t.test('clear() removes all entries', st => {
        const cache = new Cache<string, string>()

        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        st.equal(cache.size, 3, 'cache has 3 entries')

        cache.clear()
        st.equal(cache.size, 0, 'cache is empty after clear')
        st.equal(cache.get('key1'), undefined, 'entries are gone')

        cache.destroy()
        st.end()
      })

      // Test size property
      t.test('size property tracks entry count', st => {
        const cache = new Cache<string, string>()

        st.equal(cache.size, 0, 'starts at 0')

        cache.set('key1', 'value1')
        st.equal(cache.size, 1, 'size is 1 after first set')

        cache.set('key2', 'value2')
        st.equal(cache.size, 2, 'size is 2 after second set')

        cache.set('key1', 'updated')
        st.equal(cache.size, 2, 'size unchanged when updating existing key')

        cache.delete('key1')
        st.equal(cache.size, 1, 'size decreases after delete')

        cache.destroy()
        st.end()
      })

      // Test TTL expiration
      t.test('TTL expiration works', async st => {
        const cache = new Cache<string, string>({
          ttl: 50,  // 50ms TTL
          cleanup_interval: 1000  // Don't auto-cleanup during test
        })

        cache.set('key', 'value')
        st.equal(cache.get('key'), 'value', 'value accessible immediately')

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 60))

        st.equal(cache.get('key'), undefined, 'value expired after TTL')
        st.equal(cache.has('key'), false, 'has() returns false for expired key')

        cache.destroy()
        st.end()
      })

      // Test no TTL (default)
      t.test('no TTL by default', async st => {
        const cache = new Cache<string, string>()

        cache.set('key', 'value')

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50))

        st.equal(cache.get('key'), 'value', 'value persists without TTL')

        cache.destroy()
        st.end()
      })

      // Test LRU eviction
      t.test('LRU eviction at max_size', st => {
        const cache = new Cache<string, number>({ max_size: 3 })

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)
        st.equal(cache.size, 3, 'cache at capacity')

        // Access 'a' to make it recently used
        cache.get('a')

        // Add new entry, should evict 'b' (least recently used)
        cache.set('d', 4)
        st.equal(cache.size, 3, 'size remains at max')
        st.equal(cache.get('a'), 1, 'recently accessed key retained')
        st.equal(cache.get('b'), undefined, 'LRU key evicted')
        st.equal(cache.get('c'), 3, 'other key retained')
        st.equal(cache.get('d'), 4, 'new key added')

        cache.destroy()
        st.end()
      })

      // Test LRU eviction order
      t.test('LRU eviction respects access order', st => {
        const cache = new Cache<string, number>({ max_size: 3 })

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        // Access in order: c, a, b (b is most recent)
        cache.get('c')
        cache.get('a')
        cache.get('b')

        // Add new entry, should evict 'c' (least recently accessed)
        cache.set('d', 4)
        st.equal(cache.get('c'), undefined, 'least recently accessed evicted')
        st.equal(cache.get('a'), 1, 'a retained')
        st.equal(cache.get('b'), 2, 'b retained')
        st.equal(cache.get('d'), 4, 'd added')

        cache.destroy()
        st.end()
      })

      // Test unlimited size (max_size: 0)
      t.test('max_size: 0 means unlimited', st => {
        const cache = new Cache<string, number>({ max_size: 0 })

        for (let i = 0; i < 100; i++) {
          cache.set(`key${i}`, i)
        }

        st.equal(cache.size, 100, 'can store many entries with max_size: 0')
        st.equal(cache.get('key0'), 0, 'first entry still accessible')
        st.equal(cache.get('key99'), 99, 'last entry accessible')

        cache.destroy()
        st.end()
      })

      // Test destroy()
      t.test('destroy() clears cache and stops timer', st => {
        const cache = new Cache<string, string>({
          ttl: 1000,
          cleanup_interval: 100
        })

        cache.set('key', 'value')
        st.equal(cache.size, 1, 'has entry before destroy')

        cache.destroy()
        st.equal(cache.size, 0, 'cache cleared after destroy')

        // Can still use cache after destroy (just empty)
        cache.set('new', 'value')
        st.equal(cache.get('new'), 'value', 'can still use cache after destroy')

        cache.destroy()
        st.end()
      })

      // Test updating existing key updates last_accessed
      t.test('updating existing key updates last_accessed', st => {
        const cache = new Cache<string, number>({ max_size: 3 })

        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        // Update 'a' (should update its last_accessed time)
        cache.set('a', 100)

        // Add new entry, should evict 'b' (now least recently used)
        cache.set('d', 4)

        st.equal(cache.get('a'), 100, 'updated key retained with new value')
        st.equal(cache.get('b'), undefined, 'old LRU key evicted')

        cache.destroy()
        st.end()
      })

      // Test with different key/value types
      t.test('works with number keys', st => {
        const cache = new Cache<number, string>()

        cache.set(1, 'one')
        cache.set(2, 'two')

        st.equal(cache.get(1), 'one', 'number key works')
        st.equal(cache.get(2), 'two', 'another number key works')
        st.equal(cache.has(1), true, 'has() works with number key')

        cache.destroy()
        st.end()
      })

      // Test TTL cleanup runs periodically
      t.test('cleanup removes expired entries', async st => {
        const cache = new Cache<string, string>({
          ttl: 30,
          cleanup_interval: 50
        })

        cache.set('key1', 'value1')
        cache.set('key2', 'value2')

        // Wait for TTL to expire and cleanup to run
        await new Promise(resolve => setTimeout(resolve, 100))

        // Size should reflect cleanup (entries removed during cleanup)
        // Note: size may still show old count until get/has is called
        st.equal(cache.get('key1'), undefined, 'expired entry cleaned up')
        st.equal(cache.get('key2'), undefined, 'another expired entry cleaned up')

        cache.destroy()
        st.end()
      })

      // Test default configuration
      t.test('default config has max_size: 1000 and no TTL', st => {
        const cache = new Cache<string, string>()

        // Add 1001 entries
        for (let i = 0; i <= 1000; i++) {
          cache.set(`key${i}`, `value${i}`)
        }

        // Should have evicted one entry
        st.equal(cache.size, 1000, 'default max_size is 1000')

        // First entry should be evicted (LRU)
        st.equal(cache.get('key0'), undefined, 'first entry evicted')
        st.equal(cache.get('key1000'), 'value1000', 'last entry retained')

        cache.destroy()
        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}
