import {iterate} from "iterare"
import {isIterable} from "iterare/lib/utils.js"
import {Temporal} from "@js-temporal/polyfill"

import {CLDR} from "./datetime-parser.ts"
import {type KeyValue} from "./json-path.ts"
import {isIterableInput, noValueFilter, ReplayableIterable} from "./iterators.ts"
import {
  autoFlatMap,
  autoMap,
  isBigInt,
  isBoolean,
  isNumber,
  isObject,
  isSeq,
  isString,
  mustBeNumber,
  mustBeNumberOrBigInt,
  next,
  sqlNum,
  sqlRound,
  sqlType,
  toNumber,
  toPred,
  toSeq
} from "./ƒ-utils.ts"
import {
  type Mapƒ,
  NO_VALUE,
  type NumBigInt,
  Pred,
  type Predƒ,
  type Seq,
  type SingleOrIterator,
  type TemporalParser,
  type TemporalType,
  TemporalTypes
} from "./types.ts"


type StrictConfig = {
  strict: Mapƒ<boolean>
  error:  string
}


const KV_INDEX = "KV-index"
const EMPTY_SEQ = iterate([])
const BIGINT_MIN = -(2n ** 63n)
const BIGINT_MAX = 2n ** 63n - 1n
const INTEGER_MIN = -(2 ** 31)
const INTEGER_MAX = 2 ** 31 - 1


/** @internal */
export class ƒBase {

  constructor(private readonly lax:   boolean,
              private readonly scope: Map<string, unknown>) { }

  /**
   * Examine input with strict test, if any. Throws error if in strict mode and
   * the strictness test does not pass.
   * @param input the input to test.
   * @param config the strictness config.
   * @private
   */
  private _checkStrict(input: unknown, config: StrictConfig) {
    if (this.lax || isSeq(input)) {
      return
    }
    const {strict, error} = config
    if (!strict(input)) {
      throw new Error(`In 'strict' mode! ${error} Found: ${JSON.stringify(input)}`)
    }
  }

  /**
   * Turn any input, like an iterator, into an array. Only used in lax mode.
   * @param input The input to wrap.
   * @param strict strict config, if any.
   * @private
   */
  private _toArray(input: unknown, strict: StrictConfig): Array<unknown> {
    this._checkStrict(input, strict)
    if (Array.isArray(input)) {
      return input
    }
    if (isSeq(input)) {
      return input.map((v) => Array.isArray(v) ? v : [v])
        .toArray()
    }
    return [input]
  }

  /*
   * Unwraps array input into an iterator, and converts a non-array into a singeton iterator (lax mode only).
   * In strict mode, the non-array input will throw an error if the input is not an array and fails the strict test.
   */
  private _unwrap(input: unknown, strict: StrictConfig): Seq<unknown> {
    this._checkStrict(input, strict)
    return this.lax
      ? toSeq(input)
      : isSeq(input)
        ? input
        : iterate([input])
  }

  /*
   * If lax, iterate and apply mapƒ, otherwise just apply mapƒ.
   *
   * Different from autoMap, in that it will iterate through arrays, while autoMap only iterates over Seq, thus treating
   * arrays as a single value.
   */
  private _unwrapWith<T>(input: unknown, mapƒ: Mapƒ<T>, strict?: StrictConfig): SingleOrIterator<T> {
    if (input === NO_VALUE) {
      return NO_VALUE as T
    }
    this._checkStrict(input, strict || {strict: (input) => !Array.isArray(input), error: "Cannot unwrap non-array input."})
    return isIterable(input)
      ? iterate(input)
          .map(mapƒ)
          .filter(noValueFilter)
      : mapƒ(input)
  }


  // not a JSONPath function. Used to convert strings to numbers for math
  num(input: unknown): number {
    return mustBeNumber(input, "arithmetic")
  }


  type(input: unknown): SingleOrIterator<string> {
    // do not unwrap input, unless it's a seq. Need type of array.
    return autoMap(input, sqlType)
  }


  private static _size(value: unknown) {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: unknown): SingleOrIterator<number> {
    this._checkStrict(input, {strict: Array.isArray, error: "size() can only be applied to arrays."})
    // do not use unwrap since it must preserve Array shape for size()
    return autoMap(input, ƒBase._size)
  }


