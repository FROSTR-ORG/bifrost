import { BifrostNode }  from '@/class/client.js'
import { parse_error }  from '@/util/helpers.js'

import type {
  SignRequest,
  SighashVector,
  SignatureEntry
} from '@/types/index.js'

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
export class SignBatcher {

  /** Batch processing interval in milliseconds. */
  private readonly _ival : number
  /** Reference to the parent BifrostNode. */
  private readonly _node : BifrostNode

  /** Queue of pending signature requests. */
  private _queue : SignRequest[]
  /** Timer handle for scheduled batch processing. */
  private _timer : NodeJS.Timeout | null

  /**
   * Creates a new SignBatcher instance.
   *
   * @param node - The BifrostNode this batcher belongs to.
   */
  constructor (node : BifrostNode) {
    this._node  = node
    this._ival  = node.config.sign_interval
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
   * Gets the current timer handle.
   * @returns The setTimeout handle, or null if no batch is scheduled.
   */
  get timer () {
    return this._timer
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
  async push (
    sigvec : SighashVector
  ) : Promise<SignatureEntry> {
    return new Promise((resolve, reject) => {
      // Add the request to the queue
      this._queue.push({ sigvec, resolve, reject })
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
  async process () {
    // Get the current batch from the queue.
    const batch = [ ...this._queue ]
    // Clear the timer and queue.
    this._queue = []
    this._timer = null
    // If there are no requests, return.
    if (batch.length === 0) return
    // Emit the info event.
    this.node.emit('info', 'batch signing event ids: ' + String(batch.map(req => req.sigvec[0])))
    // Try to sign the batch.
    try {
      // Collect all IDs to be signed
      const vec = batch.map(req => req.sigvec)
      // Send all IDs to be signed in one request
      const res = await this.node.req.sign(vec)
      // If the batch failed, reject all requests.
      if (!res.ok) {
        batch.forEach(req => req.reject(res.err))
        return
      }
      // Resolve each request with the signature.
      batch.forEach(req => {
        // Get the signature for the request.
        const sig_entry = res.data.find(e => e[0] === req.sigvec[0])
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
  }

  /**
   * Schedules batch processing if not already scheduled.
   *
   * Sets a timer to call `process()` after the configured interval
   * (sign_interval). If a timer is already active, this method does nothing.
   */
  schedule () {
    if (this.timer === null) {
      this._timer = setTimeout(() => this.process(), this._ival)
    }
  }
}
