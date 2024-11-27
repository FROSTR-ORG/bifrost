import { Buff }   from '@cmdcode/buff'
import { assert } from '@/util/index.js'

import type {
  CommitPackage
} from '@/types/index.js'

export function serialize_commit_pkg (
  pkg : CommitPackage
) : Uint8Array {
  const idx = Buff.num(pkg.idx, 4)
  const spk = Buff.hex(pkg.pubkey,    33)
  const bpn = Buff.hex(pkg.binder_pn, 33)
  const hpn = Buff.hex(pkg.hidden_pn, 33)
  return Buff.join([ idx, spk, bpn, hpn ])
}

export function deserialize_commit_pkg (
  data : Uint8Array
) : CommitPackage {
  const stream    = new Buff(data).stream
  assert.size(stream.data, 103)
  const idx       = stream.read(4).num
  const pubkey    = stream.read(33).hex
  const binder_pn = stream.read(33).hex
  const hidden_pn = stream.read(33).hex
  assert.size(stream.data, 0)
  return { idx, binder_pn, hidden_pn, pubkey }
}