  private static _double(input: unknown): number {
    return toNumber(input, "double")
  }

  double(input: unknown): SingleOrIterator<number> {
    return this._unwrapWith(input, ƒBase._double)
  }



  private static _bigint(input: unknown): bigint {
    let value
    switch (typeof input) {
      case "number":
        value = BigInt(sqlRound(input))
        break
      case "string":
        // JSONPath has same string parse rules as JS
        value = BigInt(input as string)
        break
      case "bigint":
        value = input as bigint
        break
      default:
        throw new Error(`bigint() can only be applied to a string or numeric value: ${input}`)
    }
    if (value < BIGINT_MIN || value > BIGINT_MAX) {
      throw new Error(`value out of range for bigint(): ${value}`)
    }
    return value
  }

  bigint(input: unknown): SingleOrIterator<bigint> {
    return this._unwrapWith(input, ƒBase._bigint)
  }


  private static _integer(input: unknown): number {
    // string or number or bigint
    // needs to be a 32-bit integer, range -2147483648 to 2147483647
    let value
    switch (typeof input) {
      case "number":
        value = sqlRound(input)
        break
      case "string":
        value = Number(input)
        if (!Number.isInteger(value)) {
          // do not round decimal strings.
          throw new Error(`integer() string input cannot be a decimal value: ${input}`)
        }
        break
      case "bigint":
        value = Number(input)
        break
      default:
        throw new Error(`integer() can only be applied to a string or numeric value: ${input}`)
    }
    if (value < INTEGER_MIN || value > INTEGER_MAX) {
      throw new Error(`value out of range for integer(): ${value}`)
    }
    // SQL does not have -0
    return Object.is(value, -0) ? 0 : value
  }

  integer(input: unknown): SingleOrIterator<number> {
    return this._unwrapWith(input, ƒBase._integer)
  }


  private static _number(input: unknown): number {
    return toNumber(input, "number")
  }

  number(input: unknown): SingleOrIterator<number> {
    return this._unwrapWith(input, ƒBase._number)
  }


  private static _decimal(input: unknown, precision?: number, scale?: number): number {
    /*
      Take the input and squeeze it into the precision and scale box.
      precision is how many numbers, total, including decimal values.
      Decimal 4 means 122.4, 1.224, 12.24 are valid.
      Scale means how many decimal digits. It will add 0 to the decimal value to make it match.
      That's not something JS number can do so not relevant.
      Decimal 4, Scale 2 means 12.4 => 12.40, 1.24 => 1.24
      Scale will also round the decimal portion up to the scale:
      Decimal 4, Scale 2 means 1.245 => 1.25
      Round decimals first, then test the final number against precision.
     */
    let value = toNumber(input, "decimal")

    const hasPrecision = precision !== undefined
    // scale only considered if precision is set
    const hasScale = precision && scale !== undefined

    if (hasPrecision) {
      if (!Number.isInteger(precision) || precision < 1) {
        throw new Error(`decimal() precision must be a positive integer, found ${precision}.`)
      }
      if (hasScale && (!Number.isInteger(scale) || scale < 0 || scale > precision)) {
        throw new Error(`decimal() scale must be an integer between 0 and precision, found ${scale}.`)
      }
    }

    if (hasScale) {
      const mult = 10 ** scale
      value = sqlRound(value * mult) / mult
    } else if (hasPrecision) {
      value = sqlRound(value)
    }

    if (hasPrecision) {
      const absValue = Math.abs(value)
      const integerDigits = absValue < 1
        ? 0
        : Math.trunc(absValue).toString().length
      const maxIntegerDigits = precision - (scale ?? 0)
      if (integerDigits > maxIntegerDigits) {
        throw new Error(`value out of range for decimal(${precision}${hasScale ? `,${scale}` : ""}): ${value}`)
      }
    }

    return value
  }

  decimal(input: unknown, precision?: number, scale?: number): SingleOrIterator<number> {
    const mapƒ = (v: unknown) => ƒBase._decimal(v, precision, scale)
    return this._unwrapWith(input, mapƒ)
  }


