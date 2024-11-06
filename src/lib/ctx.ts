import { get_session_ctx } from '@cmdcode/frost/lib'

import type { GroupSessionCtx } from '@cmdcode/frost'
import type { GroupPackage }    from '@/types/index.js'

export function get_group_ctx (
  group   : GroupPackage,
  message : string,
  tweaks? : string[]
) : GroupSessionCtx {
  return get_session_ctx(group.pubkey, group.commits, message, tweaks)
}
