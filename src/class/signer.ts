import { get_pubkey }          from '@cmdcode/frost/lib'
import { create_session_psig } from '@/lib/sign.js'
import { assert }              from '@/util/assert.js'

import {
  create_ecdh_pkg,
  get_commit_pkg
} from '@/lib/pkg.js'

import {
  decrypt_content,
  encrypt_content,
  get_event_id,
  get_shared_secret,
  Validate
} from '@cmdcode/nostr-p2p/lib'

import type { UnsignedEvent } from '@cmdcode/nostr-p2p'

import type {
  CommitPackage,
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignMessagePackage
} from '@/types/index.js'

interface SignerConfig {

}

const DEFAULT_CONFIG : SignerConfig = {

}

export default class ShareSigner /*implements ShareSignerAPI*/ {

  private readonly _conf   : SignerConfig
  private readonly _commit : CommitPackage
  private readonly _group  : GroupPackage
  private readonly _pubkey : string
  private readonly _share  : SharePackage 

  constructor (
    group_pkg : GroupPackage,
    share_pkg : SharePackage,
    options?  : SignerConfig
  ) {
    this._commit = get_commit_pkg(group_pkg, share_pkg.idx)
    this._conf   = { ...DEFAULT_CONFIG, ...options }
    this._group  = group_pkg
    this._share  = share_pkg
    this._pubkey = get_pubkey(this._share.seckey)
  }

  get commit () {
    return this._commit
  }

  get conf () {
    return this._conf
  }

  get group () {
    return this._group
  }

  get pubkey () {
    return this._pubkey.slice(2)
  }

  create_ecdh_pkg (
    members : number[],
    peer_pk : string
  ) : ECDHPackage {
    // Go through the ecdh share ceremony
    const pkg = create_ecdh_pkg(members, peer_pk, this._share)
    return { idx: pkg.idx, members, peer_pk, pubshare: pkg.pubkey }
  }

  psign_event (
    session : SessionPackage,
    event   : UnsignedEvent
  ) {
    // Verify schema.
    Validate.unsigned_event(event)
    // Generate event id.
    const id = get_event_id(event)
    // Assert that received event id is valid.
    assert.ok(id === event.id, 'event id failed validation check')
    // Return a partial signature package.
    return this.psign_msg(session, id)
  }

  psign_msg (
    session : SessionPackage,
    message : string,
    tweaks? : string[]
  ) : SignMessagePackage {
    const group = this._group
    const share = this._share
    const pkg   = create_session_psig(group, session, share, message, tweaks)
    return { ...pkg, message, session }
  }

  unwrap (
    content : string,
    pubkey  : string
  ) {
    const seckey = this._share.seckey
    const secret = get_shared_secret(seckey, pubkey)
    return decrypt_content(secret, content)
  }

  wrap (
    content : string,
    pubkey  : string
  ) {
    const seckey = this._share.seckey
    const secret = get_shared_secret(seckey, pubkey)
    return encrypt_content(secret, content)
  }

}
