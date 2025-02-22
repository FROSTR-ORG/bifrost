import EventEmitter  from './emitter.js'
import BifrostSigner from './signer.js'

import { NostrNode }        from '@cmdcode/nostr-p2p'
import { parse_error }      from '@cmdcode/nostr-p2p/util'
import { convert_pubkey }   from '@/lib/crypto.js'
import { get_peer_pubkeys } from '@/lib/util.js'

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
  SharePackage,
} from '@/types/index.js'

import * as API from '@/api/index.js'

const NODE_CONFIG : () => BifrostNodeConfig = () => {
  return {
    blacklist  : [],
    debug      : false,
    middleware : {}
  }
}

export default class BifrostNode extends EventEmitter<BifrostNodeEvent> {

  private readonly _cache  : BifrostNodeCache
  private readonly _client : NostrNode
  private readonly _config : BifrostNodeConfig
  private readonly _peers  : string[]
  private readonly _signer : BifrostSigner

  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    relays   : string[],
    options? : Partial<BifrostNodeConfig>
  ) {
    super()
    this._cache  = { ecdh : new Map() }
    this._config = { ...NODE_CONFIG(), ...options }
    this._peers  = get_peer_pubkeys(group, share)
    this._signer = new BifrostSigner(group, share, options)

    this._client = new NostrNode(relays, share.seckey, {
      filter : { authors : this._peers }
    })

    this._client.on('message', (msg) => {
      if (this._filter(msg)) return
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
    const blist = this.config.blacklist
    if (blist.includes(msg.env.pubkey)) {
      return true
    } else {
      return false
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
    return this._peers
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
    return this.client.connect().then(() => this)
  }

  async close () : Promise<BifrostNode> {
    return this.client.close().then(() => this)
  }
}
