import { get_pubkey }       from '@cmdcode/frost/lib'
import { create_ecdh_pkg }  from '@/lib/ecdh.js'
import { create_psig_pkg }  from '@/lib/sign.js'
import { normalize_pubkey } from '@/lib/util.js'

import {
  decrypt_content,
  encrypt_content,
  get_shared_secret
} from '@cmdcode/nostr-p2p/lib'

import type {
  BifrostSignerConfig,
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignaturePackage
} from '@/types/index.js'

const SIGNER_CONFIG : () => BifrostSignerConfig = () => {
  return {}
}

export default class BifrostSigner /*implements ShareSignerAPI*/ {

  private readonly _config : BifrostSignerConfig
  private readonly _group  : GroupPackage
  private readonly _pubkey : string
  private readonly _share  : SharePackage 

  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    options? : Partial<BifrostSignerConfig>
  ) {
    this._config = { ...SIGNER_CONFIG(), ...options }
    this._group  = group
    this._share  = share
    this._pubkey = get_pubkey(this._share.seckey)
  }

  get config () {
    return this._config
  }

  get group () {
    return this._group
  }

  get pubkey () {
    return normalize_pubkey(this._pubkey)
  }

  gen_ecdh_share (
    members : string[],
    pubkey  : string
  ) : ECDHPackage {
    // Go through the ecdh share ceremony
    return create_ecdh_pkg(this._group, members, pubkey, this._share)
  }

  sign_session (
    session : SessionPackage,
    tweaks? : string[]
  ) : SignaturePackage {
    return create_psig_pkg(this._group, session, this._share, tweaks)
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
