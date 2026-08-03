import {Temporal} from "@js-temporal/polyfill";
import {IteratorWithOperators} from "iterare/lib/iterate.js"

import {ZonedTime} from "./json-path.ts";


/** @internal */
export type NumBigInt = number | bigint

/** @internal */
export type Seq<T> = IteratorWithOperators<T>

/** @internal */
export type SingleOrIterator<T> = T | Seq<T>

/** @internal */
export type Mapƒ<T> = (input: any) => T

/** @internal */
export type Predƒ = Mapƒ<SingleOrIterator<Pred>>


/** @internal */
export enum Pred {
  TRUE = "T",
  FALSE = "F",
  UNKNOWN = "U"
}


/** @internal */
export enum TemporalTypes {
  DATE = "date",
  TIME = "time without time zone",
  TIME_TZ = "time with time zone",
  TIMESTAMP = "timestamp without time zone",
  TIMESTAMP_TZ = "timestamp with time zone",
}


/** @internal */
export type TemporalType =
  Temporal.PlainDateTime
  | Temporal.Instant            // DateTime with an offset value
  // | Temporal.ZonedDateTime   // These have named time zones like "[Pacific/Vancouver]"
  | Temporal.PlainDate
  | Temporal.PlainTime
  | ZonedTime


/** @internal */
export interface TemporalParser {
  toDate(input: string): Temporal.PlainDate

  toTime(input: string): Temporal.PlainTime

  toTimeTz(input: string): ZonedTime

  toTimestamp(input: string): Temporal.PlainDateTime

  toTimestampTz(input: string): Temporal.Instant

  toTemporal(input: string): TemporalType
}


/** @internal */
export const NO_VALUE = Symbol.for("No Value")
