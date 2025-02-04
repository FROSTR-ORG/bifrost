import { Buff }       from "@cmdcode/buff"
import { get_pubkey } from "@cmdcode/frost/lib"
import { gen_seckey } from "@cmdcode/nostr-p2p/lib"

import { tweak_pubnonce, tweak_secnonce } from "@/lib/crypto.js"

const seed   = Buff.str('alice').digest.hex
const tweak  = gen_seckey(Buff.str('tweak').digest.hex)
const snonce = gen_seckey(seed)
const pnonce = get_pubkey(seed)

console.log('seed:', seed)
console.log('tweak:', tweak)
console.log('snonce:', snonce)
console.log('pnonce:', pnonce)

const tweaked_sn = tweak_secnonce(snonce, tweak)
const tweaked_pn = tweak_pubnonce(pnonce, tweak)
const target_pn  = get_pubkey(tweaked_sn)

console.log('tweaked_sn:', tweaked_sn)
console.log('tweaked_pn:', tweaked_pn)
console.log('target_pn:', target_pn)
