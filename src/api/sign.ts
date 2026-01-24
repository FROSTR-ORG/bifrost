import { BifrostNode } from '@/class/client.js'

import { parse_psig_message }                  from '@/lib/parse.js'
import { get_send_pubkeys, get_signable_pubkeys } from '@/lib/peer.js'
import { format_sigvector }                    from '@/lib/sighash.js'

import {
  get_member_indexes,
  pubkeys_match,
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

import type {
  RpcMessageData,
  RpcMessageEnvelope,
  RequestRpcMessage
} from '@vbyte/nostr-sdk'

import type {
  ApiResponse,
  MemberPublicNonce,
  SecretNoncePair,
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
 * 3. Finding our nonce in the session and deriving the secret
 * 4. Creating a partial signature using the local signer
 * 5. Marking the nonce as spent
 * 6. Publishing the partial signature back to the requesting peer
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
  msg  : RpcMessageEnvelope<RequestRpcMessage> & { data: SignSessionPackage }
) {
  // Get the middleware.
  const middleware = node.config.middleware.sign
  // Try to handle the request.
  try {
    // Emit the request package.
    node.emit('/sign/handler/req', msg)

    // If the middleware is a function, apply it.
    if (typeof middleware === 'function') {
      msg = middleware(node, msg) as RpcMessageEnvelope<RequestRpcMessage> & { data: SignSessionPackage }
    }

    const session = msg.data

    // Get our nonce from the session
    const our_idx = node.signer.idx
    const requester_idx = get_member_idx_by_pubkey(node, msg.event.pubkey)

    // Find our nonce in the session's unified nonces array
    const our_nonce = session.nonces?.find(n => n.idx === our_idx)
    if (!our_nonce) {
      throw new Error('no nonce found for our index in session')
    }

    // Derive secret from the nonce sent by requester
    const secret_nonce = node.pool.derive_secret_for_signing(
      requester_idx,
      our_nonce
    )
    if (!secret_nonce) {
      throw new Error('failed to derive secret from nonce code: ' + our_nonce.code)
    }

    // Sign the session with the secret nonce.
    const pkg = node.signer.sign_session(session, secret_nonce)

    // Mark the nonce as spent
    node.pool.mark_spent(requester_idx, our_nonce.code)

    // Send the response using the new respond API.
    const res = await node.client.respond(msg).accept(pkg)
    if (!res.ok) throw new Error('failed to publish response')

    // Emit the response package.
    node.emit('/sign/handler/res', msg)

  } catch (err) {
    if (node.debug) console.log(err)
    node.emit('/sign/handler/rej', [ parse_error(err), msg ])
  }
}

/**
 * Get member index by pubkey.
 * @internal
 */
function get_member_idx_by_pubkey (
  node   : BifrostNode,
  pubkey : string
) : number {
  const member = node.group.members.find(m => pubkeys_match(m.pubkey, pubkey))
  if (!member) throw new Error('member not found for pubkey: ' + pubkey)
  return member.idx
}

/**
 * Filter peer pubkeys to only those with available nonces.
 * @internal
 */
function filter_peers_with_nonces (
  node    : BifrostNode,
  pubkeys : string[]
) : string[] {
  return pubkeys.filter(pk => {
    const member = node.group.members.find(m => pubkeys_match(m.pubkey, pk))
    if (!member) return false
    return node.pool.can_sign(member.idx)
  })
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
    return node.sign_batcher.push(sigvec)
  }
}

/**
 * Creates a request API function for threshold signing.
 *
 * Returns a function that initiates a threshold signing session with peers.
 * The process:
 * 1. Formats the message(s) into sighash vectors
 * 2. Selects random peers to meet the threshold
 * 3. Collects nonces from peer pools
 * 4. Creates a signing session with unified nonces array
 * 5. Sends requests to selected peers
 * 6. Collects partial signatures and combines them
 * 7. Returns the final aggregated signatures
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
    // Get the threshold for the group.
    const thold    = node.group.threshold
    // Calculate required peers (we are one of the signers).
    const required = thold - 1

    // Get candidates filtered by send policy AND nonce availability.
    let candidates : string[]
    if (options.peers) {
      // User provided specific peers - filter by nonce availability.
      candidates = filter_peers_with_nonces(node, options.peers)
    } else {
      // Default: filter by send policy AND nonce availability.
      candidates = get_signable_pubkeys(node.peers, node.pool, node.group)
    }

    // Check if we have enough candidates before selection.
    if (candidates.length < required) {
      const reason = `insufficient peers with available nonces: need ${required}, have ${candidates.length}`
      node.emit('/sign/sender/rej', [ reason, null ])
      return { ok: false, err: reason }
    }

    // Randomly select from valid candidates.
    const selected = select_random_peers(candidates, thold)
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...selected ])
    // Create the session template.
    const template = create_session_template(members, sigvecs, options)
    // Assert the template is not null.
    Assert.ok(template !== null, 'invalid session template')

    // Collect nonces for all participating members (unified format)
    const { nonces, our_secret } = collect_nonces_for_session(node, selected)

    // Create the session package with unified nonces array.
    const base_session = create_session_pkg(node.group, template)
    const session : SignSessionPackage = {
      ...base_session,
      nonces
    }

    // Initialize the list of response packages.
    let msgs : (RpcMessageData & { data: PartialSigPackage })[] | null = null

    try {
      // Create the request.
      msgs = await create_sign_request(node, selected, session)
      // Emit the response.
      node.emit('/sign/sender/res', copy_obj(msgs))
    } catch (err) {
      if (node.debug) console.log(err)
      const reason = parse_error(err)
      node.emit('/sign/sender/rej', [ reason, session ])
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msgs !== null, 'no responses from peers')
      // Finalize the response.
      const sigs = finalize_sign_response(node, msgs, session, our_secret)
      // Emit the response.
      node.emit('/sign/sender/ret', [ session.sid, sigs ])
      // Return the signature.
      return { ok : true, data : sigs }
    } catch (err) {
      if (node.debug) console.log(err)
      const reason = parse_error(err)
      node.emit('/sign/sender/err', [ reason, msgs ?? [] ])
      return { ok : false, err : reason }
    }
  }
}

/**
 * Collects nonces from peer pools for a signing session.
 *
 * For each peer in the signing group:
 * - We consume a nonce from our incoming pool (nonces they sent us)
 * - The returned MemberPublicNonce includes idx, code, and public points
 * For ourselves:
 * - We generate a fresh nonce pair and keep the secret for signing
 *
 * Returns a unified nonces array where each entry is a MemberPublicNonce
 * containing idx (member index), code (derivation code), and public points.
 *
 * @param node - The BifrostNode.
 * @param peer_pubkeys - The pubkeys of peers participating in signing.
 * @returns Object with unified nonces array and our secret nonce.
 * @internal
 */
