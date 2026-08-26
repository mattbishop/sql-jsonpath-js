import {ZonedTime} from "./json-path.ts"


/** @internal */
export type NumBigInt = number | bigint

/**
 * Shorter version of the type for code clarity.
 * @internal
 */
export type Seq<T> = IteratorObject<T>

/** @internal */
export type SingleOrSeq<T> = T | Seq<T>

/** @internal */
export type Mapƒ<T> = (input: any) => T

/** @internal */
export type MapWithArgsƒ<T, A extends unknown[]> = (input: unknown, ...args: A) => T

/** @internal */
export type Predƒ = Mapƒ<SingleOrSeq<Pred>>


/** @internal */
export const NO_VALUE = Symbol.for("No Value")

/** @internal */
export enum Pred {
  TRUE = "T",
  FALSE = "F",
  UNKNOWN = "U"
}

/** @internal */
export enum CompOp {
  EQ,
  NEQ,
  GT,
  GTE,
  LT,
  LTE
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
