import BifrostNode from '@/class/client.js'

import { SignedMessage }       from '@cmdcode/nostr-p2p'
import { parse_ecdh_message }  from '@/lib/parse.js'
import { combine_ecdh_pkgs }   from "@/lib/ecdh.js"
import { Assert, parse_error } from '@/util/index.js'

import type { ApiResponse, ECDHPackage } from '@/types/index.js'
import { get_member_indexes } from '@/lib/util.js'

export function ecdh_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<ECDHPackage>
) {
  const { members, ecdh_pk } = msg.data
  // TODO: Verify ECDH request.
  const pkg = node.signer.gen_ecdh_share(members, ecdh_pk)
  node.client.publish({
    data : JSON.stringify(pkg),
    id   : msg.id,
    tag  : '/ecdh/res'
  }, msg.env.pubkey)
}

export function ecdh_request_api (node : BifrostNode) {
  return async (
    peers   : string[],
    ecdh_pk : string
  ) : Promise<ApiResponse<string>> => {
    try {
      // Check if we have the shared secret in cache.
      const encrypted = node.cache.ecdh.get(ecdh_pk)
      // If the cache has a secret:
      if (encrypted !== undefined) {
        // Return the decrypted secret.
        return { ok: true, data: node.signer.unwrap(encrypted, ecdh_pk) }
      }
      // Generate an ECDH request package.
      const members = get_member_indexes(node.group, [ node.pubkey, ...peers ])
      const pkg     = node.signer.gen_ecdh_share(members, ecdh_pk)
      // Serialize the package as a string.
      const msg  = { data : JSON.stringify(pkg), tag : '/ecdh/req' }
      // Send a request to the peer nodes.
      const res  = await node.client.multicast(msg, peers)
      // Return early if the response fails.
      if (!res.sub.ok) {
        return { ok : false, err : res.sub.reason }
      }
      // Initialize the list of response packages.
      const pkgs = [ pkg ]
      // Parse the response packages.
      res.sub.inbox.forEach(e => {
        const parsed = parse_ecdh_message(e)
        Assert.ok(parsed !== null, 'invalid ecdh response from pubkey: ' + e.env.pubkey)
        pkgs.push(parsed.data)
      })
      // Derive the secret from the packages.
      const secret  = combine_ecdh_pkgs(pkgs)
      // Wrap the secret with encryption.
      const content = node.signer.wrap(secret, ecdh_pk)
      // Store the encrypted secret in cache.
      node.cache.ecdh.set(ecdh_pk, content)
      // Return the shared secret.
      return { ok : true, data : secret }
    } catch (err) {
      return { ok : false, err : parse_error(err) }
    }
  }
}
