import {CLDR, timeRoundOptions, timestampRoundOptions} from "./datetime.ts"
import {type KeyValue, MissingVariableError} from "./json-path.ts"
import {
  autoFlatMap,
  autoMap,
  EMPTY_ITERATOR,
  flatten,
  isIterable,
  isIterableInput,
  isSeq,
  next,
  noValueFilter,
  one,
  ReplayableIterable
} from "./iterators.ts"
import {
  hasValue,
  isBigInt,
  isBoolean,
  isFunction,
  isNotArray,
  isNumber,
  isObject,
  isString,
  mustBeNumber,
  mustBeNumberOrBigInt,
  sqlNum,
  sqlRound,
  sqlType,
  toNumber,
  toPred
} from "./ƒ-utils.ts"
import {
  CompOp,
  type MapWithArgsƒ,
  type Mapƒ,
  type Maybe,
  NO_VALUE,
  type NumBigInt,
  Pred,
  type Predƒ,
  type Seq,
  type SingleOrSeq,
  type TemporalParser,
  type TemporalType,
  type TimeRoundOptions,
  type TimestampRoundOptions
} from "./types.ts"
import {compareValues} from "./compare.ts"


type StrictConfig = {
  strict: Mapƒ<boolean>
  error:  string
}


const KV_INDEX = "KV-index"
const CURRENT_ARRAY = "current-array"
const BIGINT_MIN = -(2n ** 63n)
const BIGINT_MAX = 2n ** 63n - 1n
const INTEGER_MIN = -(2 ** 31)
const INTEGER_MAX = 2 ** 31 - 1

const RANGE = Symbol.for("*range")


/** @internal */
export class ƒBase {

  /**
    Indicates if the current statement execution is a query() or exists() call.
   */
  inQuery = true


  constructor(private readonly lax:   boolean,
              private readonly scope: Map<string, unknown>) { }

  /**
   * Examine input with strict test, if any. Throws error if in strict mode and
   * the strictness test does not pass.
   * @param input the input to test.
   * @param config the strictness config.
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

  private _toArray(input: unknown, strict: StrictConfig): Array<unknown> {
    this._checkStrict(input, strict)
    if (Array.isArray(input)) {
      return input
    }
    if (isSeq(input)) {
      //faster than input.map()
      const array = []
      for (const element of input) {
        array.push(Array.isArray(element) ? element : [element])
      }
      return array
    }
    return [input]
  }

  /**
   * Unwraps array input into an iterator and applies the mapƒ to the iterator, or to the single value.
   * In strict mode, the non-array input will throw an error if the input is not an array and fails the strict test.
   */
  private _unwrapWith<T>(input: unknown, mapƒ: Mapƒ<T>, filter: boolean, strict?: StrictConfig): SingleOrSeq<T> {
    if (input === NO_VALUE) {
      return NO_VALUE as T
    }
    this._checkStrict(input, strict ?? {strict: isNotArray, error: "Cannot unwrap non-array input."})
    return isIterable(input)
      ? Iterator.from(ƒBase._mapWith(input, mapƒ, filter))
      : mapƒ(input)
  }

  private static *_mapWith<T>(iterable: Iterable<unknown>,
                              mapƒ:     Mapƒ<T>,
                              filter:  boolean): Generator<T> {
    for (const element of iterable) {
      if (element === NO_VALUE && filter) {
        continue
      }
      const mapped = mapƒ(element)
      if (mapped === NO_VALUE && filter) {
        continue
      }
      yield mapped
    }
  }


  private _unwrapWithArgs<T, A extends unknown[]>(input:    unknown,
                                                  mapƒ:     MapWithArgsƒ<T, A>,
                                                  filter:   boolean,
                                                  ...args:  A): SingleOrSeq<T> {
    if (input === NO_VALUE) {
      return NO_VALUE as T
    }
    this._checkStrict(input, {strict: isNotArray, error: "Cannot unwrap non-array input."})
    return isIterable(input)
      ? Iterator.from(ƒBase._mapWithArgs(input, mapƒ, filter, args))
      : mapƒ(input, ...args)
  }

  private static *_mapWithArgs<T, A extends unknown[]>(iterable:  Iterable<unknown>,
                                                       mapƒ:      MapWithArgsƒ<T, A>,
                                                       filter:    boolean,
                                                       args:      A): Generator<T> {
    for (const element of iterable) {
      if (element === NO_VALUE && filter) {
        continue
      }
      const mapped = mapƒ(element, ...args)
      if (mapped === NO_VALUE && filter) {
        continue
      }
      yield mapped
    }
  }


