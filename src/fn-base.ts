import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"


const EMPTY = iterate(Object.freeze([]))

enum Pred {
  TRUE,
  FALSE,
  UNKNOWN
}

type Mapƒ<T> = (input: any) => T

type Predƒ = Mapƒ<SingleOrIterator<Pred>>


// Lives outside of class so function refs can use this without bind(this)
function _type(primary: any): string {
  return Array.isArray(primary)
    ? "array"
    : primary === null
      ? "null"
      : typeof primary
}

function _mustBeNumber(input: any, method: string): number {
  if (_type(input) === "number") {
    return input
  }

  let num
  if (input instanceof IteratorWithOperators) {
    num = input.next().value
  }
  if (_type(num) === "number") {
    return num
  }
  throw new Error(`${method} param must be a number, found ${JSON.stringify(input)}.`)
}

function _toPred(condition: boolean): Pred {
  return condition
    ? Pred.TRUE
    : Pred.FALSE
}


type SingleOrIterator<T> = T | IteratorWithOperators<T>


export class FnBase {

  arrayStack: [][]
  lax:        boolean

  constructor(lax: boolean) {
    this.arrayStack = []
    this.lax = lax
  }

  private _autoFlatMap<I extends IteratorWithOperators<unknown>>(input: any, mapƒ: Mapƒ<I>): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return input instanceof IteratorWithOperators
      ? mapped.flatten() as I
      : mapped
  }

  private _autoMap<T>(input: any, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
    return input instanceof IteratorWithOperators
      ? input.map(mapƒ)
      : mapƒ(input)
  }


  type(input: any): SingleOrIterator<string> {
    return this._autoMap(input, _type)
  }


  num(input: any): number {
    return _mustBeNumber(input, "arithmetic")
  }


  private _size(value: any) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._size)
  }


  private _double(input: any): number {
    const type = _type(input)
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
    return this._autoMap(input, this._double)
  }


  private _ceiling(input: any): number {
    return Math.ceil(_mustBeNumber(input, "ceiling()"))
  }

  ceiling(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._ceiling)
  }


  private _floor(input: any): number {
    return Math.floor(_mustBeNumber(input, "floor()"))
  }

  floor(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._floor)
  }


  private _abs(input: any): number {
    return Math.abs(_mustBeNumber(input, "abs()"))
  }

  abs(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._abs)
  }


  private _datetime(input: any, template?: string): Date {
    if (_type(input) !== "string") {
      throw new Error(`datetime() param must be a string, found ${JSON.stringify(input)}.`)
    }
    return template
      ? DateTime.fromFormat(input, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
      : new Date(input)
  }

  datetime(input: any, template?: string): SingleOrIterator<Date> {
    return this._autoMap(input, (v: any) => this._datetime(v, template))
  }


  private _toKV(obj: Record<string, any>, id: number): IteratorWithOperators<KeyValue> {
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
      if (_type(row) !== "object") {
        // Only sequence one level of an array.
        throw new Error(`keyvalue() param must have object values, found ${JSON.stringify(row)}.`)
      }
      return this._toKV(row, id++)
    }
    return this._autoFlatMap(input, mapƒ)
  }


  private _dotStar(input: any): IteratorWithOperators<any> {
    const type = _type(input)
    if (type === "object") {
      return iterate(Object.values(input))
    }

    if (!this.lax) {
      throw new Error(`.* can only be applied to an object in strict mode, found ${JSON.stringify(input)}.`)
    }
    if (type === "array") {
      return iterate(input)
        .filter((o) => _type(o) === "object")
        .map((obj) => Object.values(obj as object))
        .flatten()
    }
    return EMPTY
  }

  dotStar(input: any): IteratorWithOperators<any> {
    return this._autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: any): IteratorWithOperators<any> {
    if (Array.isArray(input)) {
      return iterate(input)
    }
    if (!this.lax) {
      throw new Error(`[*] can only be applied to an array in strict mode, found ${JSON.stringify(input)}.`)
    }
    return iterate([input])
  }

  boxStar(input: any): IteratorWithOperators<any> {
    return this._autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _maybeMember(obj: Record<string, any>, member: string): any {
    if (obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return EMPTY
    }
    throw new Error(`Object does not contain key ${member}, in strict mode.`)
  }

  private _member(input: any, member: string): any {
    const type = _type(input)
    if (type === "object") {
      return this._maybeMember(input, member)
    }
    if (!this.lax) {
      throw new Error(`."${member}" can only be applied to an object in strict mode, found ${JSON.stringify(input)}.`)
    }
    if (type === "array") {
      return iterate(input)
        .filter((o) => _type(o) === "object")
        .map((obj) => this._maybeMember(obj as Record<string, any>, member))
    }
    return EMPTY
  }

  member(input: any, member: string): SingleOrIterator<any> {
    return this._autoMap(input, (i) => this._member(i, member))
  }


  // called to set the array for the accessor statements to use it before going into array()
  pa(a: any) {
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
      return EMPTY
    }
    throw new Error (`array subscript [${pos}] is out of bounds.`)
  }

  private _array(array: any, subscripts: any[]): IteratorWithOperators<any> {
    const values = iterate(subscripts)
      .map((s) => {
        if (_type(s) === "number") {
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
    return this._autoFlatMap(input, (i) => this._array(i, subscripts))
  }


  last(): number {
    const a = this.arrayStack.at(-1) as []
    return a.length - 1
  }


  private *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: any, to: any): IteratorWithOperators<number> {
    const start = _mustBeNumber(from, "'from'")
    const end = _mustBeNumber(to, "'to'")
    return iterate(this._range(start, end))
  }


  private _filter(filterExp: Predƒ, input: any): boolean {
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
    }
    if (!(input instanceof IteratorWithOperators)) {
      // must return empty iterator if nothing matches
      input = iterate([input])
    }
    return input.filter((i: any) => this._filter(filterExp, i))
  }


  private _compare(compOp: string, left: any, right: any): Pred {
    // check that left and right can be compared
    const typeLeft = _type(left)
    const typeRight = _type(right)
    if (typeLeft === typeRight) {
      switch (compOp) {
        case "==" :
          return _toPred(left === right)
        case "<>" :
        case "!=" :
          return _toPred(left !== right)
        case ">" :
          return _toPred(left > right)
        case ">=" :
          return _toPred(left >= right)
        case "<" :
          return _toPred(left < right)
        case "<=" :
          return _toPred(left <= right)
      }
    }
    return Pred.UNKNOWN
  }

  compare(compOp: string, left: any, right: any): SingleOrIterator<Pred> {
    return this._autoMap(left, (l) => this._compare(compOp, l, right))
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
      const exists = seq instanceof IteratorWithOperators
        ? !!seq.next().done
        : seq !== EMPTY
      return _toPred(exists)
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
  private _isUnknown(input: Pred): Pred {
    return _toPred(input === Pred.UNKNOWN)
  }

  isUnknown(input: SingleOrIterator<Pred>): SingleOrIterator<Pred> {
    return this._autoMap(input, (i) => this._isUnknown(i))
  }


  private _startsWith(input: any, start: string): Pred {
    return _type(input) === "string"
      ? _toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: any, start: string): SingleOrIterator<Pred> {
    return this._autoMap(input, (i) => this._startsWith(i, start))
  }


  private _like(input: any, pattern: RegExp): Pred {
    return _type(input) === "string"
      ? _toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  like(input:any, pattern: RegExp): SingleOrIterator<Pred> {
    return this._autoMap(input, (i) => this._like(i, pattern))
  }
}
