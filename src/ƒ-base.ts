import { CachedIterable } from "indexed-iterable"
import { iterate } from "iterare"
import { IteratorWithOperators } from "iterare/lib/iterate.js"
import { isIterable } from "iterare/lib/utils.js"
import { DateTime, FixedOffsetZone } from "luxon"

import { KeyValue } from "./json-path.ts"
import { EMPTY_ITERATOR } from "./iterators.ts"


enum Pred {
  TRUE,
  FALSE,
  UNKNOWN
}

type Seq<T> = IteratorWithOperators<T>

type Mapƒ<T> = (input: any) => T

type Predƒ = Mapƒ<SingleOrIterator<Pred>>

type SingleOrIterator<T> = T | Seq<T>

type StrictConfig = {
  test:   Mapƒ<boolean>
  error:  string
}

/**
 * @internal
 */
export class ƒBase {

  constructor(private readonly lax: boolean) { }


  private static _type(input: unknown): string {
    if (Array.isArray(input)) {
      return "array"
    }
    if (input === null) {
      return "null"
    }
    if (input instanceof Date) {
      return "date"
    }
    return typeof input
  }

  private static _isString(input: unknown): input is string {
    return typeof input === "string"
  }

  private static _next<T>(input: SingleOrIterator<T>): T {
    return ƒBase._isSeq(input)
      ? input.next().value
      : input
  }

  private static _isSeq(input: unknown): input is Seq<unknown> {
    return input instanceof IteratorWithOperators
  }

  private static _isObject(input: unknown): input is Record<string, unknown> {
    return ƒBase._type(input) === "object"
  }

  /**
   * Turn any input into a Seq. Does not consider lax or strict mode.
   * @param input the input to Seq.
   */
  private static _toSeq(input: unknown): Seq<unknown> {
    return ƒBase._isSeq(input)
      ? input.flatten()
      : iterate(Array.isArray(input)
        ? input
        : [input])
  }


  /**
   * Examine input with strict test, if any. Throws error if in strict mode and
   * the strictness test does not pass.
   * @param input the input to test.
   * @param strict the strictness config.
   * @private
   */
  private _checkStrict(input: unknown, strict?: StrictConfig) {
    if (this.lax || ƒBase._isSeq(input)) {
      return
    }
    if (strict && !strict.test(input)) {
      throw new Error(`In 'strict' mode! ${strict.error} Found: ${JSON.stringify(input)}`)
    }
  }

  /**
   * Turn any input, like an iterator, into an array. Only used in lax mode.
   * @param input The input to wrap.
   * @param strict strict config, if any.
   * @private
   */
  private _wrap(input: unknown, strict?: StrictConfig): Array<unknown> {
    this._checkStrict(input, strict)
    if (ƒBase._isSeq(input)) {
      return input.map((v) => Array.isArray(v) ? v : [v])
        .toArray()
    } else if (Array.isArray(input)) {
      return input
    }
    return [input]
  }

  /**
   * Turn any input, like an array, into an iterator. Only used in lax mode.
   * @param input The input to unwrap.
   * @param strict strict config, if any.
   * @private
   */
  private _unwrap(input: unknown, strict?: StrictConfig): Seq<unknown> {
    if (this.lax) {
      return ƒBase._toSeq(input)
    }

    this._checkStrict(input, strict)

    return ƒBase._isSeq(input)
      ? input
      : iterate([input])
  }

