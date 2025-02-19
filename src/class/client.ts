import BifrostSigner from './signer.js'

import { NostrNode }        from '@cmdcode/nostr-p2p'
import { parse_error }      from '@cmdcode/nostr-p2p/util'
import { normalize_pubkey } from '@/lib/crypto.js'
import { get_peer_pubkeys } from '@/lib/util.js'

import {
  parse_ecdh_message,
  parse_session_message
} from '@/lib/parse.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  BifrostNodeCache,
  BifrostNodeConfig,
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

import * as API from '@/api/index.js'

const NODE_CONFIG : () => BifrostNodeConfig = () => {
  return {
    blacklist : []
  }
}

export default class BifrostNode {

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
            const parsed = parse_ecdh_message(msg)
            return API.ecdh_handler_api(this, parsed)
          }
          case '/sign/req': {
            const parsed = parse_session_message(msg)
            return API.sign_handler_api(this, parsed)
          }
        }
      } catch (err) {
        this.client.emit('bounced', [ msg.env.id, parse_error(err) ])
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

  get group () {
    return this._signer.group
  }

  get peers () {
    return this._peers
  }

  get pubkey () {
    return normalize_pubkey(this.signer.pubkey, 'bip340')
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
