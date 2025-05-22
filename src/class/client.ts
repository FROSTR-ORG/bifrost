import { EventEmitter }  from './emitter.js'
import { BifrostSigner } from './signer.js'
import { SignerQueue }   from './queue.js'

import { NostrNode }      from '@cmdcode/nostr-p2p'
import { parse_error }    from '@cmdcode/nostr-p2p/util'
import { convert_pubkey } from '@/util/crypto.js'
import { now }            from '@/util/helpers.js'

import {
  parse_ecdh_message,
  parse_session_message
} from '@/lib/parse.js'

import {
  get_peer_pubkeys,
  get_recv_pubkeys
} from '@/lib/peer.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  BifrostNodeCache,
  BifrostNodeConfig,
  BifrostNodeEvent,
  BifrostNodeOptions,
  GroupPackage,
  PeerData,
  SharePackage,
} from '@/types/index.js'

import * as API from '@/api/index.js'
import Schema   from '@/schema/index.js'

const DEFAULT_CACHE : () => BifrostNodeCache = () => {
  return {
    ecdh : new Map()
  }
}

const DEFAULT_CONFIG : () => BifrostNodeConfig = () => {
  return {
    debug      : false,
    middleware : {},
    policies   : [],
    sign_ival  : 100
  }
}

export class BifrostNode extends EventEmitter<BifrostNodeEvent> {

  private readonly _cache  : BifrostNodeCache
  private readonly _client : NostrNode
  private readonly _config : BifrostNodeConfig
  private readonly _peers  : PeerData[]
  private readonly _queue  : SignerQueue
  private readonly _signer : BifrostSigner

  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    relays   : string[],
    options? : BifrostNodeOptions
  ) {
    super()
    this._cache  = get_node_cache(options?.cache)
    this._config = get_node_config(options)
    this._queue  = new SignerQueue(this)
    this._signer = new BifrostSigner(group, share, options)
    this._peers  = init_peer_data(this)

    const authors = [ ...get_peer_pubkeys(this.peers), this.pubkey ]

    this._client = new NostrNode(relays, share.seckey, { filter : { authors } })

    this._client.on('message', (msg) => {
      // Emit the message event.
      this.emit('message', msg)
      // Return early if the message is not allowed.
      if (!this._filter(msg)) return
      // Handle the message.
      try {
        switch (msg.tag) {
          case '/ping/req': {
            // Handle the request.
            API.ping_handler_api(this, msg)
            break
          }
          case '/ecdh/req': {
            // Parse the request message.
            const parsed = parse_ecdh_message(msg)
            // Handle the request.
            API.ecdh_handler_api(this, parsed)
            break
          }
          case '/sign/req': {
            // Parse the request message.
            const parsed = parse_session_message(msg)
            // Handle the request.
            API.sign_handler_api(this, parsed)
            break
          }
        }
      } catch (err) {
        this.emit('bounced', [ parse_error(err), msg ])
      }
    })
  }

  _filter (msg : SignedMessage) {
    const { pubkey } = msg.env
    // Allow echo requests.
    if (msg.tag === '/echo/req') return true
    // Disallow echo responses from self.
    if (pubkey === this.pubkey) return false
    // Allow ping requests.
    if (msg.tag === '/ping/req') return true
    // Get a list of authorized peers.
    const recv_pks = get_recv_pubkeys(this.peers)
    // Check if the message is authorized.
    if (!recv_pks.includes(msg.env.pubkey)) {
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

  get queue () {
    return this._queue
  }

  get peers () {
    return this._peers
  }

  get pubkey () {
    return convert_pubkey(this.signer.pubkey, 'bip340')
  }

  get req () {
    return {
      ecdh  : API.ecdh_request_api(this),
      echo  : API.echo_request_api(this),
      ping  : API.ping_request_api(this),
      queue : API.sign_queue_api(this),
      sign  : API.sign_request_api(this)
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

  update_peer (data : PeerData) {
    const idx = this.peers.findIndex(e => e.pubkey === data.pubkey)
    if (idx === -1) return
    this._peers[idx] = { ...this._peers[idx], ...data }
  }
}

function get_node_cache (
  opt : Partial<BifrostNodeCache> = {}
) : BifrostNodeCache {
  return { ...DEFAULT_CACHE(), ...opt }
}

function get_node_config (
  opt : Partial<BifrostNodeConfig> = {}
) : BifrostNodeConfig {
  const config = { ...DEFAULT_CONFIG(), ...opt }
  const parsed = Schema.node.config.safeParse(config)
  if (!parsed.success) throw new Error('invalid node config')
  return parsed.data as BifrostNodeConfig
}

function init_peer_data (
  node : BifrostNode
) : PeerData[] {
  // Get the current time.
  const current = now()
  // Get the pubkey of the node.
  const node_pk = node.pubkey
  // Get the peers of the group.
  const peers_pks = node.group.commits
    .map(e => convert_pubkey(e.pubkey, 'bip340'))
    .filter(e => e !== node_pk)
  // Define a list of policies.
  let peer_data : PeerData[] = []
  // For each peer, configure a policy.
  for (const peer_pk of peers_pks) {
    // Check if the policy is configured.
    const config = node.config.policies.find(e => e.pubkey === peer_pk)
    // If the policy is not configured, set the default policy.
    const policy = config?.policy ?? { send : true, recv : true }
    // Add the peer data to the list.
    peer_data.push({
      // TODO: We should not default these to true.
      policy  : policy,
      pubkey  : peer_pk,
      status  : 'offline',
      updated : current
    })
  }
  // Return the list of policies.
  return peer_data
} 
