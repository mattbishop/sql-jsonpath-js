export type NamedVariables = Record<string, any>

/**
 * Configuration object for the statement method.
 */
export type StatementConfig<DEFAULT = unknown> = {
  /**
   * When an input does not match the SQL JSONPath statement, return this value instead.
   */
  defaultOnEmpty?:  DEFAULT

  /**
   * When Errors occur during matching, catch the error and return this value instead.
   */
  defaultOnError?:  DEFAULT

  /**
   * Variables to use in the SQL JSONPath evaluation.
   */
  variables?:  NamedVariables
}


export type Mode = "strict" | "lax"

export type Input<T> = T | Iterable<T> | Iterator<T>

export type KeyValue = {
  id:     number
  key:    string
  value:  unknown
}

export interface SqlJsonPathStatement {

  /**
   * Statement mode, either 'lax' or 'strict'. In 'strict' mode, missing data, type mismatches and other structural
   * differences between the SQL JSONPath statement and the input will be thrown as Errors.
   *
   * In 'lax' mode, structural errors and type mismatches are ignored. Furthermore, inputs are auto-wrapped to
   * single-element arrays, or unwrapped to value sequences in order to attempt a match.
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
   * @param input A single value, an iterable of values or a value iterator.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  exists<T>(input: Input<T>, config?: StatementConfig<boolean>): IterableIterator<boolean>

  /**
   * Filters the JSON input by matching the SQL JSONPath statement. Returns inputs that match.
   *
   * @param input A single value, an iterable of values or a value iterator.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  query<T>(input: Input<T>, config?: StatementConfig<T>): IterableIterator<T>

  /**
   * Searches the JSON input for values that match the SQL JSONPath statement, returning the extracted values
   * when found.
   *
   * @param input A single value, an iterable of values or a value iterator.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  values<T>(input: Input<T>, config?: StatementConfig): IterableIterator<unknown>
}


