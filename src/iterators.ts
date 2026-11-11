import type {Input} from "./json-path.ts"
import {type MapWithArgsƒ, type Mapƒ, NO_VALUE, type Seq, type SingleOrSeq} from "./types.ts"


/** @internal */
export function noValueFilter(v: unknown) {
  return v !== NO_VALUE
}


/** @internal */
export const EMPTY_ITERATOR = [].values()

const DONE_RESULT: IteratorResult<any> = {
  value:  undefined,
  done:   true
}


/** @internal */
export function isSeq(input: unknown): input is Seq<unknown> {
  return !Array.isArray(input) && typeof (input as Seq<unknown>)?.flatMap === "function"
}


/** @internal */
export function toSeq(input: unknown): Seq<unknown> {
  return isSeq(input)
    ? new FlattenWithIterator(input)
    : Array.isArray(input)
      ? input.values()
      : new SingletonIterator(input)
}


/** @internal */
export function flattenSeq<T>(input: SingleOrSeq<SingleOrSeq<T>>): Seq<T> {
  return isSeq(input)
    ? new FlattenWithIterator<T>(input)
    : new SingletonIterator(input)
}


/** @internal */
export function isIterable(value: unknown): value is Iterable<unknown> {
  return value !== null
    && typeof value === "object"
    && typeof (value as Iterable<unknown>)[Symbol.iterator] === "function"
}


/**
 * Arrays are iterable, but for SQL JSONPath they are considered individual elements, unless unwrapped later by
 * a function.
 * @internal
 */
export function isIterableInput<T>(input: Input<T>): input is Iterable<T> {
  return !Array.isArray(input) && isIterable(input)
}


/**
 * Returns an iterator of iterable input (see isIterableInput), and wraps other input in a singleton iterator.
 * @internal
 */
export function toInputIterator(input: Input): IteratorObject<unknown> {
  return isIterableInput(input)
    ? Iterator.from(input)
    : new SingletonIterator(input)
}

export class FlattenWithIterator<O, I = unknown, M extends SingleOrSeq<O> = SingleOrSeq<O>> extends Iterator<O> {
  private inner?: Iterator<O>

  constructor(
    private readonly input: Iterator<I>,
    private readonly mapƒ?: Mapƒ<M>) {
      super()
  }

  next(): IteratorResult<O> {
    while (true) {
      if (this.inner) {
        const innerNext = this.inner.next()
        if (!innerNext.done) {
          return innerNext
        }
        this.inner = undefined
      }
      const outerNext = this.input.next()
      if (outerNext.done) {
        return DONE_RESULT
      }
      const mapped = this.mapƒ
        ? this.mapƒ(outerNext.value)
        : outerNext.value
      if (isSeq(mapped)) {
        this.inner = mapped as Iterator<O>
        continue
      }
      return {
        value:  mapped as O,
        done:   false
      }
    }
  }
}

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
export class MapWithIterator<T, A extends unknown[]> extends Iterator<T> {
  constructor(                  iterable: Iterable<unknown>,
              private readonly  mapƒ:     Mapƒ<T> | MapWithArgsƒ<T, A>,
              private readonly  filterNV: boolean,
              private readonly  args?:    A) {
    super()
    this.iterator = iterable[Symbol.iterator]()
  }

  private readonly iterator: Iterator<unknown>

  next(): IteratorResult<T> {
    while (true) {
      const result = this.iterator.next()
      if (result.done) {
        return result
      }
      const element = result.value
      if (element === NO_VALUE && this.filterNV) {
        continue
      }
      const mapped = this.args
        ? this.mapƒ(element, ...this.args)
        : this.mapƒ(element)
      if (mapped === NO_VALUE && this.filterNV) {
        continue
      }
      return {
        value: mapped,
        done:  false
      }
    }
  }
}


type RangeMapƒ = (array: unknown[], pos: number) => unknown

export class RangeIterator extends Iterator<unknown> {
  constructor(private readonly  array:  unknown[],
                                start:  number,
              private readonly  end:    number,
              private readonly  mapƒ:   RangeMapƒ) {
    super()
    this.current = start
  }

  private current: number

  next(): IteratorResult<unknown> {
    return this.current <= this.end
      ? {
          value:  this.mapƒ(this.array, this.current++),
          done:   false
        }
    : DONE_RESULT
  }
}


/** @internal */
export class SingletonIterator<T> extends Iterator<T> {
  constructor(private readonly value: T) {
    super()
  }

  private done = false

  next(): IteratorResult<T> {
    if (this.done) {
      return DONE_RESULT
    }
    this.done = true
    return {
      value:  this.value,
      done:   false
    }
  }
}


/**
 * Return a default value if the iterator has no values (done at the start) @internal
 * @internal
 */
export class DefaultOnEmptyIterator<T> extends Iterator<T> {

  private started = false

  constructor(private readonly  defaultValue: T,
              private readonly  iterator:     Iterator<T>) {
    super()
  }

  next(): IteratorResult<T> {
    if (!this.started) {
      this.started = true
      const first = this.iterator.next()
      return first.done
        ? {
            value:  this.defaultValue,
            done:   false
          }
        : first
    }
    return this.iterator.next()
  }
}


/**
 * @internal
 */
export class DefaultOnErrorIterator<T> extends Iterator<T> {

  constructor(private readonly defaultValue:  T,
              private readonly iterator:      Iterator<T>) {
    super()
  }

  next(): IteratorResult<T> {
    try {
      return this.iterator.next()
    } catch {
      return {
        value: this.defaultValue,
        done: false
      }
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

/**
 *  Examines input and returns the next value if a Seq, or the input if not.
 *
 * @internal
 */
export function next<T>(input: SingleOrSeq<T>): T {
  return isSeq(input)
    ? one(input) as T
    : input
}

/**
 * Maps the input with the mapƒ function. If Seq, applies mapƒ to the sequence. If a single value,
 * just applies mapƒ to value.
 *  @internal
 */
export function autoMap<T>(input: SingleOrSeq<unknown>, mapƒ: Mapƒ<T>): SingleOrSeq<T> {
  return isSeq(input)
    ? input.map(mapƒ)
    : mapƒ(input)
}

/**
 * Similar to autoMap, applies mapƒ to input if it is a Seq, then flattens it. If single value, just applies mapƒ.
 * @internal
 */
export function autoFlatMap<I extends SingleOrSeq<unknown>>(input: unknown, mapƒ: Mapƒ<I>): I {
  return isSeq(input)
    ? new FlattenWithIterator(input, mapƒ) as I
    : mapƒ(input)
}
