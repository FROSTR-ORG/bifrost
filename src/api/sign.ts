import { BifrostNode }        from '@/class/client.js'
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

export function sign_queue_api (node : BifrostNode) {
  return async (
    message : string | string[]
  ) : Promise<SignatureEntry> => {
    const sigvec = format_sigvector(message)
    return node.queue.push(sigvec)
  }
}

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
