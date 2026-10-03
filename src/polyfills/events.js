/**
 * 100% Standalone, Zero-Dependency Polyfill for Node 'events' module (EventEmitter) in Metro / React Native runtime.
 */

class EventEmitter {
  constructor() {
    this._listeners = new Map();
    this._maxListeners = 10;
  }

  setMaxListeners(n) {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this._maxListeners || 10;
  }

  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('The listener must be a function');
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
    return this;
  }

  addListener(event, listener) {
    return this.on(event, listener);
  }

  prependListener(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('The listener must be a function');
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).unshift(listener);
    return this;
  }

  once(event, listener) {
    const g = (...args) => {
      this.removeListener(event, g);
      listener.apply(this, args);
    };
    g.listener = listener;
    return this.on(event, g);
  }

  removeListener(event, listener) {
    const list = this._listeners.get(event);
    if (!list) return this;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === listener || list[i].listener === listener) {
        list.splice(i, 1);
        break;
      }
    }
    return this;
  }

  off(event, listener) {
    return this.removeListener(event, listener);
  }

  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return false;
    const copy = [...list];
    for (let i = 0; i < copy.length; i++) {
      copy[i].apply(this, args);
    }
    return true;
  }

  listeners(event) {
    return (this._listeners.get(event) || []).slice();
  }

  listenerCount(event) {
    return this.listeners(event).length;
  }
}

EventEmitter.EventEmitter = EventEmitter;
EventEmitter.defaultMaxListeners = 10;

module.exports = EventEmitter;
