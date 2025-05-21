import type { BifrostNode }   from '@/class/client.js'
import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ECDHPackage,
  PeerConfig,
  SighashVector,
  SignatureEntry,
  SignSessionPackage
} from '@/types/index.js'

export interface BifrostNodeCache {
  ecdh : Map<string, string>
}

export interface BifrostNodeConfig {
  cache?        : BifrostNodeCache
  debug         : boolean
  middleware    : BifrostNodeMiddleware
  policies      : PeerConfig[]
  sign_interval : number
}

export interface BifrostNodeMiddleware {
  ecdh? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
  sign? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
}

export interface SignRequest {
  sigvec  : SighashVector
  resolve : (result: any) => void
  reject  : (error: any)  => void
}

export interface BifrostNodeEvent {
  '*'                 : [ string, unknown ]
  'info'              : unknown
  'debug'             : unknown
  'error'             : unknown
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
  '/join/handler/req' : SignedMessage
  '/join/handler/res' : SignedMessage
  '/join/handler/rej' : [ string, SignedMessage   ]
  '/ping/handler/req' : SignedMessage
  '/ping/handler/res' : SignedMessage
  '/ping/handler/rej' : [ string, SignedMessage   ]
  '/ping/handler/ret' : [ string, string          ]
  '/ping/sender/req'  : SignedMessage
  '/ping/sender/res'  : SignedMessage[]
  '/ping/sender/rej'  : [ string, SignedMessage[] ]
  '/ping/sender/ret'  : PeerConfig[]
  '/ping/sender/err'  : [ string, SignedMessage[] ]
  '/sign/sender/req'  : SignedMessage
  '/sign/sender/res'  : SignedMessage[]
  '/sign/sender/rej'  : [ string, SignSessionPackage  ]
  '/sign/sender/ret'  : [ string, SignatureEntry[]    ]
  '/sign/sender/err'  : [ string, SignedMessage[]     ]
  '/sign/handler/req' : SignedMessage
  '/sign/handler/res' : SignedMessage
  '/sign/handler/rej' : [ string, SignedMessage   ]
}
