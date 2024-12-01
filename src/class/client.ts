import { NostrNode, TypedMessage } from '@cmdcode/nostr-p2p'
import { Validate }                from '@cmdcode/nostr-p2p/lib'
import { create_session_pkg }      from '@/lib/session.js'

import {
  combine_ecdh_pkgs,
  combine_psig_pkgs
} from '@/lib/pkg.js'

import {
  parse_ecdh_message, 
  parse_psig_message
} from '@/lib/parse.js'

import {
  get_member_indexes,
  normalize_pubkey
} from '@/lib/util.js'

import type {
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignMessagePackage
} from '@/types/index.js'

import Schema      from '@/schema/index.js'
import ShareSigner from './signer.js'

interface ClientConfig {

}

interface ClientCache {
  ecdh : Map<string, string>
}

const DEFAULT_CONFIG : ClientConfig = {

}

export default class FrostNode {

  private readonly _cache  : ClientCache
  private readonly _conf   : ClientConfig
  private readonly _group  : GroupPackage
  private readonly _node   : NostrNode
  private readonly _signer : ShareSigner

  constructor (
    relays    : string[],
    group_pkg : GroupPackage ,
    share_pkg : SharePackage,
    options?  : Partial<ClientConfig>
  ) {
    this._cache  = { ecdh : new Map() }
    this._conf   = { ...DEFAULT_CONFIG, ...options }
    this._group  = group_pkg
    this._signer = new ShareSigner(group_pkg, share_pkg, options)

    const peer_pks = group_pkg.commits
      .map(e => e.pubkey)
      .filter(e => e !== this.signer.pubkey)

    console.log('peers:', peer_pks)

    this._node = new NostrNode(relays, share_pkg.seckey, { peer_pks })

    this.node.rpc.on('/req/ecdh', (msg) => {
      console.log('received msg:', msg.tag, msg.id)
      const parsed = parse_ecdh_message(msg)
      this._handle_ecdh_req(parsed)
    })
  
    this.node.rpc.on('/req/sign', (msg) => {
      console.log(msg)
      if (Validate.message(msg, Schema.pkg.sign_msg_pkg)) {
        this._handle_sign_msg_req(msg)
      }
    })
  }

  get cache () {
    return this._cache
  }

  get conf () {
    return this._conf
  }

  get event () {
    return this.node.event
  }

  get group () {
    return this._group
  }

  get node () {
    return this._node
  }

  get peers () {
    return this.node.peers
  }

  get signer () {
    return this._signer
  }

  _handle_ecdh_req (msg : TypedMessage<ECDHPackage>) {
    const { members, peer_pk } = msg.dat
    // TODO: Verify ECDH request.
    console.log('handling ecdh req for peer pk:', peer_pk)
    const pkg = this.signer.gen_ecdh_pkg(members, peer_pk)
    const tag = '/res/ecdh'
    this.node.send(tag, JSON.stringify(pkg), msg.ctx.pubkey, msg.id)
  }

  _handle_sign_msg_req (msg : TypedMessage<SignMessagePackage>) {
    const { session, message } = msg.dat
    console.log('recv msg:', msg.dat)
    const pkg = this.signer.sign_msg(session, message)
    const tag = '/res/sign'
    this.node.send(tag, JSON.stringify(pkg), msg.ctx.pubkey, msg.id)
  }

  async connect () : Promise<void> {
    return new Promise(res => {
      this.node.event.once('init', () => res())
      this.node.connect()
    })
  }

  async req_ecdh (
    peers  : string[],
    pubkey : string
  ) {
    // TODO: Refactor FROST library so that we don't have to do this anymore.
    peers  = peers.map(e => normalize_pubkey(e))
    pubkey = normalize_pubkey(pubkey)
    // Check if we have the shared secret in cache.
    const encrypted = this.cache.ecdh.get(pubkey)
    // If the cache has a secret:
    if (encrypted !== undefined) {
      // Return the decrypted secret.
      return this.signer.unwrap(encrypted, pubkey)
    } else {
      // Get the member indices for each peer.
      const members = get_member_indexes(this.group, peers)
      // Generate an ECDH request package.
      const pkg     = this.signer.gen_ecdh_pkg(members, pubkey)
      // Serialize the package as a string.
      const req     = JSON.stringify(pkg)
      // Send a request to the peer nodes.
      const res     = await this.node.req('/req/ecdh', req, peers)
      // Return early if the response fails.
      if (!res.ok) return res
      // Parse the response packages.
      const pkgs    = res.inbox.map(e => parse_ecdh_message(e).dat)
      // Derive the secret from the packages.
      const secret  = combine_ecdh_pkgs(pkgs)
      // Wrap the secret with encryption.
      const content = this.signer.wrap(secret, pubkey)
      // Store the encrypted secret in cache.
      this.cache.ecdh.set(pubkey, content)
      // Return the shared secret.
      return secret
    }
  }

  async req_sig (
    peers    : string[],
    message  : string,
    session ?: SessionPackage
  ) {
    // Normalize the peer public keys.
    peers = peers.map(e => normalize_pubkey(e))
    // Get the member index for each peer.
    const members = get_member_indexes(this.group, peers)
    // If an existing signing session is not defined:
    if (session === undefined) {
      // Create a new signing session package.
      session = create_session_pkg(this.group, members, message)
    }
    // Generate a signed event request (includes psig and sid).
    const psig = this.signer.sign_msg(session, message)
    // Serialize the package into a string.
    const req  = JSON.stringify({ members, psig })
    // Send this request to other nodes, and await their response.
    const res = await this.node.req('/req/sign', req, peers)
    // If the response fails, return early.
    if (!res.ok) return res
    //
    const shares = res.inbox.map(e => parse_psig_message(e).dat)
    // Aggregate responses and extract the signature.
    return combine_psig_pkgs(this.group, message, shares, session)
  }
}
