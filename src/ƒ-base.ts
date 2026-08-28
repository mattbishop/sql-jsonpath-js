import {CLDR, timeRoundOptions, timestampRoundOptions} from "./datetime.ts"
import {type KeyValue} from "./json-path.ts"
import {autoFlatMap, autoMap, flatten, isIterable, isIterableInput, isSeq, next, noValueFilter, ReplayableIterable, toSeq} from "./iterators.ts"
import {
  isBigInt,
  isBoolean,
  isFunction,
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
  NO_VALUE,
  type NumBigInt,
  Pred,
  type Predƒ,
  type Seq,
  type SingleOrSeq,
  type TemporalParser,
  type TemporalType,
  TemporalTypes,
  type TimeRoundOptions,
  type TimestampRoundOptions
} from "./types.ts"


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


/** @internal */
export class ƒBase {

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
      return input.map((v) => Array.isArray(v) ? v : [v])
        .toArray()
    }
    return [input]
  }

  /**
   * Unwraps array input into an iterator and applies the mapƒ to the iterator, or to the single value.
   * In strict mode, the non-array input will throw an error if the input is not an array and fails the strict test.
   */
  private _unwrapWith<T>(input: unknown, mapƒ: Mapƒ<T>, strict?: StrictConfig): SingleOrSeq<T> {
    if (input === NO_VALUE) {
      return NO_VALUE as T
    }
    this._checkStrict(input, strict || {strict: (input) => !Array.isArray(input), error: "Cannot unwrap non-array input."})
    return isIterable(input)
      ? Iterator.from(ƒBase._mapWith(input, mapƒ))
      : mapƒ(input)
  }

  private static *_mapWith<T>(iterable:  Iterable<unknown>,
                              mapƒ:      Mapƒ<T>): Generator<T> {
    for (const element of iterable) {
      const mapped = mapƒ(element)
      if (mapped !== NO_VALUE) {
        yield mapped
      }
    }
  }


  private _unwrapWithArgs<T, A extends unknown[]>(input:    unknown,
                                                  mapƒ:     MapWithArgsƒ<T, A>,
                                                  ...args:  A): SingleOrSeq<T> {
    if (input === NO_VALUE) {
      return NO_VALUE as T
    }
    this._checkStrict(input, {strict: (input) => !Array.isArray(input), error: "Cannot unwrap non-array input."})
    return isIterable(input)
      ? Iterator.from(ƒBase._mapWithArgs(input, mapƒ, args))
      : mapƒ(input, ...args)
  }

  private static *_mapWithArgs<T, A extends unknown[]>(iterable:  Iterable<unknown>,
                                                       mapƒ:      MapWithArgsƒ<T, A>,
                                                       args:      A): Generator<T> {
    for (const element of iterable) {
      const mapped = mapƒ(element, ...args)
      if (mapped !== NO_VALUE) {
        yield mapped
      }
    }
  }


  // not a JSONPath function. Used to convert strings to numbers for math
  num(input: unknown): number {
    if (isFunction(input)) {
      input = input(this.scope.get(CURRENT_ARRAY))
    }
    return mustBeNumber(input, "arithmetic")
  }


  type(input: unknown): SingleOrSeq<string> {
    // do not unwrap input, unless it's a seq. Need type of array.
    return autoMap(input, sqlType)
  }


  private static _size(value: unknown) {
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

  bigint(input: unknown): SingleOrSeq<bigint> {
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
    return sqlNum(value)
  }

  integer(input: unknown): SingleOrSeq<number> {
    return this._unwrapWith(input, ƒBase._integer)
  }


  private static _number(input: unknown): number {
    return toNumber(input, "number")
  }

  number(input: unknown): SingleOrSeq<number> {
    return this._unwrapWith(input, ƒBase._number)
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
    return this._unwrapWithArgs(input, ƒBase._decimal, precision, scale)
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
    return this._unwrapWith(input, ƒBase._string)
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
    return this._unwrapWith(input, ƒBase._boolean)
  }

  private static _ceiling(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "ceiling")
    return isBigInt(num)
      ? num
      : sqlNum(Math.ceil(num as number))
  }

  ceiling(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._ceiling)
  }


  private static _floor(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "floor")
    return isBigInt(num)
      ? num
      : sqlNum(Math.floor(num as number))
  }

  floor(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._floor)
  }


  private static _abs(input: unknown): NumBigInt {
    const num = mustBeNumberOrBigInt(input, "abs()")
    return num < 0 ? -num : num
  }

  abs(input: unknown): SingleOrSeq<NumBigInt> {
    return this._unwrapWith(input, ƒBase._abs)
  }


  private static _date(input: unknown, parser: TemporalParser): Temporal.PlainDate {
    if (isString(input)) {
      return parser.toDate(input)
    }
    throw new Error(`date() input must be a string, found ${JSON.stringify(input)}.`)
  }

  date(input: unknown): SingleOrSeq<Temporal.PlainDate> {
    const parser = this.scope.get(CLDR) as TemporalParser
    return this._unwrapWithArgs(input, ƒBase._date, parser)
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
    return this._unwrapWithArgs(input, ƒBase._time, parser, roundOpts)
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
    return this._unwrapWithArgs(input, ƒBase._time_tz, parser, roundOpts)
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
    return this._unwrapWithArgs(input, ƒBase._timestamp, parser, roundOpts)
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
    return this._unwrapWithArgs(input, ƒBase._timestamp_tz, parser, roundOpts)
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
    return this._unwrapWithArgs(input, ƒBase._datetime, parser)
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
    return this._unwrapWith(input, mapƒ, { strict: isObject, error: "keyvalue() can only be applied to an object." })
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
    return this._unwrapWith(input, ƒBase._objectValues, { strict: isObject, error: ".* can only be applied to an object." })
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
    return this._unwrapWithArgs(input, this._member, member, this.lax)
  }


  private _maybeElement(array: Array<unknown>, pos: number): unknown {
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
        if (isFunction(sub)) {
          sub = sub(array)
        }
        if (isNumber(sub)) {
          return this._maybeElement(array, sub)
        }
        if (isSeq(sub)) {
          return sub.map((s) => this._maybeElement(array, s as number))
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


  last(array: Array<unknown>): number {
    return array.length - 1
  }


  private static *_range(start: number, end: number): Generator<number> {
    for (let i = start; i <= end; i++) {
      yield i
    }
  }

  range(from: unknown, to: unknown): (array: Array<unknown>) => Seq<number> {
    return (array) => {
      const start = isFunction(from) ? from(array) : from
      const end = isFunction(to) ? to(array) : to
      return Iterator.from(ƒBase._range(mustBeNumber(start, "'from'"), mustBeNumber(end, "'to'")))
    }
  }


  private static _matchesFilter(input: unknown, filterExp: Predƒ): boolean {
    try {
      const result = filterExp(input)
      // look for at least one Pred.TRUE in the iterator
      return isSeq(result)
        ? result.some((p) => p === Pred.TRUE)
        : result === Pred.TRUE
    } catch (e) {
      // filter silently consumes all errors
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
        : Iterator.from([])
    }

    // Strict mode preserves the current input shape. The predicate decides
    // whether the whole input survives.
    const matched = isIterableInput(input)
      ? Iterator.from(input)
          .map(matches)
          .some(Boolean)
      : matches(input)

    return matched
      ? input
      : Iterator.from([])
  }


  private static _compare(compOp: CompOp, left: any, right: any): Pred {
    // these are not comparable, even if both are NO_VALUE
    if (left === NO_VALUE || right === NO_VALUE) {
      return Pred.FALSE
    }

    const primComp = ƒBase._comparePrimitive(compOp, left, right)
    if (primComp) {
      return primComp
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

    // check that left and right can be compared
    if (typeLeft === typeRight) {
      switch (compOp) {
        case CompOp.EQ :
          return toPred(left === right)
        case CompOp.NEQ :
          return toPred(left !== right)
        case CompOp.GT :
          return toPred(left > right)
        case CompOp.GTE :
          return toPred(left >= right)
        case CompOp.LT :
          return toPred(left < right)
        case CompOp.LTE :
          return toPred(left <= right)
      }
    }
    return Pred.UNKNOWN
  }

  private static _comparePrimitive(compOp: CompOp, left: unknown, right: unknown): Pred | undefined {
    let typeLeft = typeof left
    let typeRight = typeof right

    if (   (typeLeft === "number" && !Number.isFinite(left))
        || (typeRight === "number" && !Number.isFinite(right))) {
      return Pred.UNKNOWN
    }

    if (typeLeft === "bigint") {
      typeLeft = "number"
    }
    if (typeRight === "bigint") {
      typeRight = "number"
    }

    if (typeLeft === typeRight) {
      switch (typeLeft) {
        case "number":
        case "string":
        case "boolean":
          break
        default:
          return undefined
      }

      switch (compOp) {
        case CompOp.EQ :
          // ==, not === so number and bigint can be compared
          return toPred(left == right)
        case CompOp.NEQ :
          return toPred(left != right)
        case CompOp.GT :
          //@ts-ignore
          return toPred(left > right)
        case CompOp.GTE :
          //@ts-ignore
          return toPred(left >= right)
        case CompOp.LT :
          //@ts-ignore
          return toPred(left < right)
        case CompOp.LTE :
          //@ts-ignore
          return toPred(left <= right)
      }
    }
  }

  /*
    null / not_null comparison rules
    null == not_null  -> FALSE
    null != not_null  -> TRUE
    null <> not_null  -> TRUE
   */
  private static _compareMaybeNull(compOp: CompOp, typeLeft: string, typeRight: string): Pred | undefined {
    if (typeLeft === "null" || typeRight === "null") {
      switch (compOp) {
        case CompOp.EQ :
          return toPred(typeLeft === typeRight)
        case CompOp.NEQ :
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


  private static _compareLeftIterRightIter(compOp: CompOp, left: Iterable<unknown>, right: Iterable<unknown>) {
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

  private static _compareLeftIterRight(compOp: CompOp, leftIn: Iterable<unknown>, right: unknown) {
    const leftValues = toSeq(leftIn).filter(noValueFilter)

    let hasUnknown = false
    for (const left of leftValues) {
      const result = ƒBase._compare(compOp, left, right)
      if (result === Pred.TRUE) {
        return Pred.TRUE
      }
      if (result === Pred.UNKNOWN) {
        hasUnknown = true
      }
    }
    return hasUnknown
      ? Pred.UNKNOWN
      : Pred.FALSE
  }

  private static _compareLeftRightIter(compOp: CompOp, left: unknown, right: Iterable<unknown>) {
    const rightValues = toSeq(right).filter(noValueFilter)

    let hasUnknown = false
    for (const right of rightValues) {
      const result = ƒBase._compare(compOp, left, right)
      if (result === Pred.TRUE) {
        return Pred.TRUE
      }
      if (result === Pred.UNKNOWN) {
        hasUnknown = true
      }
    }
    return hasUnknown
      ? Pred.UNKNOWN
      : Pred.FALSE
  }


  compare(compOp: CompOp, left: unknown, right: unknown): Pred {
    if (!this.lax) {
      if (Array.isArray(left)) {
        throw new Error("In 'strict' mode! left side of comparison cannot be an array.")
      }
      if (Array.isArray(right)) {
        throw new Error("In 'strict' mode! right side of comparison cannot be an array.")
      }
    }

    const leftIterable = isIterable(left)
    const rightIterable = isIterable(right)
    // skip looping
    if (!leftIterable && !rightIterable) {
      return ƒBase._compare(compOp, left, right)
    }

    if (leftIterable && !rightIterable) {
      return ƒBase._compareLeftIterRight(compOp, left, right)
    } else if (!leftIterable && rightIterable) {
      return ƒBase._compareLeftRightIter(compOp, left, right)
    }

    return ƒBase._compareLeftIterRightIter(compOp, left as Iterable<unknown>, right as Iterable<unknown>)
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

  isUnknown(input: SingleOrSeq<Pred>): SingleOrSeq<Pred> {
    return this._unwrapWith(input, ƒBase._isUnknown)
  }


  private static _startsWith(input: unknown, start: string): Pred {
    return isString(input)
      ? toPred(input.startsWith(start))
      : Pred.UNKNOWN
  }

  startsWith(input: unknown, start: string): SingleOrSeq<Pred> {
    return this._unwrapWithArgs(input, ƒBase._startsWith, start)
  }


  private static _match(input: unknown, pattern: RegExp): Pred {
    return isString(input)
      ? toPred(pattern.test(input))
      : Pred.UNKNOWN
  }

  match(input: unknown, pattern: RegExp): SingleOrSeq<Pred> {
    return this._unwrapWithArgs(input, ƒBase._match, pattern)
  }
}
