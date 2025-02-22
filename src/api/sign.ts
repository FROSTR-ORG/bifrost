import BifrostNode from '@/class/client.js'

import { finalize_message }   from '@cmdcode/nostr-p2p/lib'
import { parse_psig_message } from '@/lib/parse.js'
import { get_member_indexes, select_random_peers } from '@/lib/util.js'

import { Assert, copy_obj, now, parse_error } from '@/util/index.js'

import {
  create_session_pkg,
  get_session_ctx
} from '@/lib/session.js'

import {
  combine_signature_pkgs,
  verify_psig_pkg
} from '@/lib/sign.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  SessionPackage,
  SignaturePackage,
  SignRequestConfig
} from '@/types/index.js'

const SIGN_REQ_CONFIG : (node : BifrostNode) => SignRequestConfig = (node) => {
  return {
    peers  : node.peers.send,
    stamp  : now(),
    tweaks : []
  }
}

export async function sign_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<SessionPackage>
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

export function sign_request_api (node : BifrostNode) {
  return async (
    message : string,
    options : Partial<SignRequestConfig> = {}
  ) : Promise<ApiResponse<string>> => {
    //
    const config   = { ...SIGN_REQ_CONFIG(node), ...options }
    // Get the threshold for the group.
    const thold    = node.group.threshold
    // Randomly select peers.
    const selected = select_random_peers(config.peers ??= node.peers.send, thold)
    // Get the indexes of the members.
    const members  = get_member_indexes(node.group, [ node.pubkey, ...selected ])
    // Create the session package.
    const session  = create_session_pkg(node.group, members, message, config.stamp)
    // Initialize the list of response packages.
    let msgs : SignedMessage<SignaturePackage>[] | null = null

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
      const sig = finalize_sign_response(node, msgs, session, config.tweaks)
      // Emit the response.
      node.emit('/sign/sender/sig', [ sig, msgs ])
      // Return the signature.
      return { ok : true, data :sig }
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

async function create_sign_request (
  node    : BifrostNode,
  peers   : string[],
  session : SessionPackage
) : Promise<SignedMessage<SignaturePackage>[]> {
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

function finalize_sign_response (
  node      : BifrostNode,
  responses : SignedMessage<SignaturePackage>[],
  session   : SessionPackage,
  tweaks    : string[]
) : string {
  // Initialize the list of response packages.
  const ctx   = get_session_ctx(node.group, session, tweaks)
  const psig  = node.signer.sign_session(session, tweaks)
  const psigs = [ psig ]
  // Parse the response packages.
  responses.forEach(e => {
    const parsed   = parse_psig_message(e)
    Assert.ok(parsed.data.sid === session.sid, 'invalid session id from pubkey: ' + e.env.pubkey)
    const psig_err = verify_psig_pkg(ctx, parsed.data)
    Assert.ok(psig_err === null, psig_err + ' : ' + e.env.pubkey)
    psigs.push(parsed.data)
  })
  // Return the aggregate signature.
  return combine_signature_pkgs(ctx, psigs)
}
