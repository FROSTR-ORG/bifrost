import { BifrostNode }         from '@/class/client.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'

import { Assert, copy_obj, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'
import type { ApiResponse }   from '@/types/index.js'

export async function ping_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<string>
) {
  // Try to parse the message.
  try {copy_obj
    // Emit the request message.
    node.emit('/ping/handler/req', msg)
    // Finalize the response package.
    const envelope = finalize_message({
      data : 'pong',
      id   : msg.id,
      tag  : '/ping/res'
    })
    // Publish the response package.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/ping/handler/res', copy_obj(res.data))
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/ping/handler/rej', [ parse_error(err), copy_obj(msg) ])
  }
}

export function ping_request_api (node : BifrostNode) {

  return async () : Promise<ApiResponse<string[]>> => {

    let msgs : SignedMessage<string>[] | null = null

    try {
      // Send the request to the peers.
      msgs = await create_ping_request(node)
      // Emit the response.
      node.emit('/ping/sender/res', copy_obj(msgs))
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ping/sender/rej', [ reason, copy_obj(msgs ?? []) ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msgs !== null, 'no responses from peers')
      const pubkeys = msgs.map(e => e.env.pubkey)
      // Emit the pong event.
      node.emit('/ping/sender/ret', pubkeys)
      // Return the pong event.
      return { ok : true, data : pubkeys }
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ping/sender/err', [ reason, copy_obj(msgs ?? []) ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

async function create_ping_request (node : BifrostNode) : Promise<SignedMessage<string>[]> {
  // Serialize the package as a string.
  const msg = { data : 'ping', tag : '/ping/req' }
  // Send a request to the peer nodes.
  const res = await node.client.multicast(msg, node.peers.all)
  // Return early if the response fails.
  if (!res.sub.ok) throw new Error(res.sub.reason)
  // Parse the response packages.
  res.sub.inbox.map(e => {
    Assert.ok(e.data === 'pong', 'invalid ping response from pubkey: ' + e.env.pubkey)
  })
  return res.sub.inbox
}
