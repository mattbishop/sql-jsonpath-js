import {IteratorWithOperators} from "iterare/lib/iterate.js";


export type Seq<T> = IteratorWithOperators<T>

export type NumBigInt = number | bigint


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

export function isSeq(input: unknown): input is Seq<unknown> {
  return input instanceof IteratorWithOperators
}
