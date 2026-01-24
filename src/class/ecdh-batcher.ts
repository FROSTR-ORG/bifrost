import { BifrostNode } from '@/class/client.js'
import { parse_error } from '@/util/helpers.js'

import { parse_ecdh_message } from '@/lib/parse.js'
import { get_send_pubkeys }   from '@/lib/peer.js'

import { Assert, copy_obj } from '@/util/index.js'

/** Maximum number of ECDH public keys per batch to avoid relay message size limits */
const MAX_ECDH_BATCH_SIZE = 100

import {
  combine_batched_ecdh_pkgs
} from '@/lib/ecdh.js'

import {
  get_member_indexes,
  select_random_peers
} from '@/lib/util.js'

import type { RpcMessageData } from '@vbyte/nostr-sdk'
import type { ECDHPackage }    from '@/types/index.js'

/**
 * A queued ECDH request.
 */
interface ECDHRequest {
  ecdh_pk : string
  resolve : (secret: string) => void
  reject  : (error: string)  => void
}

/**
 * ECDHBatcher batches ECDH requests for efficient processing.
 *
 * Instead of sending individual ECDH requests to peers immediately,
 * the batcher collects requests and processes them in batches at a
 * configurable interval. This reduces network overhead and improves
 * performance when multiple ECDH operations are needed in quick succession.
 *
 * How it works:
 * 1. Requests are added via `push()` which returns a Promise
 * 2. A timer schedules batch processing after `ecdh_interval` milliseconds
 * 3. When the timer fires, `process()` sends all queued requests as a batch
 * 4. Each request's Promise is resolved or rejected based on the batch result
 *
 * @example
 * ```typescript
 * // Queue multiple ECDH operations - they'll be batched together
 * const secret1 = node.req.ecdh('pubkey1')
 * const secret2 = node.req.ecdh('pubkey2')
 * const [result1, result2] = await Promise.all([secret1, secret2])
 * ```
 */
export class ECDHBatcher {

  /** Batch processing interval in milliseconds. */
  private readonly _interval : number
  /** Reference to the parent BifrostNode. */
  private readonly _node : BifrostNode

  /** Queue of pending ECDH requests. */
  private _queue : ECDHRequest[]
  /** Timer handle for scheduled batch processing. */
  private _timer : NodeJS.Timeout | null

  /**
   * Creates a new ECDHBatcher instance.
   *
   * @param node - The BifrostNode this batcher belongs to.
   */
  constructor (node : BifrostNode) {
    this._node  = node
    this._interval = node.config.ecdh_interval
    this._queue = []
    this._timer = null
  }

  /**
   * Gets the parent BifrostNode.
   * @returns The BifrostNode this batcher belongs to.
   */
  get node () {
    return this._node
  }

  /**
   * Queues an ECDH request for batch processing.
   *
   * The request is added to the queue and a timer is scheduled to process
   * the batch. The returned Promise resolves when the batch is processed
   * and this specific request's shared secret is available.
   *
   * @param ecdh_pk - The public key to perform ECDH with.
   * @returns A Promise that resolves with the shared secret.
   * @throws Rejects if the ECDH request fails.
   */
  async push (ecdh_pk : string) : Promise<string> {
    // Check cache first.
    const encrypted = this.node.cache.ecdh.get(ecdh_pk)
    if (encrypted !== undefined) {
      return this.node.signer.unwrap(encrypted, ecdh_pk)
    }
    // Queue the request.
    return new Promise((resolve, reject) => {
      this._queue.push({ ecdh_pk, resolve, reject })
      this.schedule()
    })
  }

