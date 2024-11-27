import { z } from 'zod'

type Literal = z.infer<typeof literal>
type Json    = Literal | { [key : string] : Json } | Json[]

const big     = z.bigint(),
      bool    = z.boolean(),
      date    = z.date(),
      num     = z.number(),
      uint    = z.number().max(Number.MAX_SAFE_INTEGER),
      str     = z.string(),
      stamp   = z.number().min(500_000_000).max(Number.MAX_SAFE_INTEGER),
      any     = z.any()

const sats = z.bigint().max(100_000_000n * 21_000_000n)

const literal = z.union([
  z.string(), z.number(), z.boolean(), z.null()
])

const json : z.ZodType<Json> = z.lazy(() =>
  z.union([ literal, z.array(json), z.record(json) ])
)

const hex       = z.string().regex(/^[0-9a-fA-F]*$/).refine(e => e.length % 2 === 0)
const hex20     = hex.refine((e) => e.length === 40)
const hex32     = hex.refine((e) => e.length === 64)
const hex33     = hex.refine((e) => e.length === 66)
const hex64     = hex.refine((e) => e.length === 128)

const base58    = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/)
const base64    = z.string().regex(/^[a-zA-Z0-9+/]+={0,2}$/)
const base64url = z.string().regex(/^[a-zA-Z0-9\-_]+={0,2}$/)
const bech32    = z.string().regex(/^[a-z]+1[023456789acdefghjklmnpqrstuvwxyz]+$/)

export default {
  any,
  base58,
  base64,
  base64url,
  bech32,
  big,
  bool,
  date,
  hex20,
  hex32,
  hex33,
  hex64,
  hex,
  json,
  literal,
  num,
  sats,
  str,
  stamp,
  uint
}

