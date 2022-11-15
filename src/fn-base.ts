import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"
import {SingletonIterator} from "./iterators"


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

export class FnBase {

  static EMPTY = iterate(Object.freeze([]))

  constructor(private readonly lax: boolean) { }


  private static _type(input: unknown): string {
    return Array.isArray(input)
      ? "array"
      : input === null
        ? "null"
        : typeof input
  }

  private static _isString(input: unknown): input is string {
    return typeof input === "string"
  }

  private static _next<T>(input: unknown): T {
    return FnBase._isSeq(input)
      ? input.next().value
      : input
  }

  private static _isSeq(input: unknown): input is Seq<unknown> {
    return input instanceof IteratorWithOperators
  }

  private static _isObject(input: unknown): input is Record<string, unknown> {
    return FnBase._type(input) === "object"
  }


  private _wrap(input: unknown, strict?: StrictConfig): Array<unknown> {
    if (!this.lax && strict && !strict.test(input)) {
      throw new Error(`In 'strict' mode! ${strict.error} Found: ${JSON.stringify(input)}`)
    }
    let output
    if (FnBase._isSeq(input)) {
      output = input.map((v) => Array.isArray(v) ? v : [v])
        .toArray()
    } else if (Array.isArray(input)) {
      output = input
    } else {
      output = [input]
    }
    return output
  }

  /**
   * Turn an array into an iterator. Only used in lax mode.
   * @param input The input to unwrap.
   * @param strict strict config, if any.
   * @private
   */
  private _unwrap(input: unknown, strict?: StrictConfig): Seq<unknown> {
    if (!this.lax && strict && !strict.test(input)) {
      throw new Error(`In 'strict' mode! ${strict.error} Found: ${JSON.stringify(input)}`)
    }
    let output
    if (FnBase._isSeq(input)) {
      output = input
    } else {
      output = iterate(Array.isArray(input)
        ? input
        : new SingletonIterator(input))
    }
    return output
  }

