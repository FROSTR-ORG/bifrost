import { BifrostNode }         from '@/class/client.js'
import { BifrostConnect }      from '@/class/connect.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'

import { Assert, copy_obj, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ApiResponse,
  GroupPackage
} from '@/types/index.js'

import Schema from '@/schema/index.js'

export async function join_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<string>
) {
  // Try to parse the message.
  try {
    // Emit the request message.
    node.emit('/join/handler/req', msg)
    // Parse the request challenge.
    const challenge = msg.data
    // Finalize the response package.
    const envelope = finalize_message({
      data : JSON.stringify(node.group),
      id   : msg.id,
      tag  : '/join/res'
    })
    // Publish the response package.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/join/handler/res', copy_obj(res.data))
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/join/handler/rej', [ parse_error(err), copy_obj(msg) ])
  }
}

export function join_request_api (
  connect   : BifrostConnect,
  pubkey    : string,
  challenge : string
) {

  return async () : Promise<ApiResponse<GroupPackage>> => {

    let msgs : SignedMessage<string>[] | null = null

    try {
      // Send the request to the peers.
      msgs = await create_join_request(connect, pubkey, challenge)
      // Emit the response.
      connect.emit('/join/sender/res', copy_obj(msgs))
    } catch (err) {
      // Log the error.
      if (connect.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      connect.emit('/join/sender/rej', [ reason, copy_obj(msgs ?? []) ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msgs !== null && msgs.length > 0, 'no responses from peers')
      // Parse the response.
      const parsed = parse_join_response(msgs[0])
      // Emit the pong event.
      connect.emit('/join/sender/ret', parsed)
      // Return the pong event.
      return { ok : true, data : parsed }
    } catch (err) {
      // Log the error.
      if (connect.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      connect.emit('/join/sender/err', [ reason, copy_obj(msgs ?? []) ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

async function create_join_request (
  connect   : BifrostConnect,
  pubkey    : string,
  challenge : string
) : Promise<SignedMessage<string>[]> {
  // Send a request to the peer nodes.
  const res = await connect.client.request({
    data : challenge,
    id   : challenge,
    tag  : '/join/req'
  }, pubkey, {})
  // If the response is not ok, throw an error.
  if (!res.ok) throw new Error(res.reason)
  // Return the responses.
  return res.inbox
}

function parse_join_response (msg : SignedMessage<string>) : GroupPackage {
  // Deserialize the response.
  const json   = JSON.parse(msg.data)
  // Parse the response.
  const parsed = Schema.pkg.group.safeParse(json)
  // Assert the response is valid.
  Assert.ok(parsed.success, 'invalid group package')
  // Return the response.
  return parsed.data
}
