import BifrostNode from '@/class/client.js'

import { parse_error }        from '@cmdcode/nostr-p2p/util'
import { parse_psig_message } from '@/lib/parse.js'
import { get_member_indexes } from '@/lib/util.js'
import { Assert }             from '@/util/assert.js'

import {
  create_session_pkg,
  get_session_ctx
} from '@/lib/session.js'

import {
  combine_signature_pkgs,
  verify_signature_pkg
} from '@/lib/sign.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  SessionPackage
} from '@/types/index.js'

export function sign_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<SessionPackage>
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
    stamp?  : number,
    tweaks? : string[]
  ) : Promise<ApiResponse<string>> => {
    try {
      // Generate a signed event request (includes psig and sid).
      const members = get_member_indexes(node.group, [ node.pubkey, ...peers ])
      const session = create_session_pkg(node.group, members, message, stamp)
      const psig    = node.signer.sign_session(session, tweaks)
      // Send this request to other nodes, and await their response.
      const res = await node.client.multicast({
        data : JSON.stringify(session),
        tag  : '/sign/req'
      }, peers)
      // If the response fails, return early.
      if (!res.sub.ok) throw new Error('failed to collect signatures')
      // Initialize the list of response packages.
      const ctx   = get_session_ctx(node.group, session, tweaks)
      const psigs = [ psig ]
      // Parse the response packages.
      res.sub.inbox.forEach(e => {
        const parsed   = parse_psig_message(e)
        Assert.ok(parsed.data.sid === session.sid, 'invalid session id from pubkey: ' + e.env.pubkey)
        const psig_err = verify_signature_pkg(ctx, parsed.data)
        Assert.ok(psig_err === null, psig_err + ' : ' + e.env.pubkey)
        psigs.push(parsed.data)
      })
      // Combine the response packages and extract the signature.
      const sig = combine_signature_pkgs(ctx, psigs)
      // Return the signature.
      return { ok : true, data : sig }
    } catch (err) {
      return { ok : false, err : parse_error(err) }
    }
  }
}
