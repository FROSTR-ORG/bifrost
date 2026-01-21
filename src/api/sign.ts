import { BifrostNode } from '@/class/client.js'

import { finalize_message }   from '@cmdcode/nostr-p2p/lib'
import { parse_psig_message } from '@/lib/parse.js'
import { get_send_pubkeys }   from '@/lib/peer.js'
import { format_sigvector }   from '@/lib/sighash.js'

import {
  get_member_indexes,
  select_random_peers
} from '@/lib/util.js'

import {
  Assert,
  copy_obj,
  parse_error
} from '@/util/index.js'

import {
  create_session_pkg,
  create_session_template,
  get_session_ctx
} from '@/lib/session.js'

import {
  combine_signature_pkgs,
  verify_psig_pkg
} from '@/lib/sign.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  SignSessionPackage,
  PartialSigPackage,
  SignRequestConfig,
  SignatureEntry,
  SighashVector
} from '@/types/index.js'

/**
 * Handles incoming signature requests from peers.
 *
 * When another node in the signing group requests a threshold signature,
 * this handler processes the request by:
 * 1. Emitting the request for debugging/logging
 * 2. Applying any configured middleware
 * 3. Creating a partial signature using the local signer
 * 4. Publishing the partial signature back to the requesting peer
 *
 * Events emitted:
 * - `/sign/handler/req` - When a request is received
 * - `/sign/handler/res` - When a response is sent successfully
 * - `/sign/handler/rej` - When an error occurs
 *
 * @param node - The BifrostNode handling the request.
 * @param msg - The signed message containing the signing session package.
 */
export async function sign_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<SignSessionPackage>
) {
  // Get the middleware.
  const middleware = node.config.middleware.sign
  // Try to handle the request.
  try {
    // Emit the request package.
    node.emit('/sign/handler/req', copy_obj(msg))
    // If the middleware is a function, apply it.
    if (typeof middleware === 'function') {
      msg = middleware(node, msg)
    }
    // Sign the session.
    const pkg = node.signer.sign_session(msg.data)
    // Publish the response package.
    const envelope = finalize_message({
      data : JSON.stringify(pkg),
      id   : msg.id,
      tag  : '/sign/res'
    })
    // Send the response package to the peer.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/sign/handler/res', copy_obj(res.data))
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/sign/handler/rej', [ parse_error(err), copy_obj(msg) ])
  }
}

/**
 * Creates a queue API function for batched signature requests.
 *
 * Returns a function that queues messages for batch signing. Multiple
 * messages queued in quick succession are combined into a single signing
 * session, reducing network overhead.
 *
 * @param node - The BifrostNode to create the queue API for.
 * @returns An async function that queues a message and returns its signature.
 *
 * @example
 * ```typescript
 * const queue = sign_queue_api(node)
 * const signature = await queue('message-to-sign')
 * ```
 */
export function sign_queue_api (node : BifrostNode) {
  return async (
    message : string | string[]
  ) : Promise<SignatureEntry> => {
    const sigvec = format_sigvector(message)
    return node.queue.push(sigvec)
  }
}

/**
 * Creates a request API function for threshold signing.
 *
 * Returns a function that initiates a threshold signing session with peers.
 * The process:
 * 1. Formats the message(s) into sighash vectors
 * 2. Selects random peers to meet the threshold
 * 3. Creates a signing session with nonces
 * 4. Sends requests to selected peers
 * 5. Collects partial signatures and combines them
 * 6. Returns the final aggregated signatures
 *
 * Events emitted:
 * - `/sign/sender/res` - When responses are received from peers
 * - `/sign/sender/rej` - When the request phase fails
 * - `/sign/sender/ret` - When signatures are successfully combined
 * - `/sign/sender/err` - When signature combination fails
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that requests threshold signatures.
 *
 * @example
 * ```typescript
 * const sign = sign_request_api(node)
 *
 * // Sign a single message
 * const result = await sign('deadbeef...')
 *
 * // Sign multiple messages
 * const result = await sign([['hash1'], ['hash2', 'metadata']])
 * ```
 */
export function sign_request_api (node : BifrostNode) {
  return async (
    message : string | SighashVector[],
    options : Partial<SignRequestConfig> = {}
  ) : Promise<ApiResponse<SignatureEntry[]>> => {
    // Format the message as a sigvector.
    const sigvecs  = typeof message === 'string' ? [ [ message ] ] : message
    // Get peers with send policy active.
    const send_pks = get_send_pubkeys(node.peers)
    // Get the peers to send the request to.
    const peers    = options.peers ??= send_pks
    // Get the threshold for the group.
    const thold    = node.group.threshold
    // Randomly select peers.
    const selected = select_random_peers(peers, thold)
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...selected ])
    // Create the session template.
    const template = create_session_template(members, sigvecs, options)
    // Assert the template is not null.
    Assert.ok(template !== null, 'invalid session template')
    // Create the session package.
    const session  = create_session_pkg(node.group, template)
    // Initialize the list of response packages.
    let msgs : SignedMessage<PartialSigPackage>[] | null = null

    try {
      // Create the request.
      msgs = await create_sign_request(node, selected, session)
      // Emit the response.
      node.emit('/sign/sender/res', copy_obj(msgs))
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/sign/sender/rej', [ reason, session ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msgs !== null, 'no responses from peers')
      // Finalize the response.
      const sigs = finalize_sign_response(node, msgs, session)
      // Emit the response.
      node.emit('/sign/sender/ret', [ session.sid, sigs ])
      // Return the signature.
      return { ok : true, data :sigs }
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/sign/sender/err', [ reason, msgs ?? [] ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

/**
 * Sends a signing session request to multiple peers.
 *
 * @param node - The BifrostNode sending the request.
 * @param peers - Array of peer public keys to send to.
 * @param session - The signing session package to send.
 * @returns A Promise resolving to the array of signed partial signature responses.
 * @throws Error if the multicast request fails.
 * @internal
 */
async function create_sign_request (
  node    : BifrostNode,
  peers   : string[],
  session : SignSessionPackage
) : Promise<SignedMessage<PartialSigPackage>[]> {
  // Send this request to other nodes, and await their response.
  const res = await node.client.multicast({
    data : JSON.stringify(session),
    tag  : '/sign/req'
  }, peers)
  // Return the response.
  if (!res.sub.ok) throw new Error(res.sub.reason)
  // Return the response.
  return res.sub.inbox
}

/**
 * Finalizes a signing session by combining partial signatures.
 *
 * Verifies each partial signature from peers, combines them with the
 * local partial signature, and produces the final aggregated signatures.
 *
 * @param node - The BifrostNode that initiated the request.
 * @param responses - Array of signed partial signature responses from peers.
 * @param session - The original signing session package.
 * @returns Array of signature entries [id, signature].
 * @throws Error if any partial signature is invalid.
 * @internal
 */
function finalize_sign_response (
  node      : BifrostNode,
  responses : SignedMessage<PartialSigPackage>[],
  session   : SignSessionPackage
) : SignatureEntry[] {
  // Initialize the list of response packages.
  const ctx  = get_session_ctx(node.group, session)
  const pkgs = [ node.signer.sign_session(session) ]
  // Parse the response packages.
  responses.forEach(e => {
    const parsed = parse_psig_message(e)
    const error  = verify_psig_pkg(ctx, parsed.data)
    Assert.ok(error === null, error + ' : ' + e.env.pubkey)
    pkgs.push(parsed.data)
  })
  // Return the aggregate signature.
  return combine_signature_pkgs(ctx, pkgs)
}
