import {Temporal} from "@js-temporal/polyfill";

/**
 * Declared variable values for SQL JSONPath evaluation.
 */
export type NamedVariables = Record<string, any>

/**
 * Configuration object for statement methods.
 */
export type StatementConfig = {

  /**
   * Variables to use in the SQL JSONPath evaluation.
   */
  variables?:  NamedVariables
}


/**
 * Configuration object for the values() method.
 */
export type ValuesConfig<DEFAULT = unknown> = StatementConfig & {
  /**
   * When an input does not match the SQL JSONPath statement, return this value instead.
   */
  defaultOnEmpty?:  DEFAULT

  /**
   * When Errors occur during matching, catch the error and return this value instead.
   */
  defaultOnError?:  DEFAULT
}


export type Mode = "strict" | "lax"

export type Input<T = unknown> = T | Iterable<T> | Iterator<T>

export type KeyValue = {
  id:     number
  key:    string
  value:  unknown
}


/**
 * Instance of a compiled Sql/JsonPath statement. Can be reused to interpret JSON data.
 */
export interface SqlJsonPathStatement {

  /**
   * Statement mode, either 'lax' or 'strict'. In 'strict' mode, missing data, type mismatches, and other structural
   * differences between the SQL JSONPath statement and the input will be thrown as Errors.
   *
   * In 'lax' mode, structural errors and type mismatches are ignored. Furthermore, inputs are auto-wrapped to
   * single-element arrays or unwrapped to value sequences to attempt a match.
   */
  mode: Mode

  /**
   * SQL JSONPath statement source.
   */
  source: string

  /**
   * Generated JS function source.
   */
  fnSource: string

  /**
   * Determines if JSON input matches the SQL JSONPath statement.
   *
   * @param input A single value. Arrays are treated as a single value.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  exists(input: Input, config?: StatementConfig): boolean | IterableIterator<boolean>

  /**
   * Searches the JSON input for values that match the SQL JSONPath statement, returning the extracted values
   * when found.
   *
   * @template T The element type of the values sequence.
   * @param input A single value or an iterator of values. Arrays are treated as a single value.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  values<T>(input: Input, config?: ValuesConfig<T>): IterableIterator<T>
}


/**
 * Represents a Sql JSONPath 'time with time zone' object. Not something Temporal supports.
 * Instances of this will be converted to UTC time zone, the declared time zone is not preserved at this time.
 */
export class ZonedTime extends Temporal.PlainTime {
  static override from(input:     Temporal.PlainTime | Temporal.PlainTimeLike | string,
                       options?:  Temporal.AssignmentOptions): ZonedTime {
    const time = typeof input === "string"
      ? Temporal.PlainTime.from(input, options)
      : input
    return new ZonedTime(
      time.hour,
      time.minute,
      time.second,
      time.millisecond,
      time.microsecond,
      time.nanosecond
    )
  }

  toString(options?: Temporal.ToStringPrecisionOptions): string {
    return super.toString(options) + "Z"
  }
}
