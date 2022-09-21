import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"



const EMPTY = iterate(Object.freeze([]))


// Lives outside of class so function refs can use this without bind(this)
function _type(primary: any): string {
  return Array.isArray(primary)
    ? "array"
    : primary === null
      ? "null"
      : typeof primary
}


type SingleOrIterator<T> = T | IteratorWithOperators<T>


export class CodegenBase {

  // stack
  $$a: [][]
  lax: boolean

  constructor(lax: boolean) {
    this.$$a = []
    this.lax = lax
  }

  private _autoMapWithFlatten<I extends IteratorWithOperators<unknown>>(input: any, mapƒ: (value: any) => I): I {
    const mapped = this._autoMap(input, mapƒ) as I
    return input instanceof IteratorWithOperators
      ? mapped.flatten() as I
      : mapped
  }

  private _autoMap<T>(input: any, mapƒ: (value: any) => T): SingleOrIterator<T> {
    return input instanceof IteratorWithOperators
      ? input.map(mapƒ)
      : mapƒ(input)
  }


  type(input: any): SingleOrIterator<string> {
    return this._autoMap(input, _type)
  }


  private _size(value: any) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._size);
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
    if (typeof input !== "number") {
      throw new Error(`$ceiling() param must be a number, found ${JSON.stringify(input)}.`)
    }
    return Math.ceil(input)
  }

  ceiling(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._ceiling)
  }


  private _floor(input: any): number {
    if (typeof (input) !== "number") {
      throw new Error(`floor() param must be a number, found ${JSON.stringify(input)}.`)
    }
    return Math.floor(input)
  }

  floor(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._floor)
  }


  private _abs(input: any): number {
    if (typeof input !== "number") {
      throw new Error(`abs() param must be a number, found ${JSON.stringify(input)}.`)
    }
    return Math.abs(input)
  }

  abs(input: any): SingleOrIterator<number> {
    return this._autoMap(input, this._abs)
  }


  private _datetime(input: any, template?: string): Date {
    if (typeof input !== "string") {
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

  private _keyvalue(input: any): IteratorWithOperators<KeyValue> {
    const type = _type(input)
    if (type === "object") {
      return this._toKV(input, 0)
    }
    if (!this.lax) {
      throw new Error(`keyvalue() param must be an object but is an array (in strict mode), found ${JSON.stringify(input)}.`)
    }
    if (Array.isArray(input)) {
      let id = 0
      return iterate(input)
        .map((row) => {
          if (_type(row) !== "object") {
            // Only sequence one level of an array.
            throw new Error(`keyvalue() array must have object values, found ${JSON.stringify(row)}.`)
          }
          return this._toKV(row, id++)
        })
        .flatten()
    }
    throw new Error(`keyvalue() param must be an object or array (in lax mode), found ${JSON.stringify(input)}.`)
  }

  keyvalue(input: any): IteratorWithOperators<KeyValue> {
    return this._autoMapWithFlatten(input, (i) => this._keyvalue(i))
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
    return this._autoMapWithFlatten(input, (i) => this._dotStar(i))
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
    return this._autoMapWithFlatten(input, (i) => this._boxStar(i))
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


  pa(a: any) {
    if (!Array.isArray(a)) {
      if (this.lax) {
        // lax mode auto-wraps things that are not an array
        a = [a]
      } else {
        throw new Error(`Array accessors can only be applied to an array, found ${a}`)
      }
    }
    this.$$a.push(a)
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
        if (typeof s === "number") {
          return this._maybeElement(array, s)
        }
        if (s instanceof IteratorWithOperators) {
          return s.map(s1 => this._maybeElement(array, s1))
        }
        throw new Error("array accessor must be numbers")
      }).flatten()
    this.$$a.pop()
    return values
  }

  array(input: any, subscripts: any[]): IteratorWithOperators<any> {
    return this._autoMapWithFlatten(input, (i) => this._array(i, subscripts))
  }

  last(): number {
    const a = this.$$a.at(-1) as []
    return a.length - 1
  }


  private _toNumber(value: any): number {
    if (typeof value === "number") {
      return value
    }

    let num
    if (value instanceof IteratorWithOperators) {
      num = value.next().value
    }
    if (typeof num === "number") {
      return num
    }
    throw new Error (`array accessor range must be a number: ${num}`)
  }

  private *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i;
    }
  }

  range(from: any, to: any): IteratorWithOperators<number> {
    const start = this._toNumber(from)
    const end = this._toNumber(to)
    return iterate(this._range(start, end))
  }
}
