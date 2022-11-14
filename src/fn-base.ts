import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"
import {SingletonIterator} from "./singleton-iterator"


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

  lax:        boolean


  constructor(lax: boolean) {
    this.lax = lax
  }


  private static _type(primary: any): string {
    return Array.isArray(primary)
      ? "array"
      : primary === null
        ? "null"
        : typeof primary
  }

  private static _next<T>(input: any): T {
    return FnBase._isSeq(input)
      ? input.next().value
      : input
  }

  private static _isSeq(input: any): input is Seq<any> {
    return input instanceof IteratorWithOperators<any>
  }

  private static _isObject(input: any): input is Record<string, any> {
    return FnBase._type(input) === "object"
  }

  /**
   * Turn an array into an iterator. Only used in lax mode.
   * @param input The input to unwrap.
   * @param strict strict config, if any.
   * @private
   */
  private _unwrap(input: any, strict?: StrictConfig): Seq<any> {
    if (!this.lax && strict && !strict.test(input)) {
      throw new Error(`In 'strict' mode! ${strict.error} Found: ${JSON.stringify(input)}`)
    }
    if (!FnBase._isSeq(input)) {
      input = iterate(Array.isArray(input)
        ? input
        : new SingletonIterator(input))
    }
    return input
  }

  private static _autoFlatMap<I extends Seq<unknown>>(input: any, mapƒ: Mapƒ<I>): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return FnBase._isSeq(input)
      ? mapped.flatten() as I
      : mapped
  }

  private static _autoMap<T>(input: SingleOrIterator<any>, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
    return FnBase._isSeq(input)
      ? input.map(mapƒ)
      : mapƒ(input)
  }

  private static _toPred(condition: boolean): Pred {
    return condition
      ? Pred.TRUE
      : Pred.FALSE
  }

  private static _objectValues(input: object): Seq<any> {
    return FnBase._type(input) === "object"
      ? iterate(Object.values(input))
      : FnBase.EMPTY
  }

  private static _mustBeNumber(input: SingleOrIterator<any>, method: string): number {
    const num = FnBase._next<number>(input)
    if (FnBase._type(num) === "number") {
      return num
    }
    throw new Error(`${method} param must be a number, found ${JSON.stringify(input)}.`)
  }

  num(input: any): number {
    return FnBase._mustBeNumber(input, "arithmetic")
  }


  type(input: any): SingleOrIterator<string> {
    return FnBase._autoMap(input, FnBase._type)
  }


  private static _size(value: any) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: any): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._size)
  }


  private static _double(input: any): number {
    const type = FnBase._type(input)
    if (type !== "number" && type !== "string") {
      throw new Error(`double() value must be a number or string, found ${JSON.stringify(input)}.`)
    }
    const n = Number(input)
    if (Number.isNaN(n)) {
      throw new Error(`double() param ${input} is not a representation of a number.`)
    }
    return n
  }

  double(input: any): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._double)
  }


  private static _ceiling(input: any): number {
    return Math.ceil(FnBase._mustBeNumber(input, "ceiling()"))
  }

  ceiling(input: any): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._ceiling)
  }


  private static _floor(input: any): number {
    return Math.floor(FnBase._mustBeNumber(input, "floor()"))
  }

  floor(input: any): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._floor)
  }


  private static _abs(input: any): number {
    return Math.abs(FnBase._mustBeNumber(input, "abs()"))
  }

  abs(input: any): SingleOrIterator<number> {
    return FnBase._autoMap(input, FnBase._abs)
  }


  private static _datetime(input: any, template?: string): Date {
    if (FnBase._type(input) !== "string") {
      throw new Error(`datetime() param must be a string, found ${JSON.stringify(input)}.`)
    }
    return template
      ? DateTime.fromFormat(input, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
      : new Date(input)
  }

  datetime(input: any, template?: string): SingleOrIterator<Date> {
    return FnBase._autoMap(input, (v: any) => FnBase._datetime(v, template))
  }


  private static _toKV(obj: Record<string, any>, id: number): Seq<KeyValue> {
    return iterate(Object.keys(obj))
      .map((key) => ({id, key, value: obj[key]}))
  }

  keyvalue(input: any): Seq<KeyValue> {
    if (Array.isArray(input)) {
      if (!this.lax) {
        throw new Error(`keyvalue() param must be an object but is an array (in strict mode), found ${JSON.stringify(input)}.`)
      }
      input = iterate(input)
    }
    let id = 0
    const mapƒ = (row: any) => {
      if (FnBase._type(row) !== "object") {
        // Only sequence one level of an array.
        throw new Error(`keyvalue() param must have object values, found ${JSON.stringify(row)}.`)
      }
      return FnBase._toKV(row, id++)
    }
    return FnBase._autoFlatMap(input, mapƒ)
  }


  private _dotStar(input: any): Seq<any> {
    return this._unwrap(input, { test: FnBase._isObject, error: ".* can only be applied to an object." })
        .map(FnBase._objectValues)
        .flatten()
  }

  dotStar(input: any): Seq<any> {
    return FnBase._autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: any): Seq<any> {
    return this._unwrap(input, { test: Array.isArray, error: "[*] can only be applied to an array in strict mode." })
  }

  boxStar(input: any): Seq<any> {
    return FnBase._autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _getMember(obj: any, member: string): SingleOrIterator<any> {
    if (FnBase._isObject(obj) && obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return FnBase.EMPTY
    }
    throw new Error(`Object does not contain key ${member}, in strict mode.`)
  }

  private _member(input: any, member: string): Seq<any> {
    return this._unwrap(input, { test: FnBase._isObject, error: ".member can only be applied to an object." })
      .map((i) => this._getMember(i, member))
      .filter((i) => i !== FnBase.EMPTY)
  }

  member(input: any, member: string): Seq<any> {
    return FnBase._autoFlatMap(input, (i) => this._member(i, member))
  }


  // called to set the array for the accessor statements to use it before going into array()
  a(a: any) {
    if (!Array.isArray(a)) {
      if (this.lax) {
        // lax mode auto-wraps things that are not an array
        if (FnBase._isSeq(a)) {
          a = a.map((v) => Array.isArray(v) ? v : [v])
        } else {
          a = [a]
        }
      } else {
        throw new Error(`Array accessors can only be applied to an array, found ${a}`)
      }
    }
    return a
  }

  private _maybeElement(arr: [], pos: number): any {
    if (pos < arr.length) {
      const value = arr[pos]
      return Array.isArray(value)
        ? [value]
        : value
    }
    if (this.lax) {
      return FnBase.EMPTY
    }
    throw new Error (`array subscript [${pos}] is out of bounds.`)
  }

  private _array(array: any, subscripts: any[]): Seq<any> {
    const values = iterate(subscripts)
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
    return values
  }

  array(input: any, subscripts: any[]): Seq<any> {
    return FnBase._autoFlatMap(input, (i) => this._array(i, subscripts))
  }


  last(array: any): number {
    return array.length - 1
  }


  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: any, to: any): Seq<number> {
    const start = FnBase._mustBeNumber(from, "'from'")
    const end = FnBase._mustBeNumber(to, "'to'")
    return iterate(FnBase._range(start, end))
  }


  private static _filter(filterExp: Predƒ, input: any): boolean {
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

  filter(input: any, filterExp: Predƒ): Seq<any> {
    return this._unwrap(input)
      .filter((i: any) => FnBase._filter(filterExp, i))
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

  compare(compOp: string, left: any, right: any): SingleOrIterator<Pred> {
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


  exists(wff: () => SingleOrIterator<any>): Pred {
    try {
      const seq = wff()
      let value
      if (FnBase._isSeq(seq)) {
        const next = seq.next()
        value = next.done
          ? FnBase.EMPTY
          : next.value
      } else {
        value = seq
      }
      const exists = value !== FnBase.EMPTY
      return FnBase._toPred(exists)
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


  private static _startsWith(input: any, start: string): Pred {
    return FnBase._type(input) === "string"
      ? FnBase._toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: any, start: string): SingleOrIterator<Pred> {
    return FnBase._autoMap(input, (i) => FnBase._startsWith(i, start))
  }


  private static _match(input: any, pattern: RegExp): Pred {
    return FnBase._type(input) === "string"
      ? FnBase._toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input:any, pattern: RegExp): SingleOrIterator<Pred> {
    return FnBase._autoMap(input, (i) => FnBase._match(i, pattern))
  }
}
