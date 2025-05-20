/**
 * Type-safe event emitter that handles synchronous and asynchronous event subscriptions.
 * Provides a robust event system with support for one-time events, timeouts, and wildcard handlers.
 * @template T Record of event names mapped to their payload types
 */

type EventHandler<T> = T extends any[] 
  ? (...args: T) => void | Promise<void>
  : (payload: T) => void | Promise<void>

type EventMap<T>  = Map<EventName<T>, Set<Function>>
type EventName<T> = keyof T | '*'

export class EventEmitter<T extends Record<string, any> = {}> {
  private readonly eventMap: EventMap<T>

  constructor() {
    this.eventMap = new Map()
  }

  /**
   * Gets or creates a Set of event handlers for the given event.
   */
  private _get_event_handlers(eventName: EventName<T>): Set<Function> {
    const handlers = this.eventMap.get(eventName)
    if (!handlers) {
      const newHandlers = new Set<Function>()
      this.eventMap.set(eventName, newHandlers)
      return newHandlers
    }
    return handlers
  }

  /**
   * Checks if an event has any active subscribers.
   */
  public has<K extends keyof T>(eventName: K): boolean {
    const handlers = this.eventMap.get(eventName)
    return handlers !== undefined && handlers.size > 0
  }

  /**
   * Subscribes a handler function to an event.
   */
  public on<K extends keyof T>(
    eventName: K,
    handler: EventHandler<T[K]>
  ): void {
    this._get_event_handlers(eventName).add(handler)
  }

  /**
   * Subscribes a one-time handler that automatically unsubscribes after first execution.
   */
  public once <K extends keyof T>(
    eventName: K,
    handler: EventHandler<T[K]>
  ): void {
    const once_handler: EventHandler<T[K]> = ((payload: T[K]) => {
      this.off(eventName, once_handler)
      void invoke_handler(handler as Function, payload)
    }) as EventHandler<T[K]>
    
    this.on(eventName, once_handler)
  }

  /**
   * Subscribes a handler that automatically unsubscribes after a specified timeout.
   */
  public within<K extends keyof T>(
    eventName : K,
    handler   : EventHandler<T[K]>,
    timeoutMs : number
  ): void {
    const timeout_handler: EventHandler<T[K]> = ((payload: T[K]) => {
      void invoke_handler(handler as Function, payload)
    }) as EventHandler<T[K]>

    setTimeout(() => {
      this.off(eventName, timeout_handler)
    }, timeoutMs)

    this.on(eventName, timeout_handler)
  }

  /**
   * Emits an event with the given payload to all subscribers.
   * Handles both synchronous and asynchronous event handlers.
   */
  public emit<K extends keyof T>(eventName: K, payload: T[K]): void {
    const promises: Promise<any>[] = []

    // Call specific event handlers
    this._get_event_handlers(eventName).forEach(handler => {
      const result = invoke_handler(handler as Function, payload)
      if (result instanceof Promise) {
        promises.push(result)
      }
    })

    // Call wildcard handlers
    this._get_event_handlers('*').forEach(handler => {
      const result = invoke_handler(handler as Function, [eventName, payload])
      if (result instanceof Promise) {
        promises.push(result)
      }
    })

    void Promise.allSettled(promises)
  }

  /**
   * Removes a specific handler from an event's subscriber list.
   */
  public off<K extends keyof T>(
    eventName: K,
    handler: EventHandler<T[K]>
  ): void {
    this._get_event_handlers(eventName).delete(handler)
  }

  /**
   * Removes all handlers for a specific event.
   */
  public clear(eventName: EventName<T>): void {
    this.eventMap.delete(eventName)
  }
}

/**
 * Invokes a handler function with the given payload, handling both array and non-array payloads.
 */
function invoke_handler(handler: Function, payload: any): any {
  if (Array.isArray(payload) && payload.length > 0) {
    return handler.apply(null, payload)
  }
  return handler(payload)
}
