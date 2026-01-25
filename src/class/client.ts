import { EventEmitter }              from './emitter.js'
import { BifrostSigner }             from './signer.js'
import { SignBatcher, ECDHBatcher }  from './batcher.js'
import { NoncePool }                 from './pool.js'

import { NostrNode }      from '@vbyte/nostr-sdk'
import { parse_error }    from '@vbyte/nostr-sdk/lib'
import { convert_pubkey } from '@/util/crypto.js'
import { now }            from '@/util/helpers.js'

import {
  parse_ecdh_message,
  parse_session_message,
  parse_onboard_message
} from '@/lib/parse.js'

import {
  get_peer_pubkeys,
  get_recv_pubkeys
} from '@/lib/peer.js'

import type { RpcMessageData } from '@vbyte/nostr-sdk'

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

/**
 * Creates the default cache object for a BifrostNode.
 * @returns A new BifrostNodeCache with an empty ECDH map.
 */
const DEFAULT_CACHE : () => BifrostNodeCache = () => {
  return {
    ecdh : new Map()
  }
}

/**
 * Creates the default configuration object for a BifrostNode.
 * @returns A new BifrostNodeConfig with default values.
 */
const DEFAULT_CONFIG : () => BifrostNodeConfig = () => {
  return {
    debug      : false,
    middleware : {},
    policies   : [],
    sign_interval  : 100,
    ecdh_interval  : 100,
    nonce_pool : {},
    sdk_config : {
      msg_timeout : 15000,  // 15s (SDK default is 5s)
      sub_timeout : 30000   // 30s (SDK default is 30s)
    }
  }
}

/**
 * BifrostNode is the main entry point for the FROSTR protocol.
 *
 * It orchestrates threshold signing and ECDH operations by managing peer
 * connections via Nostr relays, handling incoming requests, and coordinating
 * cryptographic operations through the BifrostSigner.
 *
 * Lifecycle:
 * 1. Create a node with group credentials, share package, and relay URLs
 * 2. Call `connect()` to establish relay connections
 * 3. Use `req.sign()`, `req.ecdh()`, etc. to perform cryptographic operations
 * 4. Call `close()` to disconnect from relays
 *
 * @example
 * ```typescript
 * const node = new BifrostNode(groupPkg, sharePkg, ['wss://relay.example.com'])
 * await node.connect()
 * node.on('ready', async () => {
 *   const result = await node.req.sign('message-to-sign')
 * })
 * ```
 *
 * @extends EventEmitter<BifrostNodeEvent>
 */
export class BifrostNode extends EventEmitter<BifrostNodeEvent> {

  /** Cache for storing ECDH shared secrets. */
  private readonly _cache  : BifrostNodeCache
  /** Underlying Nostr P2P client for relay communication. */
  private readonly _client : NostrNode
  /** Node configuration options. */
  private readonly _config : BifrostNodeConfig
  /** List of peer data including pubkeys, policies, and status. */
  private readonly _peers  : PeerData[]
  /** Nonce pool for managing dynamic nonces. */
  private readonly _pool         : NoncePool
  /** Batcher for signature requests. */
  private readonly _sign_batcher : SignBatcher
  /** Batcher for ECDH requests. */
  private readonly _ecdh_batcher : ECDHBatcher
  /** Signer instance for cryptographic operations. */
  private readonly _signer       : BifrostSigner

  /** Whether the node is connected and ready to process requests. */
  private _is_ready : boolean = false

