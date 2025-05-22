import { BifrostNode } from '@/class/client.js'

import type {
  SignRequest,
  SighashVector,
  SignatureEntry
} from '@/types/index.js'

export class SignerQueue {

  private readonly _ival : number
  private readonly _node : BifrostNode

  private _queue : SignRequest[]
  private _timer : NodeJS.Timeout | null

  constructor (node : BifrostNode) {
    this._node  = node
    this._ival  = node.config.sign_ival
    this._queue = []
    this._timer = null
  }

  get node () {
    return this._node
  }

  get timer () {
    return this._timer
  }

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
    } catch (err: any) {
      // If there's an error, reject all requests.
      batch.forEach(req => req.reject(err.message))
    }
  }

  schedule () {
    if (this.timer === null) {
      this._timer = setTimeout(() => this.process(), this._ival)
    }
  }
}
