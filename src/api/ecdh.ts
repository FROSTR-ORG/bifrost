import { BifrostNode } from '@/class/client.js'

import { finalize_message }   from '@cmdcode/nostr-p2p/lib'
import { combine_ecdh_pkgs }  from '@/lib/ecdh.js'
import { parse_ecdh_message } from '@/lib/parse.js'
import { get_send_pubkeys }   from '@/lib/peer.js'

import { Assert, copy_obj, parse_error } from '@/util/index.js'

import {
  get_member_indexes,
  select_random_peers
} from '@/lib/util.js'

import type { SignedMessage }            from '@cmdcode/nostr-p2p'
import type { ApiResponse, ECDHPackage } from '@/types/index.js'

/**
 * Handles incoming ECDH requests from peers.
 *
 * When another node in the group requests a threshold ECDH operation,
 * this handler processes the request by:
 * 1. Emitting the request for debugging/logging
 * 2. Applying any configured middleware
 * 3. Generating a partial ECDH share using the local signer
 * 4. Publishing the ECDH share back to the requesting peer
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
  msg  : SignedMessage<ECDHPackage>
) {
  // Get the middleware.
  const middleware = node.config.middleware.ecdh
  // Try to parse the message.
  try {
    // Emit the request message.
    node.emit('/ecdh/handler/req', copy_obj(msg))
    // If the middleware is a function, apply it.
    if (typeof middleware === 'function') {
      msg = middleware(node, msg)
    }
    // Get the members and ECDH public key.
    const { members, ecdh_pk } = msg.data
    // TODO: Verify ECDH request.
    // Generate the ECDH share.
    const pkg = node.signer.gen_ecdh_share(members, ecdh_pk)
    // Finalize the response package.
    const envelope = finalize_message({
      data : JSON.stringify(pkg),
      id   : msg.id,
      tag  : '/ecdh/res'
    })
    // Publish the response package.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/ecdh/handler/res', copy_obj(res.data))
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/ecdh/handler/rej', [ parse_error(err), copy_obj(msg) ])
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

    let msgs : SignedMessage<ECDHPackage>[] | null = null

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
      // Derive the secret from the packages.
      const secret  = finalize_ecdh_response(pkgs)
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
 * @returns A Promise resolving to the array of signed ECDH responses.
 * @throws Error if the multicast request fails or any response is invalid.
 * @internal
 */
async function create_ecdh_request (
  node  : BifrostNode,
  peers : string[],
  pkg   : ECDHPackage
) : Promise<SignedMessage<ECDHPackage>[]> {
  // Serialize the package as a string.
  const msg = { data : JSON.stringify(pkg), tag : '/ecdh/req' }
  // Send a request to the peer nodes.
  const res = await node.client.multicast(msg, peers)
  // Return early if the response fails.
  if (!res.sub.ok) throw new Error(res.sub.reason)
  // Parse the response packages.
  return res.sub.inbox.map(e => {
    const parsed = parse_ecdh_message(e)
    Assert.ok(parsed !== null, 'invalid ecdh response from pubkey: ' + e.env.pubkey)
    return parsed
  })
}

/**
 * Finalizes an ECDH operation by combining partial shares.
 *
 * @param pkgs - Array of ECDH packages (shares) to combine.
 * @returns The derived shared secret as a hex string.
 * @internal
 */
function finalize_ecdh_response (
  pkgs : ECDHPackage[]
) : string {
  // Return the combined ECDH share.
  return combine_ecdh_pkgs(pkgs)
}
