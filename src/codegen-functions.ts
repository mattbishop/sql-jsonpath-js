import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {DateTime, FixedOffsetZone} from "luxon"
import {KeyValue} from "./json-path"


const EMPTY = Object.freeze([])

function _type(primary: any): string {
  return Array.isArray(primary)
    ? "array"
    : primary === null
      ? "null"
      : typeof primary
}

function _toKV(primary: Record<string, any>, id: number): IteratorWithOperators<KeyValue> {
  return iterate(Object.keys(primary))
    .map((key) => ({id, key, value: primary[key]}))
}

function _maybeMember(primary: Record<string, any>, member: string): IteratorWithOperators<any> {
  let v = primary[member]
  if (v === undefined) {
    v = EMPTY
  } else if (Array.isArray(v) && v.length === 0) {
    // an empty array is an iterator, so flatten() will erase it from the sequence.
    v = [v]
  }
  return v
}


export const codegenFunctions = {

  type(seq: IteratorWithOperators<any>): IteratorWithOperators<string> {
    return seq.map(_type)
  },


  size(seq: IteratorWithOperators<any>): IteratorWithOperators<number> {
    return seq.map((primary) => Array.isArray(primary) ? primary.length : 1);
  },


  double(seq: IteratorWithOperators<any>): IteratorWithOperators<number> {
    return seq.map((primary) => {
      const type = _type(primary)
      if (type !== "number" && type !== "string") {
        throw new Error(`double() value must be a number or string, found ${JSON.stringify(primary)}.`)
      }
      const n = Number(primary)
      if (Number.isNaN(n)) {
        throw new Error(`double() param ${primary} is not a representation of a number.`)
      }
      return n
    })
  },


  ceiling(seq: IteratorWithOperators<any>): IteratorWithOperators<number> {
    return seq.map((primary) => {
      if (typeof primary !== "number") {
        throw new Error(`$ceiling() param must be a number, found ${JSON.stringify(primary)}.`)
      }
      return Math.ceil(primary)
    })
  },


  floor(seq: IteratorWithOperators<any>): IteratorWithOperators<number> {
    return seq.map(primary => {
      if (typeof (primary) !== "number") {
        throw new Error(`floor() param must be a number, found ${JSON.stringify(primary)}.`)
      }
      return Math.floor(primary)
    })
  },


  abs(seq: IteratorWithOperators<any>): IteratorWithOperators<number> {
    return seq.map((primary) => {
      if (typeof primary !== "number") {
        throw new Error(`abs() param must be a number, found ${JSON.stringify(primary)}.`)
      }
      return Math.abs(primary)
    })
  },


  datetime(seq: IteratorWithOperators<any>, template?: string): IteratorWithOperators<Date> {
    return seq.map((primary) => {
      if (typeof primary !== "string") {
        throw new Error(`datetime() param must be a string, found ${JSON.stringify(primary)}.`)
      }
      return template
        ? DateTime.fromFormat(primary, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
        : new Date(primary)
    })
  },


  keyvalue(seq: IteratorWithOperators<any>, lax: boolean): IteratorWithOperators<KeyValue> {
    return seq.map((primary) => {
      const type = _type(primary)
      if (lax) {
        if (type !== "object" && type !== "array") {
          throw new Error(`keyvalue() param must be an object or array (in lax mode), found ${JSON.stringify(primary)}.`)
        }
        if (Array.isArray(primary)) {
          let id = 0
          return iterate(primary)
            .map((row) => {
              if (_type(row) !== "object") {
                throw new Error(`keyvalue() array must have object values, found ${JSON.stringify(row)}.`)
              }
              return _toKV(row, id++)
            }).flatten()
        }
      } else { // strict
        if (type !== "object") {
          throw new Error(`keyvalue() param must be an object but is an array (in strict mode), found ${JSON.stringify(primary)}.`)
        }
      }
      return _toKV(primary, 0)
    }).flatten()
  },


  dotStar(seq: IteratorWithOperators<any>, lax: boolean): IteratorWithOperators<any> {
    return seq.map((primary) => {
      const type = _type(primary)
      if (!lax && type !== "object") {
        throw new Error(`.* can only be applied to an object in strict mode, found ${JSON.stringify(primary)}.`)
      }
      if (type === "object") {
        return Object.values(primary)
      } else if (type === "array") {
        return iterate(primary)
          .filter((o) => _type(o) === "object")
          .map((obj) => iterate(Object.values(obj as object)))
          .flatten()
      }
      return EMPTY
    }).flatten()
  },


  boxStar(seq: IteratorWithOperators<any>, lax: boolean): IteratorWithOperators<any> {
    return seq.map((primary) => {
      if (!lax && _type(primary) !== "array") {
        throw new Error(`[*] can only be applied to an array in strict mode, found ${JSON.stringify(primary)}.`)
      }
      return primary
    }).flatten()
  },


  member(seq: IteratorWithOperators<any>, member: string, lax: boolean): IteratorWithOperators<any> {
    return seq.map((primary) => {
      const type = _type(primary)
      if (!lax && type !== "object") {
        throw new Error(`."${member}" can only be applied to an object in strict mode, found ${JSON.stringify(primary)}.`)
      }
      if (type === "object") {
        return _maybeMember(primary, member)
      } else if (type === "array") {
        return iterate(primary)
          .filter((o) => _type(o) === "object")
          .map((obj) => _maybeMember(obj as Record<string, any>, member))
      }
      return EMPTY
    }).flatten()  // flatten erases the empty sequences
  }
}