  private static _num(input: unknown, suppress: boolean): Maybe<number> {
    return mustBeNumber(input, "arithmetic", suppress)
  }

  // not a JSONPath function. Used to convert strings to numbers for math
  num(input: unknown): SingleOrSeq<Maybe<number>> {
    if (isFunction(input)) {
      input = input(this.scope.get(CURRENT_ARRAY))
    }
    return this._unwrapWithArgs(input, ƒBase._num, !this.inQuery, !this.inQuery && this.lax)
  }


  calc(op: string, leftIn: unknown, rightIn: unknown): SingleOrSeq<Maybe<number>> {
    const left = this.num(leftIn)
    const right = this.num(rightIn)

    const leftIterable = isSeq(left)
    const rightIterable = isSeq(right)

    if (!leftIterable && !rightIterable) {
      return ƒBase._calcPair(op, left, right)
    }
    if (leftIterable && !rightIterable) {
      return left.map((l) => ƒBase._calcPair(op, l, right))
    }
    if (!leftIterable && rightIterable) {
      return right.map((r) => ƒBase._calcPair(op, left, r))
    }
    //both are iterable
    const rightValues = new ReplayableIterable((right as Seq<number>))
    return (left as Seq<number>)
      .flatMap((l) => Iterator.from(rightValues)
        .map((r) => ƒBase._calcPair(op, l, r)))
  }

  private static _calcPair(op: string, left: Maybe<number>, right: Maybe<number>): number {
    if (left === NO_VALUE) {
      throw new Error(`left operand of jsonpath operator ${op} is not a value`)
    }
    if (right === NO_VALUE) {
      throw new Error(`right operand of jsonpath operator ${op} is not a value`)
    }

    switch (op) {
      case "+":
        return left + right
      case "-":
        return left - right
      case "/":
        return left / right
      case "*":
        return left * right
      case "%":
        return left % right
      default:
        throw new Error(`${op} is not a valid calc operation`)
    }
  }


  private static _neg(input: unknown, suppress: boolean): Maybe<number> {
    const num = mustBeNumber(input, "negation", suppress)
    return num === NO_VALUE ? num : sqlNum(-num)
  }

  neg(input: unknown): SingleOrSeq<Maybe<number>> {
    return this._unwrapWithArgs(input, ƒBase._neg, !this.inQuery, !this.inQuery && this.lax)
  }


  private static _pos(input: unknown, suppress: boolean): Maybe<number> {
    return mustBeNumber(input, "positive", suppress)
  }

  pos(input: unknown): SingleOrSeq<Maybe<number>> {
    return this._unwrapWithArgs(input, ƒBase._pos, !this.inQuery, !this.inQuery && this.lax)
  }


  type(input: unknown): SingleOrSeq<string> {
    // do not unwrap input, unless it's a seq. Need type of array.
    return autoMap(input, sqlType)
  }


  private static _size(value: unknown): number {
    return Array.isArray(value)
      ? value.length
      : 1
  }

  size(input: unknown): SingleOrSeq<number> {
    this._checkStrict(input, {strict: Array.isArray, error: "size() can only be applied to arrays."})
    // do not use unwrap since it must preserve Array shape for size()
    return autoMap(input, ƒBase._size)
  }


  private static _double(input: unknown): number {
    return toNumber(input, "double")
  }

