import { BifrostNode } from '@/class/client.js'

import { combine_ecdh_pkgs }  from '@/lib/ecdh.js'
import { parse_ecdh_message } from '@/lib/parse.js'
import { get_send_pubkeys }   from '@/lib/peer.js'

import { Assert, copy_obj, parse_error } from '@/util/index.js'

import {
  get_member_indexes,
  select_random_peers
} from '@/lib/util.js'

import type {
  RpcMessageData,
  RpcMessageEnvelope,
  RequestRpcMessage
} from '@vbyte/nostr-sdk'

import type { ApiResponse, ECDHPackage } from '@/types/index.js'

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
    const pkg = node.signer.gen_batched_ecdh_shares(members, ecdh_pks)
    // Send the response using the new respond API.
    const res = await node.client.respond(msg).accept(pkg)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/ecdh/handler/res', msg)
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/ecdh/handler/rej', [ parse_error(err), msg ])
  }
}

/**
 * Creates a request API function for threshold ECDH key exchange.
 *
 * Returns a function that initiates a threshold ECDH operation with peers.
 * This allows the group to derive a shared secret with a remote public key
 * without any single member knowing the group's secret key.
 *
 * The process:
 * 1. Check cache for existing shared secret
 * 2. If not cached, select random peers to meet threshold
 * 3. Generate local ECDH share
 * 4. Request ECDH shares from selected peers
 * 5. Combine all shares to derive the shared secret
 * 6. Cache the encrypted shared secret for future use
 *
 * Events emitted:
 * - `/ecdh/sender/res` - When responses are received from peers
 * - `/ecdh/sender/rej` - When the request phase fails
 * - `/ecdh/sender/ret` - When the shared secret is derived
 * - `/ecdh/sender/err` - When share combination fails
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that performs threshold ECDH.
 *
 * @example
 * ```typescript
 * const ecdh = ecdh_request_api(node)
 * const result = await ecdh(remotePublicKey)
 * if (result.ok) {
 *   const sharedSecret = result.data
 * }
 * ```
 */
export function ecdh_request_api (node : BifrostNode) {

  return async (
    ecdh_pk : string,
    peers?  : string[]
  ) : Promise<ApiResponse<string>> => {
    // Get the threshold for the group.
    const thold = node.group.threshold
    // Get peers with send policy active.
    const send_pks = get_send_pubkeys(node.peers)
    // Randomly select peers.
    const selected  = select_random_peers(peers ??= send_pks, thold)
    // Check if we have the shared secret in cache.
    const encrypted = node.cache.ecdh.get(ecdh_pk)
    // If the cache has a secret:
    if (encrypted !== undefined) {
      // Return the decrypted secret.
      return { ok: true, data: node.signer.unwrap(encrypted, ecdh_pk) }
    }
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...selected ])
    // Generate an ECDH request package.
    const self_pkg = node.signer.gen_ecdh_share(members, ecdh_pk)

    let msgs : (RpcMessageData & { data: ECDHPackage })[] | null = null

    try {
      // Send the request to the peers.
      msgs = await create_ecdh_request(node, selected, self_pkg)
      // Emit the response.
      node.emit('/ecdh/sender/res', copy_obj(msgs))
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
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
      // Derive the secret from the packages for this specific ecdh_pk.
      const secret  = finalize_ecdh_response(pkgs, ecdh_pk)
      // Wrap the secret with encryption.
      const content = node.signer.wrap(secret, ecdh_pk)
      // Store the encrypted secret in cache.
      node.cache.ecdh.set(ecdh_pk, content)
      // Emit the shared secret.
      node.emit('/ecdh/sender/ret', [ ecdh_pk, secret ])
      // Return the shared secret.
      return { ok : true, data : secret }
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
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

/**
 * Finalizes an ECDH operation by combining partial shares.
 *
 * @param pkgs - Array of ECDH packages (shares) to combine.
 * @param ecdh_pk - The public key to derive the secret for.
 * @returns The derived shared secret as a hex string.
 * @internal
 */
function finalize_ecdh_response (
  pkgs    : ECDHPackage[],
  ecdh_pk : string
) : string {
  // Return the combined ECDH share for the specified key.
  return combine_ecdh_pkgs(pkgs, ecdh_pk)
}

/**
 * Creates a batched ECDH request API function.
 *
 * Returns a function that queues ECDH requests for batch processing.
 * Multiple ECDH operations requested in quick succession are combined
 * into a single network request, reducing overhead.
 *
 * @param node - The BifrostNode to create the batched API for.
 * @returns An async function that performs batched threshold ECDH.
 *
 * @example
 * ```typescript
 * const ecdh = ecdh_batched_request_api(node)
 * // These will be batched together
 * const [secret1, secret2] = await Promise.all([
 *   ecdh('pubkey1'),
 *   ecdh('pubkey2')
 * ])
 * ```
 */
export function ecdh_batched_request_api (node : BifrostNode) {
  return async (ecdh_pk : string) : Promise<ApiResponse<string>> => {
    try {
      const secret = await node.ecdh_batcher.push(ecdh_pk)
      return { ok : true, data : secret }
    } catch (err) {
      return { ok : false, err : parse_error(err) }
    }
  }
}