function collect_nonces_for_session (
  node         : BifrostNode,
  peer_pubkeys : string[]
) : { nonces: MemberPublicNonce[], our_secret: SecretNoncePair } {
  const nonces : MemberPublicNonce[] = []
  const our_idx = node.signer.idx

  // For each peer, consume a nonce from incoming pool
  // These are nonces they sent us; we send the full nonce (with code) back
  for (const pk of peer_pubkeys) {
    const peer_idx = get_member_idx_by_pubkey(node, pk)
    const nonce = node.pool.consume_incoming(peer_idx)
    if (!nonce) {
      throw new Error(`no nonces available from peer ${peer_idx}`)
    }
    // MemberPublicNonce includes idx, code, and public points
    nonces.push(nonce)
  }

  // Generate our own nonce for this signing session
  // generate_for_peer returns NoncePackage (array of DerivedPublicNonce)
  const our_nonces = node.pool.generate_for_peer(our_idx, 1)
  if (our_nonces.length === 0) {
    throw new Error('failed to generate self nonce')
  }
  const our_derived = our_nonces[0]

  // Add our nonce with our idx
  nonces.push({
    idx       : our_idx,
    binder_pn : our_derived.binder_pn,
    hidden_pn : our_derived.hidden_pn,
    code      : our_derived.code
  })

  // Get the secret nonce we just generated
  const our_secret = node.pool.get_secret_nonce(our_idx, our_derived.code)
  if (!our_secret) {
    throw new Error('self nonce secret not found after generation')
  }

  return { nonces, our_secret }
}

/**
 * Sends a signing session request to multiple peers.
 *
 * @param node - The BifrostNode sending the request.
 * @param peers - Array of peer public keys to send to.
 * @param session - The signing session package to send.
 * @returns A Promise resolving to the array of partial signature responses.
 * @throws Error if the multicast request fails.
 * @internal
 */
async function create_sign_request (
  node    : BifrostNode,
  peers   : string[],
  session : SignSessionPackage
) : Promise<(RpcMessageData & { data: PartialSigPackage })[]> {
  // Send this request to other nodes using the new cast API.
  const responses = await node.client.cast({
    method : 'sign',
    params : [ JSON.stringify(session) ]
  }, peers, { threshold: node.group.threshold })
  // Parse responses to extract partial signature packages.
  return responses.map(e => parse_psig_message(e))
}

/**
 * Finalizes a signing session by combining partial signatures.
 *
 * Verifies each partial signature from peers, combines them with the
 * local partial signature, and produces the final aggregated signatures.
 *
 * @param node - The BifrostNode that initiated the request.
 * @param responses - Array of partial signature responses from peers.
 * @param session - The original signing session package.
 * @param our_secret - Our secret nonce for signing.
 * @returns Array of signature entries [id, signature].
 * @throws Error if any partial signature is invalid.
 * @internal
 */
function finalize_sign_response (
  node       : BifrostNode,
  responses  : (RpcMessageData & { data: PartialSigPackage })[],
  session    : SignSessionPackage,
  our_secret : SecretNoncePair
) : SignatureEntry[] {
  // Get the session context.
  const ctx = get_session_ctx(node.group, session)

  // Create our partial signature using our secret nonce
  const our_pkg = node.signer.sign_session(session, our_secret)

  // Mark our nonce as spent
  node.pool.mark_spent(node.signer.idx, our_secret.code)

  // Collect all partial signatures
  const pkgs = [ our_pkg ]

  // Verify and collect peer responses.
  responses.forEach(e => {
    const error = verify_psig_pkg(ctx, e.data)
    Assert.ok(error === null, error + ' : ' + e.event.pubkey)
    pkgs.push(e.data)
  })

  // Return the aggregate signature.
  return combine_signature_pkgs(ctx, pkgs)
}
