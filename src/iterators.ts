import {iterate} from "iterare"


export const EMPTY_ITERATOR = iterate([])


/**
 * @internal
 */
export class SingletonIterator<T> implements Iterator<T> {

  private done = false

  constructor(private readonly singleton: T) { }

  next(): IteratorResult<T> {
    const result = { value: this.singleton, done: this.done }
    if (!this.done) {
      this.done = true
    }
    return result
  }
}


/**
 * @internal
 */
export class DefaultOnEmptyIterator<T> implements Iterator<T> {

  private started = false

  constructor(private readonly  value:    T,
              private           iterator: Iterator<T>) { }

  next(): IteratorResult<T> {
    if (!this.started) {
      this.started = true
      const first = this.iterator.next()
      if (first.done) {
        // iterator is empty, vend the default value
        this.iterator = new SingletonIterator(this.value)
      } else {
        // iterator has at least one value, so vend it back.
        return first
      }
    }
    return this.iterator.next()
  }
}


/**
 * @internal
 */
export class DefaultOnErrorIterator<T> implements Iterator<T> {

  constructor(private readonly value:     T,
              private readonly iterator:  Iterator<T>) { }

  next(): IteratorResult<T> {
    try {
      return this.iterator.next()
    } catch (e: any) {
      return {value: this.value, done: false}
    }
  }
}


/**
 * Pulls one element from an iterator. If no elements available, returns undefined.
 *
 * @param iter an iterable iterator to consume from.
 */
export function one<T>(iter: IterableIterator<T>): T | undefined {
  return iter.next().value
}
