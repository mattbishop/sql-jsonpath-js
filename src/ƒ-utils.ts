import {Temporal} from "@js-temporal/polyfill"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate.js"

import {ZonedTime} from "./json-path.ts"
import {type Mapƒ, type NumBigInt, Pred, type Seq, type SingleOrIterator} from "./types.ts"



/*
  From spec. Ij is a value to be typed.
    If Ij is an SQL/JSON null, then the Unicode character string “null”.
    If Ij is numeric, then the Unicode character string “number”.
    If Ij is a character string, then the Unicode character string “string”.
    If Ij is a Boolean, then the Unicode character string “boolean”.

    If Ij is a date, then the Unicode character string “date”.
    If Ij is a time without time zone, then the Unicode character string “time without time zone”.
    If Ij is a time with time zone, then the Unicode character string “time with time zone”.
    If Ij is a timestamp without time zone, then the Unicode character string “timestamp without time zone”.
    If Ij is a timestamp with time zone, then the Unicode character string “timestamp with time zone”.

    If Ij is array, then the Unicode character string “array”.
    If Ij is object, then the Unicode character string “object”.
 */
export function sqlType(input: unknown): string {
  if (Array.isArray(input)) {
    return "array"
  }
  if (input === null || input === undefined) {
    return "null"
  }
  // input instanceof Date would fit here, if we used it
  if (input instanceof Temporal.Instant) {
    return "timestamp with time zone"
  }
  if (input instanceof Temporal.PlainDateTime) {
    return "timestamp without time zone"
  }
  if (input instanceof ZonedTime) {
    return "time with time zone"
  }
  if (input instanceof Temporal.PlainTime) {
    return "time without time zone"
  }
  if (input instanceof Temporal.PlainDate) {
    return "date"
  }
  return typeof input
}

// SQL does not support IEEE 754 signed zero
export function sqlNum(input: NumBigInt): NumBigInt {
  return input == 0
    ? isBigInt(input) ? 0n : 0
    : input
}


export function isNumber(input: unknown): input is number {
  // SQL numbers are finite
  return Number.isFinite(input)
}

export function isString(input: unknown): input is string {
  return typeof input === "string"
}

export function isBigInt(input: unknown): input is bigint {
  return typeof input === "bigint"
}

export function isBoolean(input: unknown): input is boolean {
  return typeof input === "boolean"
}

export function isObject(input: unknown): input is Record<string, unknown> {
  return sqlType(input) === "object"
}

export function isSeq(input: unknown): input is Seq<unknown> {
  return input instanceof IteratorWithOperators
}

export function toSeq(input: unknown): Seq<unknown> {
  return isSeq(input)
    ? input.flatten()
    : iterate(Array.isArray(input) ? input : [input])
}

export function next<T>(input: SingleOrIterator<T>): T {
  return isSeq(input)
    ? input.next().value
    : input
}

export function toPred(condition: boolean): Pred {
  return condition
    ? Pred.TRUE
    : Pred.FALSE
}

export function autoMap<T>(input: SingleOrIterator<unknown>, mapƒ: Mapƒ<T>): SingleOrIterator<T> {
  return isSeq(input)
    ? input.map(mapƒ)
    : mapƒ(input)
}

export function autoFlatMap<I extends Seq<unknown>>(input: unknown, mapƒ: Mapƒ<I>): I {
  const mapped = autoMap(input, mapƒ) as I
  return isSeq(input)
    ? mapped.flatten() as I
    : mapped
}

export function mustBeNumber(input: SingleOrIterator<unknown>, method: string): number {
  const num = next<unknown>(input)
  if (isNumber(num)) {
    return sqlNum(num) as number
  }
  throw new Error(`${method} input must be a number, found ${JSON.stringify(input)}.`)
}

export function mustBeNumberOrBigInt(input: SingleOrIterator<unknown>, method: string): NumBigInt {
  const num = next<unknown>(input)
  if (isNumber(num) || isBigInt(num)) {
    return sqlNum(num)
  }
  throw new Error(`${method} input must be a number or bigint, found ${JSON.stringify(input)}.`)
}