  private static _autoFlatMap<I extends Seq<unknown>>(input: unknown, mapƒ: Mapƒ<I>): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return FnBase._isSeq(input)
      ? mapped.flatten() as I
      : mapped
  }

  private static _autoMap<T>(input: SingleOrIterator<unknown>, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
    return FnBase._isSeq(input)
      ? input.map(mapƒ)
      : mapƒ(input)
  }

  private static _toPred(condition: boolean): Pred {
    return condition
      ? Pred.TRUE
      : Pred.FALSE
  }

  private static _objectValues(input: unknown): Seq<unknown> {
    return FnBase._isObject(input)
      ? iterate(Object.values(input))
      : FnBase.EMPTY
  }

  private static _mustBeNumber(input: SingleOrIterator<unknown>, method: string): number {
    const num = FnBase._next<number>(input)
    if (FnBase._type(num) === "number") {
      return num
    }
    throw new Error(`${method} param must be a number, found ${JSON.stringify(input)}.`)
  }

  num(input: unknown): number {
    return FnBase._mustBeNumber(input, "arithmetic")
  }


  type(input: unknown): SingleOrIterator<string> {
    return FnBase._autoMap(input, FnBase._type)
  }


  private static _size(value: unknown) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: unknown): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._size)
  }


  private static _double(input: unknown): number {
    let num
    if (FnBase._isString(input)) {
      num = Number(input)
      if (Number.isNaN(num)) {
        throw new Error(`double() param ${input} is not a representation of a number.`)
      }
    } else {
      num = FnBase._mustBeNumber(input, "double()")
    }
    return num
  }

  double(input: unknown): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._double)
  }


  private static _ceiling(input: unknown): number {
    return Math.ceil(FnBase._mustBeNumber(input, "ceiling()"))
  }

  ceiling(input: unknown): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._ceiling)
  }


  private static _floor(input: unknown): number {
    return Math.floor(FnBase._mustBeNumber(input, "floor()"))
  }

  floor(input: unknown): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._floor)
  }


  private static _abs(input: unknown): number {
    return Math.abs(FnBase._mustBeNumber(input, "abs()"))
  }

  abs(input: unknown): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._abs)
  }


  private static _datetime(input: unknown, template?: string): Date {
    if (FnBase._isString(input)) {
      return template
        ? DateTime.fromFormat(input, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
        : new Date(input)
    }
    throw new Error(`datetime() param must be a string, found ${JSON.stringify(input)}.`)
  }

  datetime(input: unknown, template?: string): SingleOrIterator<Date> {
    return FnBase._autoMap(input, (v: unknown) => FnBase._datetime(v, template))
  }


  private static _toKV(obj: Record<string, unknown>, id: number): Seq<KeyValue> {
    return iterate(Object.keys(obj))
      .map((key) => ({id, key, value: obj[key]}))
  }

  keyvalue(input: unknown): Seq<KeyValue> {
    const wrapped = this._unwrap(input, {test: FnBase._isObject, error: "keyvalue() param must be an object."})
    let id = 0
    const mapƒ = (row: unknown) => {
      if (FnBase._isObject(row)) {
        return FnBase._toKV(row, id++)
      }
      throw new Error(`keyvalue() param must have object values, found ${JSON.stringify(row)}.`)
    }
    return FnBase._autoFlatMap(wrapped, mapƒ)
  }


  private _dotStar(input: unknown): Seq<unknown> {
    return this._unwrap(input, { test: FnBase._isObject, error: ".* can only be applied to an object." })
        .map(FnBase._objectValues)
        .flatten()
  }

  dotStar(input: unknown): Seq<unknown> {
    return FnBase._autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: unknown): Seq<unknown> {
    return this._unwrap(input, { test: Array.isArray, error: "[*] can only be applied to an array in strict mode." })
  }

  boxStar(input: unknown): Seq<unknown> {
    return FnBase._autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _getMember(obj: unknown, member: string): SingleOrIterator<unknown> {
    if (FnBase._isObject(obj) && obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return FnBase.EMPTY
    }
    throw new Error(`Object does not contain key ${member}, in strict mode.`)
  }

  private _member(input: unknown, member: string): Seq<unknown> {
    return this._unwrap(input, { test: FnBase._isObject, error: ".member can only be applied to an object." })
      .map((i) => this._getMember(i, member))
      .filter((i) => i !== FnBase.EMPTY)
  }

  member(input: unknown, member: string): Seq<unknown> {
    return FnBase._autoFlatMap(input, (i) => this._member(i, member))
  }


  private _maybeElement(array: Array<unknown>, pos: any): unknown {
    if (pos < array.length) {
      const value = array[pos]
      return Array.isArray(value)
        ? [value]
        : value
    }
    if (this.lax) {
      return FnBase.EMPTY
    }
    throw new Error (`In 'strict' mode. Array subscript [${pos}] is out of bounds.`)
  }

  private _array(input: unknown, subscripts: any[]): Seq<any> {
    const array = this._wrap(input, { test: Array.isArray, error: "Array accessors can only be applied to an array." })
    return iterate(subscripts)
      .map((sub) => {
        const subType = FnBase._type(sub)
        if (subType === "number") {
          return this._maybeElement(array, sub)
        }
        if (FnBase._isSeq(sub)) {
          return sub.map((s1) => this._maybeElement(array, s1))
        }
        if (subType == "function") {
          return this._maybeElement(array, sub(array))
        }
        throw new Error("array accessor must be numbers")
      }).flatten()
  }

  array(input: unknown, subscripts: unknown[]): Seq<any> {
    return FnBase._autoFlatMap(input, (i) => this._array(i, subscripts))
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
    const start = FnBase._mustBeNumber(from, "'from'")
    const end = FnBase._mustBeNumber(to, "'to'")
    return iterate(FnBase._range(start, end))
  }


  private static _filter(input: unknown, filterExp: Predƒ): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return FnBase._isSeq(result)
        ? result.includes(Pred.TRUE)
        : result === Pred.TRUE
    } catch (e) {
      // filter silently consumes all errors
      return false
    }
  }

  filter(input: any, filterExp: Predƒ): Seq<unknown> {
    return this._unwrap(input)
      .filter((i) => FnBase._filter(i, filterExp))
  }


  private static _compare(compOp: string, left: any, right: any): Pred {
    // check that left and right can be compared
    const typeLeft = FnBase._type(left)
    const typeRight = FnBase._type(right)
    if (typeLeft === typeRight) {
      switch (compOp) {
        case "==" :
          return FnBase._toPred(left === right)
        case "<>" :
        case "!=" :
          return FnBase._toPred(left !== right)
        case ">" :
          return FnBase._toPred(left > right)
        case ">=" :
          return FnBase._toPred(left >= right)
        case "<" :
          return FnBase._toPred(left < right)
        case "<=" :
          return FnBase._toPred(left <= right)
      }
    }
    return Pred.UNKNOWN
  }

  compare(compOp: string, left: unknown, right: any): SingleOrIterator<Pred> {
    return FnBase._autoMap(left, (l) => FnBase._compare(compOp, l, right))
  }


  and(preds: Pred[]): Pred {
    for (const pred of preds) {
      if (FnBase._next(pred) !== Pred.TRUE) {
        return Pred.FALSE
      }
    }
    return Pred.TRUE
  }


  or(preds: Pred[]): Pred {
    for (const pred of preds) {
      if (FnBase._next(pred) === Pred.TRUE) {
        return Pred.TRUE
      }
    }
    return Pred.FALSE
  }


  exists(wff: () => SingleOrIterator<unknown>): Pred {
    try {
      const result = wff()
      let value
      if (FnBase._isSeq(result)) {
        const next = result.next()
        value = next.done
          ? FnBase.EMPTY
          : next.value
      } else {
        value = result
      }
      return FnBase._toPred(value !== FnBase.EMPTY)
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
    return FnBase._toPred(input === Pred.UNKNOWN)
  }

  isUnknown(input: SingleOrIterator<Pred>): SingleOrIterator<Pred> {
    return FnBase._autoMap(input, FnBase._isUnknown)
  }


  private static _startsWith(input: unknown, start: string): Pred {
    return FnBase._isString(input)
      ? FnBase._toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: unknown, start: string): SingleOrIterator<Pred> {
    return FnBase._autoMap(input, (i) => FnBase._startsWith(i, start))
  }


  private static _match(input: unknown, pattern: RegExp): Pred {
    return FnBase._isString(input)
      ? FnBase._toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input: unknown, pattern: RegExp): SingleOrIterator<Pred> {
    return FnBase._autoMap(input, (i) => FnBase._match(i, pattern))
  }
}
