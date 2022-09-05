import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"



export const codegenFunctions = {
  type(primary: any): string {
    return Array.isArray(primary)
      ? "array"
      : primary === null
        ? "null"
        : typeof primary
  },

  size(primary: any): number {
    return Array.isArray(primary) ? primary.length : 1
  },

  double(primary: any): number {
    if (typeof primary !== "number" && typeof primary !== "string") {
      throw new Error(`double() value must be a number or string, found ${JSON.stringify(primary)}.`)
    }
    const n = Number(primary)
    if (Number.isNaN(n)) {
      throw new Error(`double() param ${primary} is not a representation of a number.`)
    }
    return n
  },

  ceiling(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`$ceiling() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.ceil(primary)
  },

  floor(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`floor() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.floor(primary)
  },

  abs(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`abs() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.abs(primary)
  },

  keyvalue(primary: any, lax: boolean): KeyValue[] {
    if (typeof primary !== "object") {
      throw new Error(`keyvalue() param must be an object or array of objects (only in lax mode), found ${JSON.stringify(primary)}.`)
    }
    if (Array.isArray(primary)) {
      if (!lax) {
        throw new Error(`keyvalue() param must be an object but is an array (in strict mode), found ${JSON.stringify(primary)}.`)
      }
      return primary.reduce((acc, row, id) => {
        acc.push(...this._toKV(row, id))
        return acc
      }, [])
    }
    return this._toKV(primary, 0)
  },

  _toKV(primary: object, id: number): KeyValue[] {
    return Object.entries(primary).map(([key, value]) => ({id, key, value}))
  },

  datetime(primary: any, template?: string): Date {
    if (typeof primary !== "string") {
      throw new Error(`datetime() param must be a string, found ${JSON.stringify(primary)}.`)
    }
    return template
      ? DateTime.fromFormat(primary, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
      : new Date(primary)
  },

  dotStar(primary: any, lax: boolean): any {
    const type = this.type(primary)
    if (!lax && type !== "object") {
      throw new Error(`.* can only be applied to an object in strict mode, found ${JSON.stringify(primary)}.`)
    }
    let result
    if (type === "object") {
      result = Object.values(primary)
    } else if (type === "array") {
      result = primary
        .filter((o: any) => this.type(o) === "object")
        .flatMap(Object.values)
    }
    if (result && result.length) {
      return result
    }
  }
}
