import type { BifrostConnect } from '@/class/connect.js'
import type { SignedMessage }  from '@cmdcode/nostr-p2p'

export interface BifrostConnectConfig {
  debug : boolean
}

export interface BifrostConnectEvent {
  '*'                 : [ string, unknown ]
  'info'              : unknown
  'debug'             : unknown
  'error'             : unknown
  'ready'             : BifrostConnect
  'closed'            : BifrostConnect
  '/join/sender/req'  : SignedMessage
  '/join/sender/res'  : SignedMessage[]
  '/join/sender/rej'  : [ string, SignedMessage[] ]
  '/join/sender/ret'  : [ string, string          ]
  '/join/sender/err'  : [ string, SignedMessage[] ]
}
