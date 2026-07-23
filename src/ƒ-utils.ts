import {Temporal} from "@js-temporal/polyfill"
import {IteratorWithOperators} from "iterare/lib/iterate.js"

import {ZonedTime} from "./json-path.ts"


export type NumBigInt = number | bigint

export type Seq<T> = IteratorWithOperators<T>

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

export function isNumber(input: unknown): input is number {
  return typeof input === "number"
}

export function isString(input: unknown): input is string {
  return typeof input === "string"
}

export function isBigInt(input: unknown): input is bigint {
  return typeof input === "bigint"
}

export function isNumberOrString(input: unknown): boolean {
  return typeof input === "number" || typeof input === "string"
}

export function isNumberOrStringOrBigInt(input: unknown): boolean {
  return typeof input === "number" || typeof input === "string" || typeof input === "bigint"
}

export function isObject(input: unknown): input is Record<string, unknown> {
  return sqlType(input) === "object"
}

export function isSeq(input: unknown): input is Seq<unknown> {
  return input instanceof IteratorWithOperators
}