  /**
   * Creates a new BifrostNode instance.
   *
   * @param group - The group package containing the group public key and member commitments.
   * @param share - The share package containing this node's secret share and index.
   * @param relays - Array of Nostr relay WebSocket URLs to connect to.
   * @param options - Optional configuration options for the node.
   */
  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    relays   : string[],
    options? : BifrostNodeOptions
  ) {
    super()
    this._cache        = get_node_cache(options?.cache)
    this._config       = get_node_config(options)
    this._sign_batcher = new SignBatcher(this)
    this._ecdh_batcher = new ECDHBatcher(this)
    this._signer       = new BifrostSigner(group, share, options)
    this._peers  = init_peer_data(this)
    this._pool   = new NoncePool(share.idx, share.seckey, this._config.nonce_pool)

    // Initialize nonce pools for all peers
    this._pool.init_peers(group.members)

    const peer_pks = get_peer_pubkeys(this.peers)
    // Include self for echo support (self-messaging)
    const self_pk  = convert_pubkey(this._signer.pubkey, 'bip340')
    const all_pks  = [ ...peer_pks, self_pk ]

    this._client = new NostrNode(all_pks, relays, share.seckey, this._config.sdk_config)

    this._client.on('closed', () => {
      this._is_ready = false
      this.emit('closed', this)
    })

    this._client.on('ready', () => {
      this._is_ready = true
      this.emit('ready', this)
    })

    this._client.on('message', (msg) => {
      // Emit the message event.
      this.emit('message', msg)
      // Return early if the message is not allowed.
      if (!this._filter(msg)) return
      // Only handle request messages
      if (msg.type !== 'request') return
      // Handle the message based on method.
      try {
        switch (msg.method) {
          case 'ping': {
            // Handle the request.
            API.ping_handler_api(this, msg)
            break
          }
          case 'echo': {
            // Handle the request.
            API.echo_handler_api(this, msg)
            break
          }
          case 'ecdh': {
            // Parse the request message.
            const parsed = parse_ecdh_message(msg)
            // Handle the request.
            API.ecdh_handler_api(this, parsed)
            break
          }
          case 'onboard': {
            // Parse the request message.
            const parsed = parse_onboard_message(msg)
            // Handle the request.
            API.onboard_handler_api(this, parsed)
            break
          }
          case 'sign': {
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

  /**
   * Filters incoming messages based on authorization rules.
   *
   * Authorization logic:
   * - Echo requests are always allowed (for self-testing)
   * - Messages from self (except echo) are disallowed
   * - Ping requests are always allowed (for peer discovery)
   * - Other messages must come from authorized peers with recv policy enabled
   *
   * @param msg - The RPC message to filter.
   * @returns True if the message should be processed, false otherwise.
   * @internal
   */
  _filter (msg : RpcMessageData) {
    const { pubkey } = msg.event
    // Only filter request messages (they have a method field)
    if (msg.type !== 'request') return true
    // Allow echo requests.
    if (msg.method === 'echo') return true
    // Disallow echo responses from self.
    if (pubkey === this.pubkey) return false
    // Allow ping requests.
    if (msg.method === 'ping') return true
    // Get a list of authorized peers.
    const recv_pks = get_recv_pubkeys(this.peers)
    // Check if the message is authorized.
    if (!recv_pks.includes(pubkey)) {
      this.emit('bounced', [ 'unauthorized', msg ])
      return false
    } else {
      return true
    }
  }

  /**
   * Gets the node's cache containing ECDH shared secrets.
   * @returns The cache object with ECDH secret mappings.
   */
  get cache () {
    return this._cache
  }

  /**
   * Gets the underlying Nostr P2P client.
   * @returns The NostrNode instance used for relay communication.
   */
  get client () {
    return this._client
  }

  /**
   * Gets the node configuration.
   * @returns The configuration object containing debug mode, middleware, policies, and sign interval.
   */
  get config () {
    return this._config
  }

  /**
   * Gets whether debug mode is enabled.
   * @returns True if debug logging is enabled.
   */
  get debug () {
    return this._config.debug
  }

  /**
   * Gets the group package containing group public key and member commitments.
   * @returns The GroupPackage for this signing group.
   */
  get group () {
    return this._signer.group
  }

  /**
   * Gets whether the node is connected and ready to process requests.
   * @returns True if the node is connected to relays and ready.
   */
  get is_ready () {
    return this._is_ready
  }

  /**
   * Gets the signature batcher for batch processing.
   * @returns The SignBatcher instance.
   * @internal
   */
  get sign_batcher () {
    return this._sign_batcher
  }

  /**
   * Gets the ECDH batcher for batch processing.
   * @returns The ECDHBatcher instance.
   * @internal
   */
  get ecdh_batcher () {
    return this._ecdh_batcher
  }

  /**
   * Gets the list of peer data for all group members (excluding self).
   * @returns Array of PeerData objects with pubkey, policy, and status.
   */
  get peers () {
    return this._peers
  }

  /**
   * Gets the nonce pool for managing dynamic nonces.
   * @returns The NoncePool instance.
   */
  get pool () {
    return this._pool
  }

  /**
   * Gets this node's public key in BIP-340 format.
   * @returns The 32-byte hex-encoded public key.
   */
  get pubkey () {
    return convert_pubkey(this.signer.pubkey, 'bip340')
  }

  /**
   * Gets the request API object for initiating operations.
   *
   * Available methods:
   * - `ecdh(pubkey)` - Perform threshold ECDH with a remote public key (uses batcher)
   * - `ecdh_batch(pubkeys)` - Perform threshold ECDH with multiple public keys
   * - `echo(challenge)` - Test self-messaging through relays
   * - `onboard(pubkey)` - Request onboarding from a peer
   * - `ping(pubkey)` - Check if a peer is online
   * - `sign(message)` - Request threshold signature for a single message (uses batcher)
   * - `sign_batch(messages)` - Request threshold signatures for multiple messages
   *
   * @returns Object containing request API methods.
   */
  get req () {
    return {
      ecdh       : API.ecdh_single_request_api(this),
      ecdh_batch : API.ecdh_batch_request_api(this),
      echo       : API.echo_request_api(this),
      onboard    : API.onboard_request_api(this),
      ping       : API.ping_request_api(this),
      sign       : API.sign_single_request_api(this),
      sign_batch : API.sign_batch_request_api(this)
    }
  }

  /**
   * Gets the BifrostSigner instance for cryptographic operations.
   * @returns The signer that handles signing and ECDH operations.
   */
  get signer () {
    return this._signer
  }

  /**
   * Connects to the configured Nostr relays.
   *
   * Emits 'ready' event when connected successfully.
   * Emits 'closed' event if connection is lost.
   *
   * @returns A promise that resolves when connection is initiated.
   */
  async connect () : Promise<void> {
    return this.client.connect()
  }

  /**
   * Closes connections to all Nostr relays and cleans up resources.
   *
   * This method:
   * 1. Closes the batchers (clearing timers and rejecting pending requests)
   * 2. Destroys the signer and pool to clear secrets from memory
   * 3. Removes event listeners from the underlying client
   * 4. Closes the underlying Nostr client
   *
   * Emits 'closed' event when disconnected.
   *
   * @returns A promise that resolves when close is initiated.
   */
  async close () : Promise<void> {
    // Close the batchers first to clear timers and reject pending requests
    this._sign_batcher.close()
    this._ecdh_batcher.close()

    // Destroy signer and pool to clear secrets from memory
    this._signer.destroy()
    this._pool.destroy()

    // Remove event listeners from the client to prevent memory leaks
    this._client.clear('closed')
    this._client.clear('ready')
    this._client.clear('message')

    // Close the underlying client
    void this.client.close()
  }

  /**
   * Updates a peer's data (status, policy, etc.).
   *
   * Used internally to track peer online/offline status after ping requests.
   * Can also be used to update peer policies dynamically.
   *
   * @param data - The peer data to update. Must include pubkey to identify the peer.
   */
  update_peer (data : PeerData) {
    const idx = this.peers.findIndex(e => e.pubkey === data.pubkey)
    if (idx === -1) return
    this._peers[idx] = { ...this._peers[idx], ...data }
  }
}

/**
 * Merges user-provided cache options with defaults.
 * @param opt - Partial cache options to merge.
 * @returns A complete BifrostNodeCache object.
 */
function get_node_cache (
  opt : Partial<BifrostNodeCache> = {}
) : BifrostNodeCache {
  return { ...DEFAULT_CACHE(), ...opt }
}

/**
 * Merges user-provided config options with defaults and validates the result.
 * @param opt - Partial config options to merge.
 * @returns A validated BifrostNodeConfig object.
 * @throws Error if the merged config fails validation.
 */
function get_node_config (
  opt : Partial<BifrostNodeConfig> = {}
) : BifrostNodeConfig {
  const config = { ...DEFAULT_CONFIG(), ...opt }
  const parsed = Schema.node.config.safeParse(config)
  if (!parsed.success) throw new Error('invalid node config')
  return parsed.data as BifrostNodeConfig
}

/**
 * Initializes peer data for all group members except self.
 *
 * Creates a PeerData entry for each group member with:
 * - Policy from config or default (send: true, recv: true)
 * - Status set to 'offline'
 * - Updated timestamp set to current time
 *
 * @param node - The BifrostNode to initialize peers for.
 * @returns Array of PeerData objects for all peers.
 */
function init_peer_data (
  node : BifrostNode
) : PeerData[] {
  // Get the current time.
  const current = now()
  // Get the pubkey of the node.
  const node_pk = node.pubkey
  // Get the peers of the group (using members instead of commits).
  const peers_pks = node.group.members
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
