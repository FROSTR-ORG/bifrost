import { Buff }     from '@cmdcode/buff'
import { NDKEvent } from '@nostr-dev-kit/ndk'

import type {
  EventTemplate,
  SignedEvent
} from '../types/index.js'

export const now   = () => Math.floor(Date.now() / 1000)
export const sleep = (ms : number = 1000) => new Promise(res => setTimeout(res, ms))

export namespace assert {

  export function ok (
    value    : unknown,
    message ?: string
  ) : asserts value {
    if (value === false) {
      throw new Error(message ?? 'assertion failed')
    }
  }

  export function exists <T> (
    value : T | null,
    msg  ?: string
    ) : asserts value is NonNullable<T> {
    if (typeof value === 'undefined' || value === null) {
      throw new Error(msg ?? 'value is null or undefined')
    }
  }
}

export function get_event_id (
  template : EventTemplate
) {
  const preimg = JSON.stringify([
    0,
    template.pubkey,
    template.created_at,
    template.kind,
    template.tags,
    template.content,
  ])
  return Buff.str(preimg).digest.hex
}

export function get_tags (
  event : EventTemplate,
  tag   : string
) {
  return event.tags.filter(e => e.at(0) === tag)
}

export function is_recipient (
  event  : SignedEvent,
  pubkey : string
) {
  // verify event is directed at you.
  const peers = get_tags(event, 'p')
  // check if pubkey exists
  return peers.some(e => e[1] === pubkey)
}

export function parse_ndk_event (
  event : NDKEvent
) : SignedEvent {
  const { content, created_at, id, kind, pubkey, sig, tags } = event
  assert.exists(created_at)
  assert.exists(kind)
  assert.exists(sig)
  return { content, created_at, id, kind, pubkey, sig, tags }
}
