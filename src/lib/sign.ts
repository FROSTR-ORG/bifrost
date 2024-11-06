import { sign_msg }        from '@cmdcode/frost/lib'
import { get_group_ctx }   from '@/lib/ctx.js'
import { create_psig_pkg } from '@/lib/pkg.js'

import type {
  GroupPackage,
  SharePackage
} from '@/types/index.js'

export function sign_event () {

}

export function sign_message (
  group   : GroupPackage,
  share   : SharePackage,
  message : string,
  tweaks? : string[]
) {
  const { idx, binder_sn, hidden_sn, share_sk } = share
  const ctx  = get_group_ctx(group, message, tweaks)
  const secshare = { idx, seckey: share_sk }
  const secnonce = { idx, binder_sn, hidden_sn }
  const psig = sign_msg(ctx, secshare, secnonce)
  return create_psig_pkg(psig)
}
