import { BifrostNode }         from '@/class/client.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'
import { get_expired_pubkeys } from '@/lib/peer.js'

import { Assert, copy_obj, now, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  PeerConfig,
  PeerPolicy
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

  return async () : Promise<ApiResponse<PeerConfig[]>> => {

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
      // Get the current time.
      const current = now()
      // Parse the response.
      const configs = parse_ping_response(msgs)
      // Update the peer state.
      for (const config of configs) {
        const peer_data = node.peers.find(e => e.pubkey === config.pubkey)
        Assert.exists(peer_data, 'peer data not found')
        node.update_peer({
          ...peer_data,
          policy  : { send : config.send, recv : config.recv },
          status  : 'online',
          updated : current
        })
      }
      // Emit the pong event.
      node.emit('/ping/sender/ret', configs)
      // Return the pong event.
      return { ok : true, data : configs }
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
  // Get the expired peer pubkeys.
  const expired_pks = get_expired_pubkeys(node.peers)
  // Send a request to the peer nodes.
  const res = await node.client.multicast({
    data : 'ping',
    tag  : '/ping/req'
  }, expired_pks)
  // If the response is not ok, throw an error.
  if (!res.sub.ok && res.sub.inbox.length === 0) throw new Error(res.sub.reason)
  // Return the responses.
  return res.sub.inbox
}

function parse_ping_response (msgs : SignedMessage<string>[]) : PeerConfig[] {
  return msgs.map(e => {
    const policy = JSON.parse(e.data) as PeerPolicy
    const pubkey = e.env.pubkey
    return { pubkey, ...policy }
  })
}
