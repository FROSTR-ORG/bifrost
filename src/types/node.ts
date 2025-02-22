import { SignedMessage } from '@cmdcode/nostr-p2p'
import BifrostNode       from '@/class/client.js'
import { ECDHPackage, SessionPackage } from '@/index.js'

export interface BifrostNodeCache {
  ecdh : Map<string, string>
}

export interface BifrostNodeConfig {
  blacklist  : string[]
  debug      : boolean
  middleware : BifrostNodeMiddleware
}

export interface BifrostNodeMiddleware {
  ecdh? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
  sign? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
}

export interface BifrostSignerConfig {

}

export interface BifrostNodeEvent {
  'bounced'           : [ string, SignedMessage   ]
  '/ecdh/sender/req'  : SignedMessage
  '/ecdh/sender/res'  : SignedMessage[]
  '/ecdh/sender/rej'  : [ string, ECDHPackage     ]
  '/ecdh/sender/sec'  : [ string, ECDHPackage[]   ]
  '/ecdh/sender/err'  : [ string, SignedMessage[] ]
  '/ecdh/handler/req' : SignedMessage
  '/ecdh/handler/res' : SignedMessage
  '/ecdh/handler/rej' : [ string, SignedMessage   ]
  '/sign/sender/req'  : SignedMessage
  '/sign/sender/res'  : SignedMessage[]
  '/sign/sender/rej'  : [ string, SessionPackage  ]
  '/sign/sender/sig'  : [ string, SignedMessage[] ]
  '/sign/sender/err'  : [ string, SignedMessage[] ]
  '/sign/handler/req' : SignedMessage
  '/sign/handler/res' : SignedMessage
  '/sign/handler/rej' : [ string, SignedMessage   ]
}
