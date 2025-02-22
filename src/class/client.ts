import EventEmitter  from './emitter.js'
import BifrostSigner from './signer.js'

import { NostrNode }      from '@cmdcode/nostr-p2p'
import { parse_error }    from '@cmdcode/nostr-p2p/util'
import { convert_pubkey } from '@/lib/crypto.js'

import {
  parse_ecdh_message,
  parse_session_message
} from '@/lib/parse.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  BifrostNodeCache,
  BifrostNodeConfig,
  BifrostNodeEvent,
  GroupPackage,
  PeerPolicy,
  SharePackage,
} from '@/types/index.js'

import * as API from '@/api/index.js'

const NODE_CONFIG : () => BifrostNodeConfig = () => {
  return {
    debug      : false,
    middleware : {},
    policies   : []
  }
}

export default class BifrostNode extends EventEmitter<BifrostNodeEvent> {

  private readonly _cache  : BifrostNodeCache
  private readonly _client : NostrNode
  private readonly _config : BifrostNodeConfig
  private readonly _peers  : PeerPolicy[]
  private readonly _signer : BifrostSigner

  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    relays   : string[],
    options? : Partial<BifrostNodeConfig>
  ) {
    super()
    this._cache  = get_node_cache(options)
    this._config = get_node_config(options)
    this._signer = new BifrostSigner(group, share, options)
    this._peers  = get_peer_policies(this)

    this._client = new NostrNode(relays, share.seckey, {
      filter : { authors : this.peers.all }
    })

    this._client.on('message', (msg) => {
      // Emit the message event.
      this.emit('message', msg)
      // Return early if the message is not allowed.
      if (!this._filter(msg)) return
      // Handle the message.
      try {
        switch (msg.tag) {
          case '/ecdh/req': {
            // Parse the request message.
            const parsed = parse_ecdh_message(msg)
            // Handle the request.
            API.ecdh_handler_api(this, parsed)
          }
          case '/sign/req': {
            // Parse the request message.
            const parsed = parse_session_message(msg)
            // Handle the request.
            API.sign_handler_api(this, parsed)
          }
        }
      } catch (err) {
        this.emit('bounced', [ parse_error(err), msg ])
      }
    })
  }

  _filter (msg : SignedMessage) {
    if (!this.peers.recv.includes(msg.env.pubkey)) {
      this.emit('bounced', [ 'unauthorized', msg ])
      return false
    } else {
      return true
    }
  }

  get cache () {
    return this._cache
  }

  get client () {
    return this._client
  }

  get config () {
    return this._config
  }

  get debug () {
    return this._config.debug
  }

  get group () {
    return this._signer.group
  }

  get peers () {
    return {
      all   : this._peers.map(e => e[0]),
      send  : this._peers.filter(e => e[1]).map(e => e[0]),
      recv  : this._peers.filter(e => e[2]).map(e => e[0])
    }
  }

  get pubkey () {
    return convert_pubkey(this.signer.pubkey, 'bip340')
  }

  get req () {
    return {
      ecdh : API.ecdh_request_api(this),
      sign : API.sign_request_api(this)
    }
  }

  get signer () {
    return this._signer
  }

  async connect () : Promise<BifrostNode> {
    await this.client.connect()
    this.emit('ready', this)
    return this
  }

  async close () : Promise<BifrostNode> {
    await this.client.close()
    this.emit('closed', this)
    return this
  }
}

function get_node_config (
  opt : Partial<BifrostNodeConfig> = {}
) : BifrostNodeConfig {
  return { ...NODE_CONFIG(), ...opt }
}

function get_node_cache (
  opt : Partial<BifrostNodeConfig> = {}
) : BifrostNodeCache {
  return {
    ecdh : opt.cache?.ecdh ?? new Map()
  }
}

function get_peer_policies (node : BifrostNode) : PeerPolicy[] {
  // Get the pubkey of the node.
  const pubkey = node.pubkey
  // Get the peers of the group.
  const peers  = node.group.commits
    .map(e => convert_pubkey(e.pubkey, 'bip340'))
    .filter(e => e !== pubkey)
  // Define a list of policies.
  let policies : PeerPolicy[] = []
  // For each peer, configure a policy.
  for (const peer of peers) {
    // Check if the policy is configured.
    const config = node.config.policies.find(e => e[0] === peer)
    // If the policy is not configured, set the default policy.
    policies.push(config ?? [ peer, true, true ])
  }
  // Return the list of policies.
  return policies
}
