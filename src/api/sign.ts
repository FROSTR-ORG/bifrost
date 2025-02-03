import BifrostNode from '@/class/client.js'

import { parse_error }        from '@cmdcode/nostr-p2p/util'
import { parse_psig_message } from '@/lib/parse.js'
import { create_session_pkg } from '@/lib/session.js'
import { combine_psig_pkgs }  from '@/lib/sign.js'

import type { SignedMessage }    from '@cmdcode/nostr-p2p' 
import type { ApiResponse, SignaturePackage } from '@/types/index.js'

export function sign_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<SignaturePackage>
) {
  const pkg = node.signer.sign_session(msg.data)
  node.client.publish({
    data : JSON.stringify(pkg),
    id   : msg.id,
    tag  : '/sign/res'
  }, msg.env.pubkey)
}

export function sign_request_api (node : BifrostNode) {
  return async (
    message : string,
    peers   : string[],
    stamp?  : number
  ) : Promise<ApiResponse<string>> => {
    try {
      // Generate a signed event request (includes psig and sid).
      const members = [ ...peers, node.client.pubkey ]
      const session = create_session_pkg(node.group, members, message, stamp)
      const pkg     = node.signer.sign_session(session)
      // Send this request to other nodes, and await their response.
      console.log('pkg:', pkg)
      const res = await node.client.multicast({
        data : JSON.stringify(pkg),
        tag  : '/sign/req'
      }, peers)
      // If the response fails, return early.
      if (!res.sub.ok) throw new Error('failed to collect signatures')
      const psigs = res.sub.inbox.map(e => parse_psig_message(e).data)
      // Aggregate responses and extract the signature.
      console.log('psigs:', psigs)
      const sig   = combine_psig_pkgs(node.group, psigs)
      // Return the signature.
      return { ok : true, data : sig }
    } catch (err) {
      return { ok : false, err : parse_error(err) }
    }
  }
}
