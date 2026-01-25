import { BifrostNode } from '@/class/client.js'

import { combine_batched_ecdh_pkgs }  from '@/lib/ecdh.js'
import { parse_ecdh_message } from '@/lib/parse.js'
import { get_send_pubkeys }   from '@/lib/peer.js'

import { Assert, copy_obj, parse_error, ecdhDebug } from '@/util/index.js'

import {
  get_member_indexes,
  select_random_peers
} from '@/lib/util.js'

import type {
  RpcMessageData,
  RpcMessageEnvelope,
  RequestRpcMessage
} from '@vbyte/nostr-sdk'

import type { ApiResponse, ECDHPackage, ECDHResultEntry } from '@/types/index.js'

/**
 * Handles incoming ECDH requests from peers.
 *
 * When another node in the group requests a threshold ECDH operation,
 * this handler processes the request by:
 * 1. Emitting the request for debugging/logging
 * 2. Applying any configured middleware
 * 3. Generating partial ECDH shares for all requested keys
 * 4. Publishing the ECDH shares back to the requesting peer
 *
 * Supports batched requests where entries contains multiple ecdh_pks.
 *
 * Events emitted:
 * - `/ecdh/handler/req` - When a request is received
 * - `/ecdh/handler/res` - When a response is sent successfully
 * - `/ecdh/handler/rej` - When an error occurs
 *
 * @param node - The BifrostNode handling the request.
 * @param msg - The signed message containing the ECDH package.
 */
export async function ecdh_handler_api (
  node : BifrostNode,
  msg  : RpcMessageEnvelope<RequestRpcMessage> & { data: ECDHPackage }
) {
  // Get the middleware.
  const middleware = node.config.middleware.ecdh
  // Try to parse the message.
  try {
    // Emit the request message.
    node.emit('/ecdh/handler/req', msg)
    // If the middleware is a function, apply it.
    if (typeof middleware === 'function') {
      msg = middleware(node, msg) as RpcMessageEnvelope<RequestRpcMessage> & { data: ECDHPackage }
    }
    // Get the members and entries from request.
    const { members, entries } = msg.data
    // Extract all ecdh_pks from entries.
    const ecdh_pks = entries.map(e => e.ecdh_pk)
    // Generate ECDH shares for all requested keys.
    const pkg = node.signer.gen_ecdh_shares(members, ecdh_pks)
    // Send the response using the new respond API.
    const res = await node.client.respond(msg).accept(pkg)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/ecdh/handler/res', msg)
  } catch (err) {
    // Log the error.
    ecdhDebug('error: %O', err)
    // Emit the error.
    node.emit('/ecdh/handler/rej', [ parse_error(err), msg ])
  }
}

/**
 * Creates a batch ECDH request API function.
 *
 * Returns a function that initiates a threshold ECDH operation for multiple
 * public keys in a single request. This is the wire-level API that always
 * operates on arrays.
 *
 * The process:
 * 1. Check cache for existing shared secrets (return cached immediately)
 * 2. Select random peers to meet threshold
 * 3. Generate local ECDH shares for all keys
 * 4. Request ECDH shares from selected peers
 * 5. Combine all shares to derive the shared secrets
 * 6. Cache the encrypted shared secrets for future use
 *
 * Events emitted:
 * - `/ecdh/sender/res` - When responses are received from peers
 * - `/ecdh/sender/rej` - When the request phase fails
 * - `/ecdh/sender/ret` - When each shared secret is derived
 * - `/ecdh/sender/err` - When share combination fails
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that performs batch threshold ECDH.
 *
 * @example
 * ```typescript
 * const ecdh_batch = ecdh_batch_request_api(node)
 * const result = await ecdh_batch(['pubkey1', 'pubkey2'])
 * if (result.ok) {
 *   result.data.forEach(([pk, secret]) => console.log(pk, secret))
 * }
 * ```
 */
