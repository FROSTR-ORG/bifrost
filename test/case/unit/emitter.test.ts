import { EventEmitter } from '@/class/emitter.js'
import { parse_error }  from '@/util/index.js'

import type { Test } from 'tape'

interface TestEvents {
  'test'    : string
  'multi'   : [ string, number ]
  'async'   : string
  '*'       : [ string, unknown ]
}

export default function (tape : Test) {
  tape.test('EventEmitter tests', t => {
    try {
      // Test basic on/emit
      t.test('on() and emit() work correctly', st => {
        const emitter = new EventEmitter<TestEvents>()
        let received : string | null = null

        emitter.on('test', (payload) => {
          received = payload
        })

        emitter.emit('test', 'hello')
        st.equal(received, 'hello', 'handler receives emitted payload')
        st.end()
      })

      // Test has()
      t.test('has() returns correct values', st => {
        const emitter = new EventEmitter<TestEvents>()

        st.equal(emitter.has('test'), false, 'has() returns false for unsubscribed event')

        const handler = () => {}
        emitter.on('test', handler)
        st.equal(emitter.has('test'), true, 'has() returns true after subscribing')

        emitter.off('test', handler)
        st.equal(emitter.has('test'), false, 'has() returns false after unsubscribing')
        st.end()
      })

      // Test off()
      t.test('off() removes handler', st => {
        const emitter = new EventEmitter<TestEvents>()
        let callCount = 0

        const handler = () => { callCount++ }
        emitter.on('test', handler)

        emitter.emit('test', 'first')
        st.equal(callCount, 1, 'handler called once')

        emitter.off('test', handler)
        emitter.emit('test', 'second')
        st.equal(callCount, 1, 'handler not called after off()')
        st.end()
      })

      // Test once()
      t.test('once() handler fires only once', st => {
        const emitter = new EventEmitter<TestEvents>()
        let callCount = 0

        emitter.once('test', () => { callCount++ })

        emitter.emit('test', 'first')
        emitter.emit('test', 'second')
        emitter.emit('test', 'third')

        st.equal(callCount, 1, 'once handler called exactly once')
        st.end()
      })

      // Test multiple handlers
      t.test('multiple handlers on same event', st => {
        const emitter = new EventEmitter<TestEvents>()
        const results : string[] = []

        emitter.on('test', () => results.push('handler1'))
        emitter.on('test', () => results.push('handler2'))
        emitter.on('test', () => results.push('handler3'))

        emitter.emit('test', 'payload')

        st.equal(results.length, 3, 'all three handlers called')
        st.ok(results.includes('handler1'), 'handler1 was called')
        st.ok(results.includes('handler2'), 'handler2 was called')
        st.ok(results.includes('handler3'), 'handler3 was called')
        st.end()
      })

      // Test array payload spreading
      t.test('array payloads are spread as arguments', st => {
        const emitter = new EventEmitter<TestEvents>()
        let receivedStr : string | null = null
        let receivedNum : number | null = null

        emitter.on('multi', (str, num) => {
          receivedStr = str
          receivedNum = num
        })

        emitter.emit('multi', [ 'hello', 42 ])

        st.equal(receivedStr, 'hello', 'first argument received correctly')
        st.equal(receivedNum, 42, 'second argument received correctly')
        st.end()
      })

      // Test wildcard handlers
      t.test('wildcard handler receives all events', st => {
        const emitter = new EventEmitter<TestEvents>()
        const received : Array<[ string, unknown ]> = []

        emitter.on('*', (eventName, payload) => {
          received.push([ eventName as string, payload ])
        })

        emitter.emit('test', 'payload1')
        emitter.emit('multi', [ 'str', 123 ])

        st.equal(received.length, 2, 'wildcard handler called for both events')
        st.equal(received[0][0], 'test', 'first event name captured')
        st.equal(received[0][1], 'payload1', 'first payload captured')
        st.equal(received[1][0], 'multi', 'second event name captured')
        st.end()
      })

      // Test clear()
      t.test('clear() removes all handlers for an event', st => {
        const emitter = new EventEmitter<TestEvents>()
        let callCount = 0

        emitter.on('test', () => { callCount++ })
        emitter.on('test', () => { callCount++ })
        emitter.on('test', () => { callCount++ })

        emitter.emit('test', 'before')
        st.equal(callCount, 3, 'all handlers called before clear')

        emitter.clear('test')
        emitter.emit('test', 'after')
        st.equal(callCount, 3, 'no handlers called after clear')
        st.end()
      })

      // Test within() with immediate emission
      t.test('within() handler receives events before timeout', st => {
        const emitter = new EventEmitter<TestEvents>()
        let received : string | null = null

        emitter.within('test', (payload) => {
          received = payload
        }, 1000)

        emitter.emit('test', 'immediate')
        st.equal(received, 'immediate', 'within handler receives immediate event')
        st.end()
      })

      // Test async handlers
      t.test('async handlers are supported', async st => {
        const emitter = new EventEmitter<TestEvents>()
        let asyncResult : string | null = null

        emitter.on('async', async (payload) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          asyncResult = payload
        })

        emitter.emit('async', 'async-payload')

        // Wait for async handler to complete
        await new Promise(resolve => setTimeout(resolve, 50))
        st.equal(asyncResult, 'async-payload', 'async handler completed')
        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}