  private static _string(input: unknown): string {
    switch (typeof input) {
      case "string":
        return input
      case "boolean":
      case "number":
      case "bigint":
        return String(input)
    }
    if (   input instanceof Temporal.Instant
        || input instanceof Temporal.PlainDateTime
        || input instanceof Temporal.PlainDate
        || input instanceof Temporal.PlainTime) {
      return input.toString()
    }
    throw new Error(`string() can only be applied to a string, boolean, numeric, or datetime value: ${JSON.stringify(input)}`)
  }

  string(input: unknown): SingleOrIterator<string> {
    return this._unwrapWith(input, ƒBase._string)
  }


  private static _boolean(input: unknown): boolean {
    if (isBoolean(input)) {
      return input
    }
    if (isString(input)) {
      if (/^(?:true|t|1|yes|y|on)$/i.test(input)) {
        return true
      }
      if (/^(?:false|f|0|no|n|off)$/i.test(input)) {
        return false
      }
    }
    else if ((isNumber(input) && Number.isInteger(input)) || isBigInt(input)) {
      return input != 0
    }
    throw new Error(`boolean() can only be applied to a boolean, string or integer value: ${JSON.stringify(input)}`)
  }

  boolean(input: unknown): SingleOrIterator<boolean> {
    return this._unwrapWith(input, ƒBase._boolean)
  }

  private static _ceiling(input: unknown): NumBigInt {
    if (isBigInt(input)) {
      return sqlNum(input)
    }
    if (isNumber(input)) {
      return sqlNum(Math.ceil(input))
    }
    throw new Error(`ceiling() input must be a number, found ${JSON.stringify(input)}.`)
  }

  ceiling(input: unknown): SingleOrIterator<NumBigInt> {
    return this._unwrapWith(input, ƒBase._ceiling)
  }


  private static _floor(input: unknown): NumBigInt {
    if (isBigInt(input)) {
      return sqlNum(input)
    }
    if (isNumber(input)) {
      return sqlNum(Math.floor(input))
    }
    throw new Error(`floor() input must be a number, found ${JSON.stringify(input)}.`)
  }

  floor(input: unknown): SingleOrIterator<NumBigInt> {
    return this._unwrapWith(input, ƒBase._floor)
  }