  double(input: unknown): SingleOrSeq<number> {
    return this._unwrapWith(input, ƒBase._double, !this.inQuery)
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

  bigint(input: unknown): SingleOrSeq<bigint> {
    return this._unwrapWith(input, ƒBase._bigint, !this.inQuery)
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
    return sqlNum(value)
  }

  integer(input: unknown): SingleOrSeq<number> {
    return this._unwrapWith(input, ƒBase._integer, !this.inQuery)
  }


  private static _number(input: unknown): number {
    return toNumber(input, "number")
  }

  number(input: unknown): SingleOrSeq<number> {
    return this._unwrapWith(input, ƒBase._number, !this.inQuery)
  }


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
  private static _decimal(input: unknown, precision?: number, scale?: number): number {
    let value = toNumber(input, "decimal")

    const hasPrecision = precision !== undefined
    // scale only considered if precision is set
    const hasScale = precision && scale !== undefined

    if (hasScale) {
      if (!Number.isInteger(scale) || scale < 0 || scale > precision) {
        throw new Error(`decimal() scale must be an integer between 0 and precision, found ${scale}.`)
      }
      const mult = 10 ** scale
      value = sqlRound(value * mult) / mult
    } else if (hasPrecision) {
      // only round if scale is not set
      value = sqlRound(value)
    }

    if (hasPrecision) {
      if (!Number.isInteger(precision) || precision < 1) {
        throw new Error(`decimal() precision must be a positive integer, found ${precision}.`)
      }
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

  decimal(input: unknown, precision?: number, scale?: number): SingleOrSeq<number> {
    return this._unwrapWithArgs(input, ƒBase._decimal, true, precision, scale)
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

  string(input: unknown): SingleOrSeq<string> {
    return this._unwrapWith(input, ƒBase._string, !this.inQuery)
  }


  private static _boolean(input: unknown): boolean {
    if (isBoolean(input)) {
      return input
    }
    if (isString(input)) {
      switch (input.toLowerCase()) {
        case "true":
        case "t":
        case "1":
        case "yes":
        case "y":
        case "on":
          return true
        case "false":
        case "f":
        case "0":
        case "no":
        case "n":
        case "off":
          return false
      }
    }
    else if ((isNumber(input) && Number.isInteger(input)) || isBigInt(input)) {
      return input != 0
    }
    throw new Error(`boolean() can only be applied to a boolean, string or integer value: ${JSON.stringify(input)}`)
  }

  boolean(input: unknown): SingleOrSeq<boolean> {
    return this._unwrapWith(input, ƒBase._boolean, true)
  }

  private static _ceiling(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "ceiling")
    return isBigInt(num)
      ? num
      : sqlNum(Math.ceil(num as number))
  }

  ceiling(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._ceiling, !this.inQuery)
  }


  private static _floor(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "floor")
    return isBigInt(num)
      ? num
      : sqlNum(Math.floor(num as number))
  }

  floor(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._floor, !this.inQuery)
  }


