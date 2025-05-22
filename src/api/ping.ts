import { BifrostNode }         from '@/class/client.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'

import { Assert, copy_obj, now, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  PeerConfig,
  PeerPolicy,
  PeerStatus
} from '@/types/index.js'

export async function ping_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<string>
) {
  // Try to parse the message.
  try {
    // Emit the request message.
    node.emit('/ping/handler/req', msg)
    // Get the peer data.
    const peer_data = node.peers.find(e => e.pubkey === msg.env.pubkey)
    // If the peer data is not found, throw an error.
    if (peer_data === undefined) throw new Error('peer data not found')
    // Finalize the response package.
    const envelope = finalize_message({
      data : JSON.stringify(peer_data.policy),
      id   : msg.id,
      tag  : '/ping/res'
    })
    // Publish the response package.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Update the peer state.
    node.update_peer({
      ...peer_data,
      status  : 'online',
      updated : Date.now()
    })
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

  return async (pubkey : string) : Promise<ApiResponse<PeerConfig>> => {

    let msg : SignedMessage<string> | null = null

    try {
      // Send the request to the peers.
      msg = await create_ping_request(node, pubkey)
      // Emit the response.
      node.emit('/ping/sender/res', msg)
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ping/sender/rej', [ reason, msg ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msg !== null, 'no response from peer')
      // Get the current time.
      const current = now()
      // Parse the response.
      const policy  = parse_ping_response(msg)
      // Update the peer state.
      const peer_data = node.peers.find(e => e.pubkey === msg.env.pubkey)
      Assert.exists(peer_data, 'peer data not found')
      const new_data = {
        ...peer_data,
        policy,
        status  : 'online' as PeerStatus,
        updated : current
      }
      node.update_peer(new_data)
      // Emit the pong event.
      node.emit('/ping/sender/ret', new_data)
      // Return the pong event.
      return { ok : true, data : new_data }
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/ping/sender/err', [ reason, msg ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

async function create_ping_request (
  node   : BifrostNode,
  pubkey : string
) : Promise<SignedMessage<string>> {
  // Send a request to the peer nodes.
  const res = await node.client.request({
    data : 'ping',
    tag  : '/ping/req'
  }, pubkey, {})
  // If the response is not ok, throw an error.
  if (!res.ok) throw new Error(res.reason)
  // Return the response.
  return res.inbox[0]
}

function parse_ping_response (msg : SignedMessage<string>) : PeerPolicy {
  return JSON.parse(msg.data) as PeerPolicy
}