  private static _abs(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "abs()")
    return num < 0 ? -num : num
  }

  abs(input: unknown): SingleOrIterator<NumBigInt> {
    return this._unwrapWith(input, ƒBase._abs)
  }


  private static _date(input: unknown, parser: TemporalParser): Temporal.PlainDate {
    if (isString(input)) {
      return parser.toDate(input)
    }
    throw new Error(`date() input must be a string, found ${JSON.stringify(input)}.`)
  }

  date(input: unknown): SingleOrIterator<Temporal.PlainDate> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const mapƒ = (v: unknown) => ƒBase._date(v, parser)
    return this._unwrapWith(input, mapƒ)
  }

  private static _timeRoundOptions(precision: number): Temporal.RoundTo<"second" | "millisecond" | "microsecond" | "nanosecond"> {
    const roundingMode = "halfExpand"
    if (precision > 9) {
      throw new Error(`time() precision must be an integer between 0 and 9, found ${precision}.`)
    }
    if (precision === 0) {
      return { smallestUnit: "second", roundingMode }
    }
    if (precision <= 3) {
      return {
        smallestUnit: "millisecond",
        roundingIncrement: 10 ** (3 - precision),
        roundingMode
      }
    }
    if (precision <= 6) {
      return {
        smallestUnit: "microsecond",
        roundingIncrement: 10 ** (6 - precision),
        roundingMode
      }
    }
    return {
      smallestUnit: "nanosecond",
      roundingIncrement: 10 ** (9 - precision),
      roundingMode
    }
  }

  private static _time(input: unknown, parser: TemporalParser, precision?: number): Temporal.PlainTime {
    if (isString(input)) {
      let time = parser.toTime(input)
      if (precision !== undefined) {
        time = time.round(this._timeRoundOptions(precision))
      }
      return time
    }
    throw new Error(`time() input must be a string, found ${JSON.stringify(input)}.`)
  }


  // cannot accept time zones, must throw an error:
  // > SELECT jsonb_path_query('"2020-01-01T02:11:18.0214-02:00"'::JSONB, '$.time()');
  // ERROR: cannot convert value from timestamptz to time without time zone usage
  time(input: unknown, precision?: number): SingleOrIterator<Temporal.PlainTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const mapƒ = (v: unknown) => ƒBase._time(v, parser, precision)
    return this._unwrapWith(input, mapƒ)
  }


  private static _time_tz(input: unknown, parser: TemporalParser, precision?: number): Temporal.PlainTime {
    if (isString(input)) {
      let time = parser.toTimeTz(input)
      if (precision !== undefined) {
        time = time.round(this._timeRoundOptions(precision))
      }
      return time
    }
    throw new Error(`time() input must be a string, found ${JSON.stringify(input)}.`)
  }

  // returns the time value in UTC, so calculates the effect of the time zone
  // > SELECT jsonb_path_query('"2020-01-01T02:11:18.0214-02:00"'::JSONB, '$.time_tz()');
  // "04:11:18.0214+00:00"
  // It converts to UTC time and returns that
  time_tz(input: unknown, precision?: number): SingleOrIterator<Temporal.PlainTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const mapƒ =  (v: unknown) => ƒBase._time_tz(v, parser, precision)
    return this._unwrapWith(input, mapƒ)
  }


  private static _timestampRoundOptions(precision: number): Temporal.RoundTo<"day" | "hour" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond"> {
    if (precision > 9) {
      throw new Error(`timestamp() precision must be an integer between 0 and 9, found ${precision}.`)
    }
    const roundingMode = "halfExpand"
    if (precision === 0) {
      return { smallestUnit: "day", roundingMode }
    }
    if (precision <= 2) {
      return {
        smallestUnit: "hour",
        roundingIncrement: 10 ** (2 - precision),
        roundingMode
      }
    }
    if (precision <= 4) {
      return {
        smallestUnit: "minute",
        roundingIncrement: 10 ** (4 - precision),
        roundingMode
      }
    }
    if (precision <= 6) {
      return {
        smallestUnit: "second",
        roundingIncrement: 10 ** (6 - precision),
        roundingMode
      }
    }
    if (precision === 7) {
      return { smallestUnit: "millisecond", roundingMode }
    }
    if (precision === 8) {
      return { smallestUnit: "microsecond", roundingMode }
    }
    return { smallestUnit: "nanosecond", roundingMode }
  }


  private static _timestamp(input: unknown, parser: TemporalParser, precision?: number): Temporal.PlainDateTime {
    if (isString(input)) {
      let timestamp = parser.toTimestamp(input)
      if (precision !== undefined) {
        timestamp = timestamp.round(this._timestampRoundOptions(precision))
      }
      return timestamp
    }
    throw new Error(`timestamp() input must be a string, found ${JSON.stringify(input)}.`)
  }

  timestamp(input: unknown, precision?: number): SingleOrIterator<Temporal.PlainDateTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const mapƒ = (v: unknown) => ƒBase._timestamp(v, parser, precision)
    return this._unwrapWith(input, mapƒ)
  }

  private static _timestampTzRoundOptions(precision: number): Temporal.RoundTo<"second" | "millisecond" | "microsecond" | "nanosecond"> {
    if (precision > 9) {
      throw new Error(`timestamp_tz() precision must be an integer between 0 and 9, found ${precision}.`)
    }
    const roundingMode = "halfExpand"
    if (precision === 0) {
      return { smallestUnit: "second", roundingMode }
    }
    if (precision <= 3) {
      return {
        smallestUnit: "millisecond",
        roundingIncrement: 10 ** (3 - precision),
        roundingMode
      }
    }
    if (precision <= 6) {
      return {
        smallestUnit: "microsecond",
        roundingIncrement: 10 ** (6 - precision),
        roundingMode
      }
    }
    return {
      smallestUnit: "nanosecond",
      roundingIncrement: 10 ** (9 - precision),
      roundingMode
    }
  }


  private static _timestamp_tz(input: unknown, parser: TemporalParser, precision?: number): Temporal.Instant {
    if (isString(input)) {
      let timestamp = parser.toTimestampTz(input)
      if (precision !== undefined) {
        timestamp = timestamp.round(this._timestampTzRoundOptions(precision))
      }
      return timestamp
    }
    throw new Error(`timestamp() input must be a string, found ${JSON.stringify(input)}.`)
  }

  timestamp_tz(input: unknown, precision?: number): SingleOrIterator<Temporal.Instant> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const mapƒ = (v: unknown) => ƒBase._timestamp_tz(v, parser, precision)
    return this._unwrapWith(input, mapƒ)
  }


  /*
    The result type of the datetime() and datetime(template) methods can be date, time_tz, time, timestamp_tz, or timestamp.
    Both methods determine their result type dynamically.

    The datetime() method sequentially tries to match its input string to the ISO formats for date, time_tz, time,
    timestamp_tz, and timestamp. It stops on the first matching format and emits the corresponding data type.

    The datetime(template) method determines the result type according to the fields used in the provided template string.

    The datetime() and datetime(template) methods use the same parsing rules as the to_timestamp SQL function does (see
    Section 9.8), with three exceptions:

    1. These methods don't allow unmatched template patterns.
    2. Only the following separators are allowed in the template string: minus sign, period, solidus (slash), comma, apostrophe,
       semicolon, colon and space.
    3. Separators in the template string must exactly match the input string.

    If different date/time types need to be compared, an implicit cast is applied. A date value can be cast to timestamp
    or timestamp_tz, timestamp can be cast to timestamp_tz, and time to time_tz. However, all but the first of these
    conversions depend on the current TimeZone setting, and thus can only be performed within timezone-aware jsonpath
    functions. Similarly, other date/time-related methods that convert strings to date/time types also do this casting,
    which may involve the current TimeZone setting. Therefore, these conversions can also only be performed within
    timezone-aware jsonpath functions.
   */
  private static _datetime(input: unknown, parser: TemporalParser): TemporalType {
    if (isString(input)) {
      return parser.toTemporal(input)
    }
    throw new Error(`datetime() input must be a string, found ${JSON.stringify(input)}.`)
  }

  datetime(input: unknown, template: string): SingleOrIterator<TemporalType> {
    const parser = this.scope.get(template ?? CLDR) as TemporalParser
    const mapƒ = (v: unknown) => ƒBase._datetime(v, parser)
    return this._unwrapWith(input, mapƒ)
  }


  private static _toKV(obj: Record<string, unknown>, id: number): Seq<KeyValue> {
    return iterate(Object.keys(obj))
      .map((key) => ({id, key, value: obj[key]}))
  }

  keyvalue(input: unknown): Seq<KeyValue> {
    const mapƒ = (row: unknown) => {
      if (isObject(row)) {
        const id = this.scope.get(KV_INDEX) as number ?? 0
        // Loop back around to 0
        this.scope.set(KV_INDEX, id === Number.MAX_SAFE_INTEGER ? 0 : id + 1)
        return ƒBase._toKV(row, id)
      }
      throw new Error(`keyvalue() input must be an object, found ${JSON.stringify(row)}.`)
    }
    return this._unwrap(input, { strict: isObject, error: "keyvalue() can only be applied to an object." })
      .map(mapƒ)
      .flatten()
  }

  private static _objectValues(input: unknown): Iterator<unknown> {
    return isObject(input)
      ? iterate(Object.values(input))
      : EMPTY_SEQ
  }

  private _dotStar(input: unknown): Seq<unknown> {
    return this._unwrap(input, { strict: isObject, error: ".* can only be applied to an object." })
        .map(ƒBase._objectValues)
        .flatten()
  }

  dotStar(input: unknown): Seq<unknown> {
    return autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: unknown): Seq<unknown> {
    // [*] is not the same as unwrap, which always turns the array into a seq in lax mode.
    this._checkStrict(input, {strict: Array.isArray, error: "[*] can only be applied to an array."})
    return toSeq(input)
  }

  boxStar(input: unknown): Seq<unknown> {
    // need the function so _checkStrict has a defined this
    return autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _member(obj: unknown, member: string): unknown {
    if (isObject(obj) && obj.hasOwnProperty(member)) {
      return obj[member]
    }
    if (this.lax) {
      return NO_VALUE
    }
    throw new Error(`Object does not contain key '${member}'. In strict mode.`)
  }

  member(input: unknown, member: string): SingleOrIterator<unknown> {
    const mapƒ = (i: unknown) => this._member(i, member)
    return this._unwrapWith(input, mapƒ)
  }


  private _maybeElement(array: Array<unknown>, pos: number): unknown {
    if (pos < array.length) {
      const value = array[pos]
      return Array.isArray(value)
        ? [value]
        : value
    }
    if (this.lax) {
      return NO_VALUE
    }
    throw new Error (`Array subscript [${pos}] is out of bounds. In 'strict' mode.`)
  }

  private _array(input: unknown, subscripts: any[]): Seq<any> {
    const array = this._toArray(input, {strict: Array.isArray, error: "Array accessors can only be applied to an array."})
    return iterate(subscripts)
      .map((sub) => {
        if (isNumber(sub)) {
          return this._maybeElement(array, sub)
        }
        if (typeof sub === "function") {
          return this._maybeElement(array, sub(array))
        }
        if (isSeq(sub)) {
          return sub.map((s) => this._maybeElement(array, s as number))
        }
        throw new Error("array accessor must be numbers")
      })
      .flatten()
  }

  array(input: unknown, subscripts: unknown[]): Seq<any> {
    return autoFlatMap(input, (i) => this._array(i, subscripts))
  }


  last(array: Array<unknown>): number {
    return array.length - 1
  }


  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: unknown, to: unknown): Seq<number> {
    const start = mustBeNumber(from, "'from'")
    const end = mustBeNumber(to, "'to'")
    return iterate(ƒBase._range(start, end))
  }


  private static _matchesFilter(input: unknown, filterExp: Predƒ): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return isSeq(result)
        ? result.includes(Pred.TRUE)
        : result === Pred.TRUE
    } catch (e) {
      // filter silently consumes all errors
      return false
    }
  }

  filter(input: unknown, filterExp: Predƒ): Seq<unknown> {
    const matches = (v: unknown) => ƒBase._matchesFilter(v, filterExp)

    if (this.lax) {
      return toSeq(input).filter(matches)
    }

    const matched = isIterableInput(input)
      ? iterate(input)
          .map(matches)
          .some(Boolean)
      : matches(input)

    return toSeq(matched ? [input] : [])
  }


  private static _compare(compOp: string, left: any, right: any): Pred {
    // these are not comparable, even if both are NO_VALUE
    if (left === NO_VALUE || right === NO_VALUE) {
      return Pred.FALSE
    }

    let typeLeft = sqlType(left)
    let typeRight = sqlType(right)

    const nullComp = ƒBase._compareMaybeNull(compOp, typeLeft, typeRight)
    if (nullComp) {
      return nullComp
    }

    if (this._areTemporalComparable(typeLeft, typeRight)) {
      left = ƒBase._toTemporalComparable(left)
      right = ƒBase._toTemporalComparable(right)
      typeLeft = typeRight = "temporal"
    }
    if (typeLeft === "bigint") {
      typeLeft = "number"
    }
    if (typeRight === "bigint") {
      typeRight = "number"
    }

    // check that left and right can be compared
    if (typeLeft === typeRight) {
      switch (compOp) {
        case "==" :
          // use ==, not === so that number and bigint will compare
          return toPred(left == right)
        case "<>" :
        case "!=" :
          return toPred(left !== right)
        case ">" :
          return toPred(left > right)
        case ">=" :
          return toPred(left >= right)
        case "<" :
          return toPred(left < right)
        case "<=" :
          return toPred(left <= right)
      }
    }
    return Pred.UNKNOWN
  }

  /*
    null / not_null comparison rules
    null == not_null  -> FALSE
    null != not_null  -> TRUE
    null <> not_null  -> TRUE
   */
  private static _compareMaybeNull(compOp: string, typeLeft: string, typeRight: string): Pred | undefined {
    if (typeLeft === "null" || typeRight === "null") {
      switch (compOp) {
        case "==" :
          return toPred(typeLeft === typeRight)
        case "<>" :
        case "!=" :
          return toPred(typeLeft !== typeRight)
        default:
          return Pred.UNKNOWN
      }
    }
  }


  /*
      COMPARABLE:
      * date and timestamp
      * date and datetime
      * datetime and timestamp

      NOT COMPARABLE:
      * date and timestamp_tz
      * date and time
      * date and time_tz
      * time and time_tz
  */
  private static _areTemporalComparable(typeLeft: string, typeRight: string): boolean {
    if (typeLeft === typeRight
        && (typeLeft === "date" || typeLeft.startsWith("time"))) {
      return true
    }
    const leftIsComparable = typeLeft === TemporalTypes.DATE
      || typeLeft === TemporalTypes.TIMESTAMP

    const rightIsComparable = typeRight === TemporalTypes.DATE
      || typeRight === TemporalTypes.TIMESTAMP

    return leftIsComparable && rightIsComparable
  }

  private static _toTemporalComparable(temporal: Temporal.PlainDate | Temporal.PlainDateTime): string {
    if (temporal instanceof Temporal.PlainDate) {
      temporal = Temporal.PlainDateTime.from(temporal)
    }
    return temporal.toString()
  }


  compare(compOp: string, left: unknown, right: unknown): Pred {
    if (!this.lax) {
      if (Array.isArray(left)) {
        throw new Error("In 'strict' mode! left side of comparison cannot be an array.")
      }
      if (Array.isArray(right)) {
        throw new Error("In 'strict' mode! right side of comparison cannot be an array.")
      }
    }

    // skip looping
    if (!isIterable(left) && !isIterable(right)) {
      return ƒBase._compare(compOp, left, right)
    }

    const leftValues = toSeq(left).filter(noValueFilter)
    const rightValues = new ReplayableIterable(toSeq(right).filter(noValueFilter))
    let hasUnknown = false
    for (const l of leftValues) {
      for (const r of rightValues) {
        const result = ƒBase._compare(compOp, l, r)
        if (result === Pred.TRUE) {
          return Pred.TRUE
        }
        if (result === Pred.UNKNOWN) {
          hasUnknown = true
        }
      }
    }
    return hasUnknown
      ? Pred.UNKNOWN
      : Pred.FALSE
  }


  not(input: any): Pred {
    return input === Pred.TRUE
      ? Pred.FALSE
      : input === Pred.FALSE
        ? Pred.TRUE
        : Pred.UNKNOWN
  }

  /**
   * Walk through an array of Preds and look for a specific value. Handles UNKNOWN rules.
   * @param preds array of preds to examine
   * @param seek  sought-after pred value
   * @param defaultPred return this if none found, or UNKNOWN if found
   */
  private static _seekPred(preds:       SingleOrIterator<Pred>[],
                           seek:        Pred,
                           defaultPred: Pred): Pred {
    let hasUnknown = false
    for (const pred of preds) {
      const value = next(pred)
      if (value === seek) {
        return seek
      }
      if (value === Pred.UNKNOWN) {
        hasUnknown = true
      }
    }
    return hasUnknown
      ? Pred.UNKNOWN
      : defaultPred
  }

  and(preds: SingleOrIterator<Pred>[]): Pred {
    return ƒBase._seekPred(preds, Pred.FALSE, Pred.TRUE)
  }


  or(preds: Pred[]): Pred {
    return ƒBase._seekPred(preds, Pred.TRUE, Pred.FALSE)
  }


  exists(wff: () => SingleOrIterator<unknown>): Pred {
    try {
      const result = wff()
      let value
      if (isSeq(result)) {
        const next = result.next()
        value = next.done
          ? NO_VALUE
          : next.value
      } else {
        value = result
      }
      return toPred(value !== NO_VALUE)
    } catch (e) {
      return Pred.UNKNOWN
    }
  }


  private static _isUnknown(input: Pred): Pred {
    return toPred(input === Pred.UNKNOWN)
  }

  isUnknown(input: SingleOrIterator<Pred>): SingleOrIterator<Pred> {
    return this._unwrapWith(input, ƒBase._isUnknown)
  }


  private static _startsWith(input: unknown, start: string): Pred {
    return isString(input)
      ? toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: unknown, start: string): SingleOrIterator<Pred> {
    return this._unwrapWith(input, (i) => ƒBase._startsWith(i, start))
  }


  private static _match(input: unknown, pattern: RegExp): Pred {
    return isString(input)
      ? toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input: unknown, pattern: RegExp): SingleOrIterator<Pred> {
    return this._unwrapWith(input, (i) => ƒBase._match(i, pattern))
  }
}