export function ecdh_batch_request_api (node : BifrostNode) {

  return async (
    ecdh_pks : string[],
    peers?   : string[]
  ) : Promise<ApiResponse<ECDHResultEntry[]>> => {
    // Separate cached and uncached keys.
    const cached_results : ECDHResultEntry[] = []
    const uncached_pks   : string[] = []

    for (const ecdh_pk of ecdh_pks) {
      const encrypted = node.cache.ecdh.get(ecdh_pk)
      if (encrypted !== undefined) {
        const secret = node.signer.decrypt(encrypted, ecdh_pk)
        cached_results.push([ ecdh_pk, secret ])
      } else {
        uncached_pks.push(ecdh_pk)
      }
    }

    // If all keys are cached, return immediately.
    if (uncached_pks.length === 0) {
      return { ok: true, data: cached_results }
    }

    // Get the threshold for the group.
    const thold = node.group.threshold
    // Get peers with send policy active.
    const send_pks = get_send_pubkeys(node.peers)
    // Randomly select peers.
    const selected  = select_random_peers(peers ??= send_pks, thold)
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...selected ])
    // Generate ECDH shares for all uncached keys.
    const self_pkg = node.signer.gen_ecdh_shares(members, uncached_pks)

    let msgs : (RpcMessageData & { data: ECDHPackage })[] | null = null

    try {
      // Send the request to the peers.
      msgs = await create_ecdh_request(node, selected, self_pkg)
      // Emit the response.
      node.emit('/ecdh/sender/res', copy_obj(msgs))
    } catch (err) {
      // Log the error.
      ecdhDebug('error: %O', err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ecdh/sender/rej', [ reason, copy_obj(self_pkg) ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msgs !== null, 'no responses from peers')
      // Collect the response packages.
      const pkgs    = [ self_pkg, ...msgs.map(e => e.data) ]
      // Combine all shares for all keys.
      const secrets = combine_batched_ecdh_pkgs(pkgs)
      // Build result array and cache secrets.
      const results : ECDHResultEntry[] = [ ...cached_results ]

      for (const ecdh_pk of uncached_pks) {
        const secret = secrets.get(ecdh_pk)
        if (secret) {
          // Wrap the secret with encryption.
          const content = node.signer.encrypt(secret, ecdh_pk)
          // Store the encrypted secret in cache.
          node.cache.ecdh.set(ecdh_pk, content)
          // Emit the shared secret.
          node.emit('/ecdh/sender/ret', [ ecdh_pk, secret ])
          // Add to results.
          results.push([ ecdh_pk, secret ])
        } else {
          throw new Error('secret missing for ecdh_pk: ' + ecdh_pk)
        }
      }

      // Return the results.
      return { ok : true, data : results }
    } catch (err) {
      // Log the error.
      ecdhDebug('error: %O', err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ecdh/sender/err', [ reason, copy_obj(msgs ?? []) ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

/**
 * Creates a single ECDH request API function.
 *
 * Returns a function that performs threshold ECDH with a single public key.
 * This is a thin wrapper around the batcher for clean single-item DX.
 * Multiple concurrent calls will be automatically batched together.
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that performs threshold ECDH for a single key.
 *
 * @example
 * ```typescript
 * const ecdh = ecdh_single_request_api(node)
 * const result = await ecdh(remotePublicKey)
 * if (result.ok) {
 *   const sharedSecret = result.data
 * }
 * ```
 */
export function ecdh_single_request_api (node : BifrostNode) {
  const batcher = node.ecdh_batcher
  return async (ecdh_pk : string) : Promise<ApiResponse<string>> => {
    try {
      const secret = await batcher.push(ecdh_pk)
      return { ok : true, data : secret }
    } catch (err) {
      return { ok : false, err : parse_error(err) }
    }
  }
}

/**
 * Sends an ECDH request to multiple peers.
 *
 * @param node - The BifrostNode sending the request.
 * @param peers - Array of peer public keys to send to.
 * @param pkg - The ECDH package to send.
 * @returns A Promise resolving to the array of ECDH responses.
 * @throws Error if the multicast request fails or any response is invalid.
 * @internal
 */
async function create_ecdh_request (
  node  : BifrostNode,
  peers : string[],
  pkg   : ECDHPackage
) : Promise<(RpcMessageData & { data: ECDHPackage })[]> {
  // Send a request to the peer nodes using the new cast API.
  const responses = await node.client.cast({
    method : 'ecdh',
    params : [ JSON.stringify(pkg) ]
  }, peers, { threshold: node.group.threshold })
  // Parse the response packages.
  return responses.map(e => {
    const parsed = parse_ecdh_message(e)
    Assert.ok(parsed !== null, 'invalid ecdh response from pubkey: ' + e.event.pubkey)
    return parsed
  })
}
