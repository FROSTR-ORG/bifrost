import {
  get_pubkey,
  get_session_member
} from '@frostr/bifrost/lib'

import type {
  SignSessionPackage,
  SharePackage
} from '@frostr/bifrost'

import type { Membership } from '@/test/types.js'

export function get_memberships (
  session : SignSessionPackage,
  shares  : SharePackage[]
) : Membership[] {
  return session.members.map(idx => {
    const share  = shares.find(e => e.idx === idx)
    if (!share) throw new Error('share not found for member: ' + idx)
    const mship     = get_session_member(session, share)
    const pubkey    = get_pubkey(mship.seckey, 'ecdsa')
    const hidden_pn = get_pubkey(mship.hidden_sn, 'ecdsa')
    const binder_pn = get_pubkey(mship.binder_sn, 'ecdsa')
    return { ...mship, pubkey, hidden_pn, binder_pn }
  })
}
