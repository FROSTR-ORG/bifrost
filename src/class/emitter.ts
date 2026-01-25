/**
 * Type-safe event emitter that handles synchronous and asynchronous event subscriptions.
 * Provides a robust event system with support for one-time events, timeouts, and wildcard handlers.
 * @template T Record of event names mapped to their payload types
 */

/**
 * Event handler function type.
 * For array payloads, arguments are spread; otherwise the payload is passed directly.
 */
type EventHandler<T> = T extends any[]
  ? (...args: T) => void | Promise<void>
  : (payload: T) => void | Promise<void>

/**
 * Generic handler function type used for internal storage.
 * Handlers accept unknown arguments and may return void or Promise<void>.
 */
type GenericHandler = (...args: unknown[]) => void | Promise<void>

/**
 * Map of event names to their handler sets.
 */
type EventMap<T>  = Map<EventName<T>, Set<GenericHandler>>

/**
 * Valid event names: any key of T or the wildcard '*'.
 */
type EventName<T> = keyof T | '*'

export class EventEmitter<T extends Record<string, any> = {}> {
  private readonly eventMap: EventMap<T>

  constructor() {
    this.eventMap = new Map()
  }

  /**
   * Gets or creates a Set of event handlers for the given event.
   */
  private _get_event_handlers(eventName: EventName<T>): Set<GenericHandler> {
    const handlers = this.eventMap.get(eventName)
    if (!handlers) {
      const newHandlers = new Set<GenericHandler>()
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
    this._get_event_handlers(eventName).add(handler as GenericHandler)
  }

  /**
   * Subscribes a one-time handler that automatically unsubscribes after first execution.
   */
  public once<K extends keyof T>(
    eventName: K,
    handler: EventHandler<T[K]>
  ): void {
    const once_handler: GenericHandler = (...args: unknown[]) => {
      this.off(eventName, once_handler as EventHandler<T[K]>)
      return invoke_handler(handler as GenericHandler, args.length === 1 ? args[0] : args)
    }

    this._get_event_handlers(eventName).add(once_handler)
  }

  /**
   * Subscribes a handler that automatically unsubscribes after a specified timeout.
   * Uses timer.unref() to prevent blocking process exit.
   */
  public within<K extends keyof T>(
    eventName : K,
    handler   : EventHandler<T[K]>,
    timeoutMs : number
  ): void {
    const cleanup = () => {
      clearTimeout(timer)
      this._get_event_handlers(eventName).delete(timeout_handler)
    }

    const timeout_handler: GenericHandler = (...args: unknown[]) => {
      cleanup()
      return invoke_handler(handler as GenericHandler, args.length === 1 ? args[0] : args)
    }

    const timer = setTimeout(cleanup, timeoutMs)
    // Prevent timer from blocking process exit
    if (typeof timer.unref === 'function') timer.unref()

    this._get_event_handlers(eventName).add(timeout_handler)
  }

  /**
   * Emits an event with the given payload to all subscribers.
   * Handles both synchronous and asynchronous event handlers.
   */
  public emit<K extends keyof T>(eventName: K, payload: T[K]): void {
    const promises: Promise<void>[] = []

    // Call specific event handlers
    this._get_event_handlers(eventName).forEach(handler => {
      const result = invoke_handler(handler, payload)
      if (result instanceof Promise) {
        promises.push(result)
      }
    })

    // Call wildcard handlers
    this._get_event_handlers('*').forEach(handler => {
      const result = invoke_handler(handler, [eventName, payload])
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
    this._get_event_handlers(eventName).delete(handler as GenericHandler)
  }

  /**
   * Removes all handlers for a specific event.
   */
  public clear(eventName: EventName<T>): void {
    this.eventMap.delete(eventName)
  }

  /**
   * Removes all handlers for a specific event, or all handlers if no event specified.
   * @param eventName - Optional event name to clear handlers for
   */
  public clear_listeners<K extends keyof T>(eventName?: K): void {
    if (eventName !== undefined) {
      this.eventMap.delete(eventName)
    } else {
      this.eventMap.clear()
    }
  }
}

/**
 * Invokes a handler function with the given payload.
 *
 * For array payloads, arguments are spread to the handler.
 * For non-array payloads, the value is passed directly.
 *
 * @param handler - The handler function to invoke.
 * @param payload - The payload to pass to the handler.
 * @returns The handler result (void or Promise<void>).
 */
function invoke_handler(handler: GenericHandler, payload: unknown): void | Promise<void> {
  if (Array.isArray(payload) && payload.length > 0) {
    return handler(...payload)
  }
  return handler(payload)
}
