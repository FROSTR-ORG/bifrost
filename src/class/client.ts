import { NostrNode, TypedMessage } from '@cmdcode/nostr-p2p'
import { parse_message, Validate }                from '@cmdcode/nostr-p2p/lib'
import { get_member_indexes }      from '@/lib/util.js'
import { combine_session_psigs }   from '@/lib/sign.js'
import { derive_ecdh_secret }      from '@cmdcode/frost/lib'
import { create_session_pkg }      from '@/lib/session.js'
import { Parse, parse_data }              from '@/util/index.js'

import type {
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignMessagePackage
} from '@/types/index.js'

import Schema      from '@/schema/index.js'
import ShareSigner from './signer.js'
import { parse_ecdh_response } from '@/lib/parse.js'

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
      .map(e => e.pubkey.slice(2))
      .filter(e => e !== this.signer.pubkey)

    console.log('peers:', peer_pks)

    this._node   = new NostrNode(relays, share_pkg.seckey, { peer_pks })

    this.node.rpc.on('/req/ecdh', (msg) => {
      console.log('received msg:', msg.tag, msg.id)
      const schema = Schema.pkg.ecdh_pkg
      const parsed = parse_message(msg, schema)
      if (parsed !== null) {
        this._handle_ecdh_req(parsed)
      }
    })
  
    this.node.rpc.on('/req/sign/msg', (msg) => {
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
    const pkg = this.signer.create_ecdh_pkg(members, peer_pk)
    const tag = '/res/ecdh'
    this.node.send(tag, JSON.stringify(pkg), msg.ctx.pubkey, msg.id)
  }

  _handle_sign_msg_req (msg : TypedMessage<SignMessagePackage>) {
    const { session, message } = msg.dat
    const pkg = this.signer.psign_msg(session, message)
    const tag = '/res/msg/sign'
    this.node.send(tag, JSON.stringify(pkg), msg.ctx.pubkey, msg.id)
  }

  async connect () : Promise<void> {
    this.node.connect()
  }

  async req_ecdh (
    peers  : string[],
    pubkey : string
  ) {
    // We should have a map of encrypted blobs as a cache.
    const encrypted = this.cache.ecdh.get(pubkey)
    if (encrypted !== undefined) {
      return this.signer.unwrap(encrypted, pubkey)
    } else {
      const members = get_member_indexes(this.group, peers)
      const prs     = peers.map(e => e.slice(2))
      const pkg     = this.signer.create_ecdh_pkg(members, pubkey)
      const req     = JSON.stringify(pkg)
      const res     = await this.node.req('/req/ecdh', req, prs)
      if (!res.ok) return res
      const secret  = parse_ecdh_response(res.inbox)
      const content = this.signer.wrap(secret, pubkey)
      this.cache.ecdh.set(pubkey, content)
      return secret
    }
  }

  async sign_msg (
    peers    : string[],
    message  : string,
    session ?: SessionPackage
  ) {
    const members = get_member_indexes(this.group, peers)
    if (session === undefined) {
      session = create_session_pkg(this.group, members, message)
    }
    // Generate a signed event request (includes psig and sid).
    const psig = this.signer.psign_msg(session, message)
    const req  = JSON.stringify({ members, psig })
    // Send this request to other nodes, and await their response.
    const res = await this.node.req('/req/sign/msg', req, peers)
    //
    if (!res.ok) return res
    // Aggregate responses and extract the signature.
    const sig = combine_session_psigs(this.group, message, res.inbox, session)
    // Then return signature.
    return sig
  }
}
