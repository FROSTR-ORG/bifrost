import { EventEmitter }   from './emitter.js'
import { NostrNode }      from '@cmdcode/nostr-p2p'

import type {
  BifrostConnectConfig,
  BifrostConnectEvent,
} from '@/types/index.js'

import * as API from '@/api/index.js'
import { Assert } from '@/util/index.js'

const CONNECT_CONFIG : () => BifrostConnectConfig = () => {
  return {
    debug : false
  }
}

export class BifrostConnect extends EventEmitter<BifrostConnectEvent> {

  private readonly _client : NostrNode
  private readonly _config : BifrostConnectConfig

  constructor (
    relays   : string[],
    seckey   : string,
    options? : Partial<BifrostConnectConfig>
  ) {
    super()
    this._config = get_connect_config(options)
    this._client = new NostrNode(relays, seckey)
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

  async connect () : Promise<BifrostConnect> {
    await this.client.connect()
    this.emit('ready', this)
    return this
  }

  async close () : Promise<BifrostConnect> {
    await this.client.close()
    this.emit('closed', this)
    return this
  }

  async join (connect_str : string) {
    const params = new URLSearchParams(connect_str)
    const pk     = params.get('pk')
    const ch     = params.get('ch')
    Assert.ok(pk !== null && ch !== null, 'invalid connect string')
    return API.join_request_api(this, pk, ch)
  }
}

function get_connect_config (
  opt : Partial<BifrostConnectConfig> = {}
) : BifrostConnectConfig {
  return { ...CONNECT_CONFIG(), ...opt }
}