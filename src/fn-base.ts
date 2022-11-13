import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"


enum Pred {
  TRUE,
  FALSE,
  UNKNOWN
}

type Mapƒ<T> = (input: any) => T

type Predƒ = Mapƒ<SingleOrIterator<Pred>>

type SingleOrIterator<T> = T | IteratorWithOperators<T>


export class FnBase {

  static EMPTY = iterate(Object.freeze([]))

  arrayStack: [][]
  lax:        boolean


  constructor(lax: boolean) {
    this.arrayStack = []
    this.lax = lax
  }


  private static _type(primary: any): string {
    return Array.isArray(primary)
      ? "array"
      : primary === null
        ? "null"
        : typeof primary
  }

  private _wrap<I>(input: I, strictError?: string): I[] {
    if (Array.isArray(input)) {
      return input
    }
    if (!this.lax && strictError) {
      throw new Error(`${strictError} Found: ${JSON.stringify(input)}`)
    }
    return [input]
  }

  /**
   * Turn an array into an iterator, if in lax mode, and it can be done in strict mode
   * @param input The input to unwrap
   * @param strictError if present, means an error with this message should be thrown in strict mode if the input is an array.
   * @private
   */
  private _unwrap(input: any, strictError?: string): SingleOrIterator<any> {
    if (Array.isArray(input)) {
      if (!this.lax && strictError) {
        throw new Error(`${strictError} Found: ${JSON.stringify(input)}`)
      }
      input = iterate(input)
    }
    return input
  }

  private static _autoFlatMap<I extends IteratorWithOperators<unknown>>(input: any, mapƒ: Mapƒ<I>): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return input instanceof IteratorWithOperators
      ? mapped.flatten() as I
      : mapped
  }

  private static _autoMap<T>(input: SingleOrIterator<any>, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
    return input instanceof IteratorWithOperators
      ? input.map(mapƒ)
      : mapƒ(input)
  }

  private static _toPred(condition: boolean): Pred {
    return condition
      ? Pred.TRUE
      : Pred.FALSE
  }

  private static _mustBeNumber(input: SingleOrIterator<any>, method: string): number {
    if (FnBase._type(input) === "number") {
      return input
    }
    const num = input.next()?.value
    if (FnBase._type(num) === "number") {
      return num
    }
    throw new Error(`${method} param must be a number, found ${JSON.stringify(input)}.`)
  }

  private static _objectValues(input: object): IteratorWithOperators<any> {
    return FnBase._type(input) === "object"
      ? iterate(Object.values(input))
      : FnBase.EMPTY
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


  private static _toKV(obj: Record<string, any>, id: number): IteratorWithOperators<KeyValue> {
    return iterate(Object.keys(obj))
      .map((key) => ({id, key, value: obj[key]}))
  }

  keyvalue(input: any): IteratorWithOperators<KeyValue> {
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


  private _dotStar(input: any): IteratorWithOperators<any> {
    const values = this._unwrap(input, ".* can only be applied to an object in strict mode.")
    return values instanceof IteratorWithOperators
      ? values
        .map(FnBase._objectValues)
        .flatten()
      : FnBase._objectValues(input)
  }

  dotStar(input: any): IteratorWithOperators<any> {
    return FnBase._autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: any): IteratorWithOperators<any> {
    return iterate(
      this._wrap(input, "[*] can only be applied to an array in strict mode."))
  }

  boxStar(input: any): IteratorWithOperators<any> {
    return FnBase._autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _maybeMember(input: any, member: string): SingleOrIterator<any> {
    const type = FnBase._type(input)
    if (type === "object") {
      return this._getMember(input, member)
    } else if (!this.lax) {
      throw new Error(`."${member}" can only be applied to an object in strict mode, found ${JSON.stringify(input)}.`)
    }
    return FnBase.EMPTY
  }

  private _getMember(obj: Record<string, any>, member: string): SingleOrIterator<any> {
    if (obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return FnBase.EMPTY
    }
    throw new Error(`Object does not contain key ${member}, in strict mode.`)
  }

  private _member(input: any, member: string): SingleOrIterator<any> {
    input = this._unwrap(input)
    if (input instanceof IteratorWithOperators) {
      return input.map((i) => this._maybeMember(i, member))
        .filter((i) => i !== FnBase.EMPTY)
    } else {
      return this._maybeMember(input, member)
    }
  }

  member(input: any, member: string): SingleOrIterator<any> {
    return FnBase._autoMap(input, (i) => this._member(i, member))
  }


  // called to set the array for the accessor statements to use it before going into array()
  a(a: any) {
    if (!Array.isArray(a)) {
      if (this.lax) {
        // lax mode auto-wraps things that are not an array
        if (a instanceof IteratorWithOperators) {
          a = a.map((v) => Array.isArray(v) ? v : [v])
        } else {
          a = [a]
        }
      } else {
        throw new Error(`Array accessors can only be applied to an array, found ${a}`)
      }
    }
    this.arrayStack.push(a)
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

  private _array(array: any, subscripts: any[]): IteratorWithOperators<any> {
    const values = iterate(subscripts)
      .map((s) => {
        if (FnBase._type(s) === "number") {
          return this._maybeElement(array, s)
        }
        if (s instanceof IteratorWithOperators) {
          return s.map((s1) => this._maybeElement(array, s1))
        }
        throw new Error("array accessor must be numbers")
      }).flatten()
    this.arrayStack.pop()
    return values
  }

  array(input: any, subscripts: any[]): IteratorWithOperators<any> {
    return FnBase._autoFlatMap(input, (i) => this._array(i, subscripts))
  }


  last(): number {
    const a = this.arrayStack.at(-1) as []
    return a.length - 1
  }


  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: any, to: any): IteratorWithOperators<number> {
    const start = FnBase._mustBeNumber(from, "'from'")
    const end = FnBase._mustBeNumber(to, "'to'")
    return iterate(FnBase._range(start, end))
  }


  private static _filter(filterExp: Predƒ, input: any): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return result instanceof IteratorWithOperators
        ? result.includes(Pred.TRUE)
        : result === Pred.TRUE
    } catch (e) {
      // filter silently consumes all errors
      return false
    }
  }

  filter(input: any, filterExp: Predƒ): IteratorWithOperators<any> {
    if (Array.isArray(input)) {
      input = iterate(input)
    } else if (!(input instanceof IteratorWithOperators)) {
      // must return empty iterator if nothing matches
      input = iterate([input])
    }
    return input.filter((i: any) => FnBase._filter(filterExp, i))
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
      if (pred !== Pred.TRUE) {
        return Pred.FALSE
      }
    }
    return Pred.TRUE
  }


  or(preds: Pred[]): Pred {
    for (const pred of preds) {
      if (pred === Pred.TRUE) {
        return Pred.TRUE
      }
    }
    return Pred.FALSE
  }


  exists(wff: () => SingleOrIterator<any>): Pred {
    try {
      const seq = wff()
      let value
      if (seq instanceof IteratorWithOperators) {
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
