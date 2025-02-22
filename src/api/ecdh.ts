import BifrostNode from '@/class/client.js'

import { finalize_message }   from '@cmdcode/nostr-p2p/lib'
import { parse_ecdh_message } from '@/lib/parse.js'
import { combine_ecdh_pkgs }  from '@/lib/ecdh.js'
import { get_member_indexes } from '@/lib/util.js'

import { Assert, copy_obj, parse_error } from '@/util/index.js'

import type { SignedMessage }            from '@cmdcode/nostr-p2p'
import type { ApiResponse, ECDHPackage } from '@/types/index.js'

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

export function ecdh_request_api (node : BifrostNode) {
  return async (
    ecdh_pk : string,
    peers   : string[]
  ) : Promise<ApiResponse<string>> => {
    // Check if we have the shared secret in cache.
    const encrypted = node.cache.ecdh.get(ecdh_pk)
    // If the cache has a secret:
    if (encrypted !== undefined) {
      // Return the decrypted secret.
      return { ok: true, data: node.signer.unwrap(encrypted, ecdh_pk) }
    }
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...peers ])
    // Generate an ECDH request package.
    const self_pkg = node.signer.gen_ecdh_share(members, ecdh_pk)

    let msgs : SignedMessage<ECDHPackage>[] | null = null

    try {
      // Send the request to the peers.
      msgs = await create_ecdh_request(node, peers, self_pkg)
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
      node.emit('/ecdh/sender/sec', [ secret, copy_obj(pkgs) ])
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

function finalize_ecdh_response (
  pkgs : ECDHPackage[]
) : string {
  // Return the combined ECDH share.
  return combine_ecdh_pkgs(pkgs)
}
