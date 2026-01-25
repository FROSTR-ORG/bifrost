import { BifrostNode }           from '@/class/client.js'
import { ecdh_batch_request_api } from '@/api/ecdh.js'
import { sign_batch_request_api } from '@/api/sign.js'
import { parse_error }           from '@/util/index.js'

import type { SighashVector, SignatureEntry } from '@/types/index.js'

/**
 * Generic request with Promise resolve/reject callbacks.
 */
interface BatchRequest<TInput, TOutput> {
  input   : TInput
  resolve : (result: TOutput) => void
  reject  : (error: string) => void
}

/**
 * A queued signature request.
 */
type SignRequest = BatchRequest<SighashVector, SignatureEntry>

/**
 * A queued ECDH request.
 */
type ECDHRequest = BatchRequest<string, string>

/**
 * Abstract base class for batch processing operations.
 * Handles timer management, queue operations, and clean shutdown.
 */
abstract class BaseBatcher<TInput, TOutput> {
  protected readonly _node     : BifrostNode
  protected readonly _interval : number
  protected _queue      : BatchRequest<TInput, TOutput>[]
  protected _timer      : NodeJS.Timeout | null
  protected _processing : boolean

  constructor(node: BifrostNode, interval: number) {
    this._node       = node
    this._interval   = interval
    this._queue      = []
    this._timer      = null
    this._processing = false
  }

  /**
   * Gets the parent BifrostNode.
   * @returns The BifrostNode this batcher belongs to.
   */
  get node() {
    return this._node
  }

  /**
   * Schedules batch processing if not already scheduled.
   *
   * Sets a timer to call `process()` after the configured interval.
   * If a timer is already active, this method does nothing.
   */
  schedule() {
    if (this._timer === null) {
      this._timer = setTimeout(() => this.process(), this._interval)
    }
  }

  /**
   * Closes the batcher, clearing any pending timer and rejecting queued requests.
   * Should be called when the BifrostNode is closing to ensure clean shutdown.
   */
  close() {
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

  /**
   * Queues an input for batch processing.
   * @param input - The input to queue.
   * @returns A Promise that resolves with the output.
   */
  abstract push(input: TInput): Promise<TOutput>

  /**
   * Processes all queued requests as a batch.
   * Called automatically by the scheduled timer.
   */
  abstract process(): Promise<void>
}

/**
 * SignBatcher batches signature requests for efficient processing.
 *
 * Instead of sending individual signing requests to peers immediately,
 * the batcher collects requests and processes them in batches at a
 * configurable interval. This reduces network overhead and improves
 * performance when multiple messages need to be signed in quick succession.
 *
 * How it works:
 * 1. Requests are added via `push()` which returns a Promise
 * 2. A timer schedules batch processing after `sign_interval` milliseconds
 * 3. When the timer fires, `process()` sends all queued requests as a batch
 * 4. Each request's Promise is resolved or rejected based on the batch result
 *
 * @example
 * ```typescript
 * // Queue multiple signatures - they'll be batched together
 * const sig1 = node.req.queue('message1')
 * const sig2 = node.req.queue('message2')
 * const [result1, result2] = await Promise.all([sig1, sig2])
 * ```
 */
export class SignBatcher extends BaseBatcher<SighashVector, SignatureEntry> {

  /** Cached batch signing API function. */
  private readonly _sign_batch : ReturnType<typeof sign_batch_request_api>
  /** Maximum batch size from config. */
  private readonly _max_batch  : number

  /**
   * Creates a new SignBatcher instance.
   *
   * @param node - The BifrostNode this batcher belongs to.
   */
  constructor(node: BifrostNode) {
    super(node, node.config.sign_interval)
    this._sign_batch = sign_batch_request_api(node)
    this._max_batch  = node.config.max_sign_batch
  }

  /**
   * Queues a signature request for batch processing.
   *
   * The request is added to the queue and a timer is scheduled to process
   * the batch. The returned Promise resolves when the batch is processed
   * and this specific request's signature is available.
   *
   * @param sigvec - The sighash vector to sign (message hash and optional metadata).
   * @returns A Promise that resolves with the signature entry [id, signature].
   * @throws Rejects if the signing request fails or the signature is missing.
   */
  async push(sigvec: SighashVector): Promise<SignatureEntry> {
    return new Promise((resolve, reject) => {
      // Add the request to the queue
      this._queue.push({ input: sigvec, resolve, reject })
      // Schedule batch processing if not already scheduled.
      this.schedule()
    })
  }

