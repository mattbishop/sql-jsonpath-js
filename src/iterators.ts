import {isIterable} from "iterare/lib/utils.js"

import type {Input} from "./json-path.ts"


/**
 * Arrays are iterable, but for SQL JSONPath they are considered individual elements, unless unwrapped later by
 * a function.
 * @internal */
export function isIterableInput<T>(input: Input<T>): input is Iterable<T> {
  return typeof input !== "string" && !Array.isArray(input) && isIterable(input)
}


/** @internal */
export const EMPTY_ITERATOR = [][Symbol.iterator]()


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
