import { Buff } from '@cmdcode/buff'

import {
  get_event_id,
  is_recipient
} from './util.js'

import {
  decrypt_content,
  encrypt_content,
  get_pubkey,
  get_shared_secret,
  sign_msg,
  verify_sig
} from './crypto.js'

import type {
  EventMessage,
  EventTemplate,
  SignedEvent
} from '../types/index.js'

import CONST  from '../const.js'
import Schema from '../schema/index.js'

export function create_envelope (
  subject : string,
  payload : string,
  mid     : string = Buff.random(16).hex
) : string {
  return JSON.stringify([ subject, mid, payload ])
}

export function parse_envelope (
  content : string,
  event   : SignedEvent
) : EventMessage {
  const json     = JSON.parse(content)
  const schema   = Schema.event.envelope
  const envelope = schema.parse(json)
  const [ tag, mid, dat ] = envelope
  return { ctx: event, dat, mid, tag }
}

export function create_msg_event (
  content   : string,
  peer_pk   : string,
  seckey    : string,
  template? : Partial<EventTemplate>
) : SignedEvent {
  // get pubkey
  const pubkey    = get_pubkey(seckey)
  // get shared secret
  const secret    = get_shared_secret(seckey, peer_pk)
  // encrypt payload
  const encrypted = encrypt_content(secret, content)
  // Create an event template.
  const event = {
    ...CONST.EVENT_CONFIG,
    ...template,
    pubkey,
    content : encrypted,
  }
  // Add a tag for the peer's public key.
  event.tags.push([ 'p', peer_pk ])

  // Return the signed event.
  return sign_event(seckey, event)
}

export function parse_msg_event (
  event  : SignedEvent,
  seckey : string
) {
  // verify the id and signature
  verify_event(event)
  // get pubkey
  const pubkey = get_pubkey(seckey)
  // Assert that pubkey is in peers list.
  if (!is_recipient(event, pubkey)) {
    throw new Error('pubkey not in peers list')
  }
  // get shared secret
  const secret = get_shared_secret(seckey, event.pubkey)
  // decrypt event
  return decrypt_content(secret, event.content)
}

export function sign_event (
  seckey   : string,
  template : EventTemplate
) : SignedEvent {
  const id  = get_event_id(template)
  const sig = sign_msg(seckey, id)
  return { ...template, id, sig }
}

export function verify_event (
  event : SignedEvent
) : string | null {
  const { id, sig, ...template } = event
  const schema = Schema.event.signed
  const parsed = schema.safeParse(event)
  const vid    = get_event_id(template)
  if (!parsed.success) {
    return 'event failed validation'
  } else if (id !== vid) {
    return 'event id mismatch'
  } else if (!verify_sig(id, event.pubkey, sig)) {
    return 'invalid event signature'
  } else {
    return null
  }
}
