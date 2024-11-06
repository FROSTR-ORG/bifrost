export interface EventTemplate {
  content    : string
  created_at : number
  kind       : number
  pubkey     : string
  tags       : string[][]
}

export interface SignedEvent extends EventTemplate {
  id  : string
  sig : string
}

export type MessageEnvelope = [
  event_tag  : string,
  message_id : string,
  payload    : string 
]

export interface EventMessage <T = string> {
  ctx : SignedEvent
  dat : T
  mid : string
  tag : string
}