  private static _autoFlatMap<I extends Seq<unknown>>(input: unknown, mapƒ: Mapƒ<I>): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return ƒBase._isSeq(input)
      ? mapped.flatten() as I
      : mapped
  }

  private static _autoMap<T>(input: SingleOrIterator<unknown>, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
    return ƒBase._isSeq(input)
      ? input.map(mapƒ)
      : mapƒ(input)
  }

  private static _toPred(condition: boolean): Pred {
    return condition
      ? Pred.TRUE
      : Pred.FALSE
  }

  private static _objectValues(input: unknown): Seq<unknown> {
    return ƒBase._isObject(input)
      ? iterate(Object.values(input))
      : EMPTY_ITERATOR
  }

  private static _mustBeNumber(input: SingleOrIterator<unknown>, method: string): number {
    const num = ƒBase._next<unknown>(input)
    if (typeof num === "number") {
      return num
    }
    throw new Error(`${method} param must be a number, found ${JSON.stringify(input)}.`)
  }

  num(input: unknown): number {
    return ƒBase._mustBeNumber(input, "arithmetic")
  }


  type(input: unknown): SingleOrIterator<string> {
    return ƒBase._autoMap(input, ƒBase._type)
  }


  private static _size(value: unknown) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: unknown): SingleOrIterator<number> {
    return ƒBase._autoMap(input, ƒBase._size)
  }


  private static _double(input: unknown): number {
    if (ƒBase._isString(input)) {
      const num = Number(input)
      if (Number.isNaN(num)) {
        throw new Error(`double() param ${input} is not a representation of a number.`)
      }
      return num
    }
    return ƒBase._mustBeNumber(input, "double()")
  }

  double(input: unknown): SingleOrIterator<number> {
    return ƒBase._autoMap(input, ƒBase._double)
  }


  private static _ceiling(input: unknown): number {
    return Math.ceil(ƒBase._mustBeNumber(input, "ceiling()"))
  }

  ceiling(input: unknown): SingleOrIterator<number> {
    return ƒBase._autoMap(input, ƒBase._ceiling)
  }


  private static _floor(input: unknown): number {
    return Math.floor(ƒBase._mustBeNumber(input, "floor()"))
  }

  floor(input: unknown): SingleOrIterator<number> {
    return ƒBase._autoMap(input, ƒBase._floor)
  }


  private static _abs(input: unknown): number {
    return Math.abs(ƒBase._mustBeNumber(input, "abs()"))
  }

  abs(input: unknown): SingleOrIterator<number> {
    return ƒBase._autoMap(input, ƒBase._abs)
  }


  private static _datetime(input: unknown, template?: string): Date {
    if (ƒBase._isString(input)) {
      return template
        ? DateTime.fromFormat(input, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
        : new Date(input)
    }
    throw new Error(`datetime() param must be a string, found ${JSON.stringify(input)}.`)
  }

  datetime(input: unknown, template?: string): SingleOrIterator<Date> {
    return ƒBase._autoMap(input, (v: unknown) => ƒBase._datetime(v, template))
  }


  private static _toKV(obj: Record<string, unknown>, id: number): Seq<KeyValue> {
    return iterate(Object.keys(obj))
      .map((key) => ({id, key, value: obj[key]}))
  }

  keyvalue(input: unknown): Seq<KeyValue> {
    const objects = this._unwrap(input, {test: ƒBase._isObject, error: "keyvalue() param must be an object."})
    let id = 0
    const mapƒ = (row: unknown) => {
      if (ƒBase._isObject(row)) {
        return ƒBase._toKV(row, id++)
      }
      throw new Error(`keyvalue() param must have object values, found ${JSON.stringify(row)}.`)
    }
    return ƒBase._autoFlatMap(objects, mapƒ)
  }


  private _dotStar(input: unknown): Seq<unknown> {
    return this._unwrap(input, { test: ƒBase._isObject, error: ".* can only be applied to an object." })
        .map(ƒBase._objectValues)
        .flatten()
  }

  dotStar(input: unknown): Seq<unknown> {
    return ƒBase._autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: unknown): Seq<unknown> {
    // [*] is not the same as unwrap. it always turns the array into a seq
    this._checkStrict(input, { test: Array.isArray, error: "[*] can only be applied to an array in strict mode." })
    return ƒBase._toSeq(input)
  }

  boxStar(input: unknown): Seq<unknown> {
    return ƒBase._autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _getMember(obj: unknown, member: string): SingleOrIterator<unknown> {
    if (ƒBase._isObject(obj) && obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return EMPTY_ITERATOR
    }
    throw new Error(`Object does not contain key ${member}, in strict mode.`)
  }

  private _member(input: unknown, member: string): Seq<unknown> {
    return this._unwrap(input, { test: ƒBase._isObject, error: ".member can only be applied to an object." })
      .map((i) => this._getMember(i, member))
      .filter((i) => i !== EMPTY_ITERATOR)
  }

  member(input: unknown, member: string): Seq<unknown> {
    return ƒBase._autoFlatMap(input, (i) => this._member(i, member))
  }


  private _maybeElement(array: Array<unknown>, pos: any): unknown {
    if (pos < array.length) {
      const value = array[pos]
      return Array.isArray(value)
        ? [value]
        : value
    }
    if (this.lax) {
      return EMPTY_ITERATOR
    }
    throw new Error (`In 'strict' mode. Array subscript [${pos}] is out of bounds.`)
  }

  private _array(input: unknown, subscripts: any[]): Seq<any> {
    const array = this._wrap(input, { test: Array.isArray, error: "Array accessors can only be applied to an array." })
    return iterate(subscripts)
      .map((sub) => {
        const subType = ƒBase._type(sub)
        if (subType === "number") {
          return this._maybeElement(array, sub)
        }
        if (subType == "function") {
          return this._maybeElement(array, sub(array))
        }
        if (ƒBase._isSeq(sub)) {
          return sub.map((s) => this._maybeElement(array, s))
        }
        throw new Error("array accessor must be numbers")
      }).flatten()
  }

  array(input: unknown, subscripts: unknown[]): Seq<any> {
    return ƒBase._autoFlatMap(input, (i) => this._array(i, subscripts))
  }


  last(array: Array<unknown>): number {
    return array.length - 1
  }


  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: unknown, to: unknown): Seq<number> {
    const start = ƒBase._mustBeNumber(from, "'from'")
    const end = ƒBase._mustBeNumber(to, "'to'")
    return iterate(ƒBase._range(start, end))
  }


  private static _filter(input: unknown, filterExp: Predƒ): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return ƒBase._isSeq(result)
        ? result.includes(Pred.TRUE)
        : result === Pred.TRUE
    } catch (e) {
      // filter silently consumes all errors
      return false
    }
  }

  filter(input: any, filterExp: Predƒ): Seq<unknown> {
    return this._unwrap(input)
      .filter((i) => ƒBase._filter(i, filterExp))
  }


  private static _compare(compOp: string, left: any, right: any): Pred {
    // check that left and right can be compared
    const typeLeft = ƒBase._type(left)
    const typeRight = ƒBase._type(right)
    if (typeLeft === typeRight) {
      if (typeLeft === "date") {
        left = left.getTime()
        right = right.getTime()
      }
      switch (compOp) {
        case "==" :
          return ƒBase._toPred(left === right)
        case "<>" :
        case "!=" :
          return ƒBase._toPred(left !== right)
        case ">" :
          return ƒBase._toPred(left > right)
        case ">=" :
          return ƒBase._toPred(left >= right)
        case "<" :
          return ƒBase._toPred(left < right)
        case "<=" :
          return ƒBase._toPred(left <= right)
      }
    }
    return Pred.UNKNOWN
  }

  compare(compOp: string, left: unknown, right: any): SingleOrIterator<Pred> {
    if (!this.lax) {
      if (Array.isArray(left)) {
        throw new Error("In 'strict' mode! left side of comparison cannot be an array.")
      }
      if (Array.isArray(right)) {
        throw new Error("In 'strict' mode! right side of comparison cannot be an array.")
      }
    }

    let rightCompare
    if (isIterable(right)) {
      const resettableRight = new CachedIterable(right)
      rightCompare = (l: any) => {
        let retVal = Pred.FALSE
        for (const r of resettableRight) {
          retVal = ƒBase._compare(compOp, l, r)
          if (retVal == Pred.TRUE) {
            break
          }
        }
        return retVal
      }
    } else {
      rightCompare = (l: any) => ƒBase._compare(compOp, l, right)
    }

    left = Array.isArray(left)
      ? iterate(left)
      : left

    return ƒBase._autoMap(left, rightCompare)
  }

  not(input: any): Pred {
    return input === Pred.TRUE
      ? Pred.FALSE
      // UNKNOWN -> TRUE
      : Pred.TRUE
  }


  and(preds: Pred[]): Pred {
    for (const pred of preds) {
      if (ƒBase._next(pred) !== Pred.TRUE) {
        return Pred.FALSE
      }
    }
    return Pred.TRUE
  }


  or(preds: Pred[]): Pred {
    for (const pred of preds) {
      if (ƒBase._next(pred) === Pred.TRUE) {
        return Pred.TRUE
      }
    }
    return Pred.FALSE
  }


  exists(wff: () => SingleOrIterator<unknown>): Pred {
    try {
      const result = wff()
      let value
      if (ƒBase._isSeq(result)) {
        const next = result.next()
        value = next.done
          ? EMPTY_ITERATOR
          : next.value
      } else {
        value = result
      }
      return ƒBase._toPred(value !== EMPTY_ITERATOR)
    } catch (e) {
      return Pred.UNKNOWN
    }
  }


  /*
    Given: [
      { species: "cat" },
      { species: "dog" },
      { species: "bird" },
      { species: 2 }
    ]

      $ ? (((@.species == "cat") || (@.species == "dog")) is unknown)

    Returns:
      { species: 2 }

    Because species == string cannot be tested true or false, where "bird" can be tested as false
   */
  private static _isUnknown(input: Pred): Pred {
    return ƒBase._toPred(input === Pred.UNKNOWN)
  }

  isUnknown(input: SingleOrIterator<Pred>): SingleOrIterator<Pred> {
    return ƒBase._autoMap(input, ƒBase._isUnknown)
  }


  private static _startsWith(input: unknown, start: string): Pred {
    return ƒBase._isString(input)
      ? ƒBase._toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: unknown, start: string): SingleOrIterator<Pred> {
    return ƒBase._autoMap(input, (i) => ƒBase._startsWith(i, start))
  }


  private static _match(input: unknown, pattern: RegExp): Pred {
    return ƒBase._isString(input)
      ? ƒBase._toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input: unknown, pattern: RegExp): SingleOrIterator<Pred> {
    return ƒBase._autoMap(input, (i) => ƒBase._match(i, pattern))
  }
}
