import {isIterable} from "iterare/lib/utils.js"

import type {Input} from "./json-path.ts"


/**
 * Arrays are iterable, but for SQL JSONPath they are considered individual elements, unless unwrapped later by
 * a function.
 * @internal
 */
export function isIterableInput<T>(input: Input<T>): input is Iterable<T> {
  return typeof input !== "string" && !Array.isArray(input) && isIterable(input)
}


/**
 * Returns an iterator of iterable input (see isIterableInput), and wraps other input in a singleton iterator.
 * @internal
 */
export function toInputIterator(input: Input): Iterator<unknown> {
  return isIterableInput(input)
    ? input[Symbol.iterator]()
    : new SingletonIterator(input)
}


/** @internal */
export const EMPTY_ITERATOR = [][Symbol.iterator]()


/**
 * Wraps a single-pass iterable so it can be iterated multiple times.
 *
 * Values are cached lazily as they are read from the source iterator.
 * Later iterations replay cached values first, then continue reading
 * from the shared source iterator if it has not been exhausted.
 *
 * @internal
 */
export class ReplayableIterable<T> implements Iterable<T> {
  private readonly cache: T[] = []
  private readonly iterator: Iterator<T>
  private done = false

  constructor(iterable: Iterable<T>) {
    this.iterator = iterable[Symbol.iterator]()
  }

  *[Symbol.iterator](): Iterator<T> {
    let index = 0

    while (index < this.cache.length) {
      yield this.cache[index++]
    }

    while (!this.done) {
      const next = this.iterator.next()

      if (next.done) {
        this.done = true
        return
      }

      this.cache.push(next.value)
      yield next.value
      index++
    }
  }
}


/** @internal */
export class SingletonIterator<T> implements Iterator<T> {
  constructor(private readonly value: T) { }

  private done = false

  next() {
    if (this.done) {
      return {
        done:   true,
        value:  undefined as T
      }
    }
    this.done = true
    return {
      done:   false,
      value:  this.value
    }
  }
}


/**
 * Return a default value if the iterator has no values (done at the start) @internal
 * @internal
 */
export class DefaultOnEmptyIterator<T> implements Iterator<T> {

  private started = false

  constructor(private readonly  defaultValue: T,
              private readonly  iterator:     Iterator<T>) { }

  next(): IteratorResult<T> {
    if (!this.started) {
      this.started = true
      const first = this.iterator.next()
      return first.done
        ? {value: this.defaultValue, done: true}
        : first
    }
    return this.iterator.next()
  }
}


/**
 * @internal
 */
export class DefaultOnErrorIterator<T> implements Iterator<T> {

  constructor(private readonly defaultValue:  T,
              private readonly iterator:      Iterator<T>) { }

  next(): IteratorResult<T> {
    try {
      return this.iterator.next()
    } catch (e: any) {
      return {value: this.defaultValue, done: false}
    }
  }
}


/**
 * Pulls one element from an iterator. If no elements are available, returns undefined.
 *
 * @param iter an iterator to consume from.
 */
export function one<T>(iter: Iterator<T>): T | undefined {
  return iter.next().value
}
