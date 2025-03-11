import BifrostNode       from '@/class/client.js'

import type { SignedMessage }               from '@cmdcode/nostr-p2p'
import type { ECDHPackage, SignatureEntry, SignSessionPackage } from '@/types/index.js'

export interface BifrostNodeCache {
  ecdh : Map<string, string>
}

export type PeerPolicy = [
  pubkey : string,
  send   : boolean,
  recv   : boolean
]

export interface BifrostNodeConfig {
  cache?     : BifrostNodeCache
  debug      : boolean
  middleware : BifrostNodeMiddleware
  policies   : PeerPolicy[]
}

export interface BifrostNodeMiddleware {
  ecdh? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
  sign? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
}

export interface BifrostSignerConfig {

}

export interface BifrostNodeEvent {
  '*'                 : [ string, ...any[] ]
  'ready'             : BifrostNode
  'closed'            : BifrostNode
  'bounced'           : [ string, SignedMessage   ]
  'message'           : SignedMessage
  '/ecdh/sender/req'  : SignedMessage
  '/ecdh/sender/res'  : SignedMessage[]
  '/ecdh/sender/rej'  : [ string, ECDHPackage     ]
  '/ecdh/sender/ret'  : [ string, string          ]
  '/ecdh/sender/err'  : [ string, SignedMessage[] ]
  '/ecdh/handler/req' : SignedMessage
  '/ecdh/handler/res' : SignedMessage
  '/ecdh/handler/rej' : [ string, SignedMessage   ]
  '/sign/sender/req'  : SignedMessage
  '/sign/sender/res'  : SignedMessage[]
  '/sign/sender/rej'  : [ string, SignSessionPackage  ]
  '/sign/sender/ret'  : [ string, SignatureEntry[]    ]
  '/sign/sender/err'  : [ string, SignedMessage[]     ]
  '/sign/handler/req' : SignedMessage
  '/sign/handler/res' : SignedMessage
  '/sign/handler/rej' : [ string, SignedMessage   ]
}