  /**
   * Processes all queued signature requests as a batch.
   *
   * This method:
   * 1. Captures the current queue and clears it
   * 2. Sends all requests to peers in a single signing session
   * 3. Resolves or rejects each individual request's Promise
   *
   * Called automatically by the scheduled timer. Can also be called
   * manually to force immediate processing.
   */
  async process() {
    // Prevent concurrent processing
    if (this._processing) return
    this._processing = true

    try {
      // Get the current batch from the queue.
      const batch = [...this._queue] as SignRequest[]
      // Clear the timer and queue.
      this._queue = []
      this._timer = null
      // If there are no requests, return.
      if (batch.length === 0) return
    // Reject if batch exceeds maximum size
    if (batch.length > this._max_batch) {
      const reason = `batch size ${batch.length} exceeds maximum ${this._max_batch}`
      batch.forEach(req => req.reject(reason))
      return
    }
    // Emit the info event.
    this.node.emit('info', 'batch signing event ids: ' + String(batch.map(req => req.input[0])))
    // Try to sign the batch.
    try {
      // Collect all IDs to be signed
      const vec = batch.map(req => req.input)
      // Send all IDs to be signed in one request using cached batch API
      const res = await this._sign_batch(vec)
      // If the batch failed, reject all requests.
      if (!res.ok) {
        batch.forEach(req => req.reject(res.err))
        return
      }
      // Build a Map for O(1) signature lookup instead of O(n*m)
      const sig_map = new Map(res.data.map(e => [e[0], e]))
      // Resolve each request with the signature.
      batch.forEach(req => {
        // Get the signature for the request.
        const sig_entry = sig_map.get(req.input[0])
        // If there's a signature,
        if (sig_entry !== undefined) {
          // Resolve the request with the signature.
          req.resolve(sig_entry)
        } else {
          // If there's no signature, reject the request.
          req.reject('signature missing from response')
        }
      })
    } catch (err: unknown) {
      // If there's an error, reject all requests.
      batch.forEach(req => req.reject(parse_error(err)))
    }
    } finally {
      this._processing = false
    }
  }
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
export class ECDHBatcher extends BaseBatcher<string, string> {

  /** Cached batch ECDH API function. */
  private readonly _ecdh_batch : ReturnType<typeof ecdh_batch_request_api>
  /** Maximum batch size from config. */
  private readonly _max_batch  : number

  /**
   * Creates a new ECDHBatcher instance.
   *
   * @param node - The BifrostNode this batcher belongs to.
   */
  constructor(node: BifrostNode) {
    super(node, node.config.ecdh_interval)
    this._ecdh_batch = ecdh_batch_request_api(node)
    this._max_batch  = node.config.max_ecdh_batch
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
  async push(ecdh_pk: string): Promise<string> {
    // Check cache first.
    const encrypted = this.node.cache.ecdh.get(ecdh_pk)
    if (encrypted !== undefined) {
      return this.node.signer.decrypt(encrypted, ecdh_pk)
    }
    // Queue the request.
    return new Promise((resolve, reject) => {
      this._queue.push({ input: ecdh_pk, resolve, reject })
      this.schedule()
    })
  }

  /**
   * Processes all queued ECDH requests as a batch.
   *
   * This method:
   * 1. Captures the current queue and clears it
   * 2. Resolves cached requests immediately
   * 3. Delegates uncached requests to ecdh_batch_request_api
   * 4. Resolves or rejects each individual request's Promise
   *
   * Called automatically by the scheduled timer. Can also be called
   * manually to force immediate processing.
   */
  async process() {
    // Prevent concurrent processing
    if (this._processing) return
    this._processing = true

    try {
      // Get the current batch from the queue.
      const batch = [...this._queue] as ECDHRequest[]
      // Clear the timer and queue.
      this._queue = []
      this._timer = null
      // If there are no requests, return.
      if (batch.length === 0) return

    // Resolve cached requests immediately and collect uncached.
    const uncached: ECDHRequest[] = []

    for (const req of batch) {
      const encrypted = this.node.cache.ecdh.get(req.input)
      if (encrypted !== undefined) {
        try {
          req.resolve(this.node.signer.decrypt(encrypted, req.input))
        } catch (err) {
          req.reject(parse_error(err))
        }
      } else {
        uncached.push(req)
      }
    }

    // If all were cached, we're done.
    if (uncached.length === 0) return

    // Reject if batch size exceeds limit to avoid relay message size limits.
    if (uncached.length > this._max_batch) {
      const reason = `ECDH batch size ${uncached.length} exceeds maximum ${this._max_batch}`
      for (const req of uncached) {
        req.reject(reason)
      }
      return
    }

    // Get unique ecdh_pks to request.
    const unique_pks = [...new Set(uncached.map(r => r.input))]

    // Emit info event.
    this.node.emit('info', 'batch ECDH pubkeys: ' + String(unique_pks.map(pk => pk.slice(0, 8) + '...')))

    // Delegate to cached batch API.
    const res = await this._ecdh_batch(unique_pks)

    if (!res.ok) {
      uncached.forEach(req => req.reject(res.err))
      return
    }

    // Build lookup map for O(1) access.
    const secret_map = new Map(res.data)

    // Resolve each request.
    for (const req of uncached) {
      const secret = secret_map.get(req.input)
      if (secret) {
        req.resolve(secret)
      } else {
        req.reject('secret missing from response')
      }
    }
    } finally {
      this._processing = false
    }
  }
}