  /**
   * Processes all queued ECDH requests as a batch.
   *
   * This method:
   * 1. Captures the current queue and clears it
   * 2. Filters out already-cached keys
   * 3. Sends all requests to peers in a single ECDH session
   * 4. Resolves or rejects each individual request's Promise
   *
   * Called automatically by the scheduled timer. Can also be called
   * manually to force immediate processing.
   */
  async process () {
    // Get the current batch from the queue.
    const batch = [ ...this._queue ]
    // Clear the timer and queue.
    this._queue = []
    this._timer = null
    // If there are no requests, return.
    if (batch.length === 0) return

    // Filter to get unique, uncached ecdh_pks.
    const seen = new Set<string>()
    const uncached : ECDHRequest[] = []
    const cached   : ECDHRequest[] = []

    for (const req of batch) {
      // Check cache.
      const encrypted = this.node.cache.ecdh.get(req.ecdh_pk)
      if (encrypted !== undefined) {
        cached.push(req)
      } else if (!seen.has(req.ecdh_pk)) {
        seen.add(req.ecdh_pk)
        uncached.push(req)
      }
    }

    // Resolve cached requests immediately.
    for (const req of cached) {
      try {
        const encrypted = this.node.cache.ecdh.get(req.ecdh_pk)!
        const secret = this.node.signer.unwrap(encrypted, req.ecdh_pk)
        req.resolve(secret)
      } catch (err) {
        req.reject(parse_error(err))
      }
    }

    // If all were cached, we're done.
    if (uncached.length === 0) return

    // Reject if batch size exceeds limit to avoid relay message size limits.
    if (uncached.length > MAX_ECDH_BATCH_SIZE) {
      const reason = `ECDH batch size ${uncached.length} exceeds maximum ${MAX_ECDH_BATCH_SIZE}`
      for (const req of uncached) {
        req.reject(reason)
      }
      return
    }

    // Emit info event.
    this.node.emit('info', 'batch ECDH pubkeys: ' + String(uncached.map(req => req.ecdh_pk.slice(0, 8) + '...')))

    // Get unique ecdh_pks to request.
    const ecdh_pks = uncached.map(req => req.ecdh_pk)

    // Get peers with send policy active.
    const send_pks = get_send_pubkeys(this.node.peers)
    // Get the threshold for the group.
    const thold = this.node.group.threshold
    // Randomly select peers.
    const selected = select_random_peers(send_pks, thold)
    // Get the indexes of the members.
    const members = get_member_indexes(this.node.group, [ this.node.pubkey, ...selected ])
    // Generate ECDH shares for all requested keys.
    const self_pkg = this.node.signer.gen_batched_ecdh_shares(members, ecdh_pks)

    let msgs : (RpcMessageData & { data: ECDHPackage })[] | null = null

    try {
      // Send the batched request to the peers.
      msgs = await this.create_request(selected, self_pkg)
      // Emit the response.
      this.node.emit('/ecdh/sender/res', copy_obj(msgs))
    } catch (err) {
      // Reject all requests.
      const reason = parse_error(err)
      this.node.emit('/ecdh/sender/rej', [ reason, copy_obj(self_pkg) ])
      batch.filter(r => uncached.includes(r)).forEach(req => req.reject(reason))
      return
    }

    try {
      Assert.ok(msgs !== null, 'no responses from peers')
      // Collect all packages.
      const pkgs = [ self_pkg, ...msgs.map(e => e.data) ]
      // Combine all shares for all keys.
      const secrets = combine_batched_ecdh_pkgs(pkgs)
      // Resolve each request and cache the result.
      for (const req of uncached) {
        const secret = secrets.get(req.ecdh_pk)
        if (secret) {
          // Cache the encrypted secret.
          const content = this.node.signer.wrap(secret, req.ecdh_pk)
          this.node.cache.ecdh.set(req.ecdh_pk, content)
          // Emit the event.
          this.node.emit('/ecdh/sender/ret', [ req.ecdh_pk, secret ])
          // Resolve the request.
          req.resolve(secret)
        } else {
          req.reject('secret missing from response')
        }
      }
      // Also resolve any duplicate requests from the batch.
      for (const req of batch) {
        if (!uncached.includes(req) && !cached.includes(req)) {
          const secret = secrets.get(req.ecdh_pk)
          if (secret) {
            req.resolve(secret)
          } else {
            req.reject('secret missing from response')
          }
        }
      }
    } catch (err) {
      const reason = parse_error(err)
      this.node.emit('/ecdh/sender/err', [ reason, copy_obj(msgs ?? []) ])
      batch.filter(r => uncached.includes(r)).forEach(req => req.reject(reason))
    }
  }

  /**
   * Sends a batched ECDH request to multiple peers.
   *
   * @param peers - Array of peer public keys to send to.
   * @param pkg - The ECDH package to send.
   * @returns A Promise resolving to the array of ECDH responses.
   * @internal
   */
  private async create_request (
    peers : string[],
    pkg   : ECDHPackage
  ) : Promise<(RpcMessageData & { data: ECDHPackage })[]> {
    // Send request using the new cast API.
    const responses = await this.node.client.cast({
      method : 'ecdh',
      params : [ JSON.stringify(pkg) ]
    }, peers, { threshold: this.node.group.threshold })
    return responses.map(e => {
      const parsed = parse_ecdh_message(e)
      Assert.ok(parsed !== null, 'invalid ecdh response from pubkey: ' + e.event.pubkey)
      return parsed
    })
  }

  /**
   * Schedules batch processing if not already scheduled.
   *
   * Sets a timer to call `process()` after the configured interval
   * (ecdh_interval). If a timer is already active, this method does nothing.
   */
  schedule () {
    if (this._timer === null) {
      this._timer = setTimeout(() => this.process(), this._interval)
    }
  }

  /**
   * Closes the batcher, clearing any pending timer and rejecting queued requests.
   * Should be called when the BifrostNode is closing to ensure clean shutdown.
   */
  close () {
    if (this._timer !== null) {
      clearTimeout(this._timer)
      this._timer = null
    }
    const pending = [...this._queue]
    this._queue = []
    for (const req of pending) {
      req.reject('batcher closed')
    }
  }
}