  private static _abs(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "abs()")
    return num < 0 ? -num : num
  }

  abs(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._abs, !this.inQuery)
  }


  private static _date(input: unknown, parser: TemporalParser): Temporal.PlainDate {
    if (isString(input)) {
      return parser.toDate(input)
    }
    throw new Error(`date() input must be a string, found ${JSON.stringify(input)}.`)
  }

  date(input: unknown): SingleOrSeq<Temporal.PlainDate> {
    const parser = this.scope.get(CLDR) as TemporalParser
    return this._unwrapWithArgs(input, ƒBase._date, !this.inQuery, parser)
  }


  private static _time(input: unknown, parser: TemporalParser, roundOpts?: TimeRoundOptions): Temporal.PlainTime {
    if (isString(input)) {
      let time = parser.toTime(input)
      if (roundOpts) {
        time = time.round(roundOpts)
      }
      return time
    }
    throw new Error(`time() input must be a string, found ${JSON.stringify(input)}.`)
  }


  // cannot accept time zones, must throw an error:
  // > SELECT jsonb_path_query('"2020-01-01T02:11:18.0214-02:00"'::JSONB, '$.time()');
  // ERROR: cannot convert value from timestamptz to time without time zone usage
  time(input: unknown, precision?: number): SingleOrSeq<Temporal.PlainTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const roundOpts = timeRoundOptions(precision)
    return this._unwrapWithArgs(input, ƒBase._time, !this.inQuery, parser, roundOpts)
  }


  private static _time_tz(input: unknown, parser: TemporalParser, roundOpts?: TimeRoundOptions): Temporal.PlainTime {
    if (isString(input)) {
      let time = parser.toTimeTz(input)
      if (roundOpts) {
        time = time.round(roundOpts)
      }
      return time
    }
    throw new Error(`time() input must be a string, found ${JSON.stringify(input)}.`)
  }

  // returns the time value in UTC, so calculates the effect of the time zone
  // > SELECT jsonb_path_query('"2020-01-01T02:11:18.0214-02:00"'::JSONB, '$.time_tz()');
  // "04:11:18.0214+00:00"
  // It converts to UTC time and returns that
  time_tz(input: unknown, precision?: number): SingleOrSeq<Temporal.PlainTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const roundOpts = timeRoundOptions(precision)
    return this._unwrapWithArgs(input, ƒBase._time_tz, !this.inQuery, parser, roundOpts)
  }


  private static _timestamp(input: unknown, parser: TemporalParser, roundOpts?: TimestampRoundOptions): Temporal.PlainDateTime {
    if (isString(input)) {
      let timestamp = parser.toTimestamp(input)
      if (roundOpts) {
        timestamp = timestamp.round(roundOpts)
      }
      return timestamp
    }
    throw new Error(`timestamp() input must be a string, found ${JSON.stringify(input)}.`)
  }

  timestamp(input: unknown, precision?: number): SingleOrSeq<Temporal.PlainDateTime> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const roundOpts = timestampRoundOptions(precision)
    return this._unwrapWithArgs(input, ƒBase._timestamp, !this.inQuery, parser, roundOpts)
  }


  private static _timestamp_tz(input: unknown, parser: TemporalParser, roundOpts?: TimeRoundOptions): Temporal.Instant {
    if (isString(input)) {
      let timestamp = parser.toTimestampTz(input)
      if (roundOpts) {
        timestamp = timestamp.round(roundOpts)
      }
      return timestamp
    }
    throw new Error(`timestamp() input must be a string, found ${JSON.stringify(input)}.`)
  }

  timestamp_tz(input: unknown, precision?: number): SingleOrSeq<Temporal.Instant> {
    const parser = this.scope.get(CLDR) as TemporalParser
    const roundOpts = timeRoundOptions(precision)
    return this._unwrapWithArgs(input, ƒBase._timestamp_tz, !this.inQuery, parser, roundOpts)
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

  datetime(input: unknown, template: string): SingleOrSeq<TemporalType> {
    const parser = this.scope.get(template ?? CLDR) as TemporalParser
    return this._unwrapWithArgs(input, ƒBase._datetime, !this.inQuery, parser)
  }


  private static *_toKV(obj: Record<string, unknown>, id: number): Generator<KeyValue> {
    for (const key in obj)
      if (Object.hasOwn(obj, key)) {
        yield {id, key, value: obj[key]}
      }
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
    return this._unwrapWith(input, mapƒ, !this.inQuery, { strict: isObject, error: "keyvalue() can only be applied to an object." })
      .flatMap<KeyValue>(flatten)
  }

  private static *_objectValues(input: unknown): Generator<unknown> {
    if (isObject(input)) {
      for (const key in input) {
        if (Object.hasOwn(input, key)) {
          yield input[key]
        }
      }
    }
  }

  private _dotStar(input: unknown): Seq<unknown> {
    return this._unwrapWith(input, ƒBase._objectValues, !this.inQuery, { strict: isObject, error: ".* can only be applied to an object." })
      .flatMap(flatten)
  }

  dotStar(input: unknown): Seq<unknown> {
    return autoFlatMap(input, (i) => this._dotStar(i))
  }


  private _boxStar(input: unknown): SingleOrSeq<unknown> {
    // [*] is not the same as unwrap. [*] always turns the array into a seq.
    this._checkStrict(input, {strict: Array.isArray, error: "[*] can only be applied to an array."})
    return Array.isArray(input)
      ? Iterator.from(input)
      : input
  }

  boxStar(input: unknown): SingleOrSeq<unknown> {
    return autoFlatMap(input, (i) => this._boxStar(i))
  }


  private _member(obj: unknown, member: string, lax: boolean): unknown {
    if (isObject(obj) && Object.hasOwn(obj, member)) {
      return obj[member]
    }
    if (lax) {
      return NO_VALUE
    }
    throw new Error(`Object does not contain key '${member}'. In strict mode.`)
  }

  member(input: unknown, member: string): SingleOrSeq<unknown> {
    return this._unwrapWithArgs(input, this._member, !this.inQuery, member, this.lax)
  }


  private _maybeElement(array: Array<unknown>, pos: number): unknown {
    if (pos > INTEGER_MAX) {
      throw new Error ("Array subscript is out of integer range.")
    }
    if (pos > -1 && pos < array.length) {
      return array[pos]
    }
    if (this.lax) {
      return NO_VALUE
    }
    throw new Error (`Array subscript [${pos}] is out of bounds. In 'strict' mode.`)
  }

  private _array(input: unknown, subscripts: unknown[]): Seq<unknown> {
    const array = this._toArray(input, {strict: Array.isArray, error: "Array accessors can only be applied to an array."})
    return Iterator.from(subscripts)
      .map((sub) => {
        // range function generates a sequence of array positions
        if (ƒBase.isRangeFunction(sub)) {
          return sub(array)
            .map((s: number) => this._maybeElement(array, s))
        }
        if (isFunction(sub)) {
          sub = sub(array)
        }
        if (isNumber(sub)) {
          return this._maybeElement(array, sub)
        }
        if (isSeq(sub)) {
          // not a range query, can only be one element
          const s = one(sub)
          if (isNumber(s) && sub.next().done) {
            return this._maybeElement(array, s)
          }
          throw new Error("array subscript must be single numeric value")
        }
        throw new Error("array accessor must be numbers")
      })
      .flatMap(flatten)
  }

  array(input: unknown): (subscripts: unknown[]) => Seq<unknown> {
    const oldArray = this.scope.get(CURRENT_ARRAY)
    this.scope.set(CURRENT_ARRAY, input)
    return (subs) => {
      const result = autoFlatMap(input, (arr) => this._array(arr, subs))
      this.scope.set(CURRENT_ARRAY, oldArray)
      return result
    }
  }


  last(array?: unknown): unknown {
    if (array === undefined) {
      array = this.scope.get(CURRENT_ARRAY) as []
    }
    if (Array.isArray(array)) {
      return array.length - 1
    }
    if (isIterable(array)) {
      return (arr: unknown) => this.last(arr)
    }
    // scalar values are auto-wrapped, so their last position is 0
    return 0
  }


  private static isRangeFunction(input: unknown): input is Function {
    // @ts-ignore
    return input[RANGE]
  }

  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: unknown, to: unknown): (array: Array<unknown>) => Seq<number> {
    const rangeƒ = (array: unknown[]) => {
      const start = isFunction(from) ? from(array) : from
      const end = isFunction(to) ? to(array) : to
      return Iterator.from(ƒBase._range(
        Math.floor(mustBeNumber(start, "'from'") as number),
        Math.floor(mustBeNumber(end, "'to'") as number)))
    }
    // mark the function so it can be identified later as a range generator.
    rangeƒ[RANGE] = true
    return rangeƒ
  }


  private static _matchesFilter(input: unknown, filterExp: Predƒ): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return isSeq(result)
        ? result.some((p) => p === Pred.TRUE)
        : result === Pred.TRUE
    } catch (err) {
      // filter silently consumes most errors
      if (err instanceof MissingVariableError) {
        throw err
      }
      return false
    }
  }

  filter(input: unknown, filterExp: Predƒ): SingleOrSeq<unknown> {
    const matches = (v: unknown) => ƒBase._matchesFilter(v, filterExp)

    if (this.lax) {
      // Lax mode auto-unwraps arrays/sequences, so the filter keeps the
      // individual values that match the predicate.
      if (Array.isArray(input)) {
        return Iterator.from(input)
          .filter(matches)
      }
      if (isSeq(input)) {
        return input
          .flatMap(flatten)
          .filter(matches)
      }
      // scalar value
      return matches(input)
        ? input
        : EMPTY_ITERATOR
    }

    // Strict mode preserves the current input shape. The predicate decides
    // whether the whole input survives.
    let matched
    if (isIterableInput(input)) {
      for (const element of input) {
        if (matches(element)) {
          matched = element
          break
        }
      }
    } else if (matches(input)) {
      matched = input
    }

    return matched ?? EMPTY_ITERATOR
  }


  compare(compOp: CompOp, left: unknown, right: unknown): Pred {
    return compareValues(this.lax, compOp, left, right)
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
  private static _seekPred(preds:       SingleOrSeq<Pred>[],
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

  and(preds: SingleOrSeq<Pred>[]): Pred {
    return ƒBase._seekPred(preds, Pred.FALSE, Pred.TRUE)
  }


  or(preds: Pred[]): Pred {
    return ƒBase._seekPred(preds, Pred.TRUE, Pred.FALSE)
  }


  exists(wff: () => SingleOrSeq<unknown>): Pred {
    try {
      const result = wff()
      return toPred(hasValue(result, this.lax))
    } catch {
      return Pred.UNKNOWN
    }
  }


  private static _isUnknown(input: Pred): Pred {
    return toPred(input === Pred.UNKNOWN)
  }

  isUnknown(input: SingleOrSeq<Pred>): SingleOrSeq<Pred> {
    return this._unwrapWith(input, ƒBase._isUnknown, !this.inQuery)
  }


  private static _startsWith(input: unknown, start: string): Pred {
    return isString(input)
      ? toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: unknown, start: string): SingleOrSeq<Pred> {
    return this._unwrapWithArgs(input, ƒBase._startsWith, !this.inQuery, start)
  }


  private static _match(input: unknown, pattern: RegExp): Pred {
    return isString(input)
      ? toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input: unknown, pattern: RegExp): SingleOrSeq<Pred> {
    return this._unwrapWithArgs(input, ƒBase._match, !this.inQuery, pattern)
  }
}
