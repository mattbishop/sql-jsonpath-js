export type NamedVariables = Record<string, any>

/**
 * Configuration object for the value() method.
 */
export type ValueConfig = {
  /**
   * When an input does not match the SQL JSONPath statement, return this value instead.
   */
  defaultOnEmpty?:  unknown

  /**
   * In strict mode, when Errors occur during matching, catch the error and return this value instead.
   */
  defaultOnError?:  unknown

  /**
   * Named variables to use in the SQL JSONPath evaluation.
   */
  namedVariables?:  NamedVariables
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
   * SQL JSONPath statement source.
   */
  source: string

  /**
   * Statement mode, either 'lax' or 'strict'. In 'strict' mode, missing data, type mismatches and other structural
   * differences between the SQL JSONPath statement and the input will be thrown as Errors.
   *
   * In 'lax' mode, structural errors and type mismatches are ignored. Furthermore, inputs are auto-wrapped to
   * single-element arrays, or unwrapped to single values in order to attempt a match.
   */
  mode:   Mode

  /**
   * Determines if JSON input matches the SQL JSONPath statement.
   *
   * @param input A single value, an iterable of values or a value iterator.
   * @param namedVariables Named variables to use in the SQL JSONPath evaluation.
   */
  exists<T>(input: Input<T>, namedVariables?: NamedVariables): Iterator<boolean>

  /**
   * Filters the JSON input by matching the SQL JSONPath statement. Returns inputs that match.
   *
   * @param input A single value, an iterable of values or a value iterator.
   * @param namedVariables Named variables to use in the SQL JSONPath evaluation.
   */
  query<T>(input: Input<T>, namedVariables?: NamedVariables): Iterator<T>

  /**
   * Searches the JSON input for values that match the SQL JSONPath statement, returning the extracted value
   * when found.
   *
   * @param input A single value, an iterable of values or a value iterator.
   * @param config Contains default values for misses and errors as well as named variables to use in the
   * SQL JSONPath evaluation.
   */
  value<T>(input: Input<T>, config?: ValueConfig): Iterator<unknown>
}


