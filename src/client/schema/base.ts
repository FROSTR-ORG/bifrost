import { z } from 'zod'

const big     = z.bigint(),
      bool    = z.boolean(),
      date    = z.date(),
      num     = z.number(),
      uint    = z.number().max(Number.MAX_SAFE_INTEGER),
      str     = z.string(),
      stamp   = z.number().min(500_000_000).max(Number.MAX_SAFE_INTEGER),
      any     = z.any()

const hex = z.string()
  .regex(/^[0-9a-fA-F]*$/)
  .refine(e => e.length % 2 === 0)

const literal = z.union([ z.string(), z.number(), z.boolean(), z.null() ])

const hex16  = hex.refine((e) => e.length === 32)
const hex20  = hex.refine((e) => e.length === 40)
const hex32  = hex.refine((e) => e.length === 64)
const hex64  = hex.refine((e) => e.length === 128)
const pubkey = hex.refine((e) => e.length === 66)
const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/)
const base64 = z.string().regex(/^[a-zA-Z0-9+/]+={0,2}$/)
const b64url = z.string().regex(/^[a-zA-Z0-9\-_]+={0,2}$/)
const bech32 = z.string().regex(/^[a-z]+1[023456789acdefghjklmnpqrstuvwxyz]+$/)

export default {
  any,
  base58,
  base64,
  b64url,
  bech32,
  big,
  bool,
  date,
  hex32,
  hex16,
  hex20,
  hex64,
  hex,
  literal,
  num,
  pubkey,
  str,
  stamp,
  uint
}
