import {ZonedTime} from "./json-path.ts"
import {type TemporalParser, type TemporalType, TemporalTypes, type TimeRoundOptions, type TimestampRoundOptions} from "./types.ts"


/**
 * Constant for Unicode CLDR spec to parse strings into date / time objects.
 * @internal
 */
export const CLDR = "CLDR"

type StringToTemporal = (input: string) => TemporalType

const parserCache: Map<string, TemporalParser> = new Map()

/**
 * Creates a function that parses an input string into a Temporal type. The input strings
 * can either follow the Unicode CLDR spec, or a template passed into this function.
 *
 * @internal
 * @param template a SQL:2023 template string for parsing input into Temporal values, or "CLDR" for CLDR spec strings.
 */
export function buildTemporalParser(template?: string): TemporalParser {
  const key = template ?? CLDR
  // don't use Map.getOrInsertComputed() because it can clear the map while creating new entry
  let temporalParser = parserCache.get(key)
  if (!temporalParser) {
    const parser = template
      ? createFormattedParser(template)
      : parseTemporalString

    temporalParser = {
      toTemporal:     (i) => parser(i),
      toDate:         (i) => _toDate(parser, i),
      toTime:         (i) => _toTime(parser, i),
      toTimeTz:       (i) => _toTimeTz(parser, i),
      toTimestamp:    (i) => _toTimestamp(parser, i),
      toTimestampTz:  (i) => _toTimestampTz(parser, i)
    }

    // flush the cache if it caches a lot of templates.
    if (parserCache.size > 1000) {
      parserCache.clear()
    }
    parserCache.set(key, temporalParser)
  }
  return temporalParser
}


function _toDate(parser: StringToTemporal, input: string): Temporal.PlainDate {
  const value = parser(input)
  if (value instanceof Temporal.PlainDate) {
    return value
  }
  if (value instanceof Temporal.PlainDateTime) {
    return value.toPlainDate()
  }
  // not allowed to convert zoned timestamp to date
  throw new Error(`Cannot convert input to a date: "${input}"`)
}

function _toTime(parser: StringToTemporal, input: string): Temporal.PlainTime {
  const value = parser(input)
  // not allowed to convert zoned time to time
  if (value instanceof Temporal.PlainTime && !(value instanceof ZonedTime)) {
    return value
  }
  if (value instanceof Temporal.PlainDateTime) {
    return value.toPlainTime()
  }
  throw new Error(`Cannot convert input to a time: "${input}"`)
}

function _toTimeTz(parser: StringToTemporal, input: string): ZonedTime {
  const value = parser(input)
  if (value instanceof ZonedTime) {
    return value
  }
  if (value instanceof Temporal.Instant) {
    return ZonedTime.from(value.toZonedDateTimeISO("UTC"))
  }
  throw new Error(`Cannot convert input to a time with time zone: "${input}"`)
}

function _toTimestamp(parser: StringToTemporal, input: string): Temporal.PlainDateTime {
  const value = parser(input)
  if (value instanceof Temporal.PlainDateTime) {
    return value
  }
  if (value instanceof Temporal.PlainDate) {
    return value.toPlainDateTime()
  }
  throw new Error(`Cannot convert input to a datetime: "${input}"`)
}

function _toTimestampTz(parser: StringToTemporal, input: string): Temporal.Instant {
  const value = parser(input)
  if (value instanceof Temporal.Instant) {
    return value
  }
  throw new Error(`Cannot convert the string to an instant: "${input}"`)
}


/*
 * SQL:2023 Standard Patterns (ISO/IEC 9075-2 2023 Sections 9.50 - 9.52)
 * NOTE: the standard is strict and does not allow quoted strings
 *
 * Explicit field mapping for Regex construction.
 * FF1-FF9 capture exact digit counts to maintain nanosecond integrity.
 */
const FIELD_TO_REGEX: Record<string, string> = {
  "YYYY":   "(?<year>\\d{4})",
  "YYY":    "(?<year_short>\\d{3})",
  "YY":     "(?<year_short>\\d{2})",
  "Y":      "(?<year_short>\\d{1})",
  "RRRR":   "(?<year>\\d{4})",
  "RR":     "(?<year_short>\\d{2})",
  "MM":     "(?<month>\\d{2})",
  "DDD":    "(?<day_of_year>\\d{3})",
  "DD":     "(?<day>\\d{2})",
  "HH":     "(?<hour>\\d{2})",
  "HH12":   "(?<hour>\\d{2})",
  "HH24":   "(?<hour>\\d{2})",
  "MI":     "(?<minute>\\d{2})",
  "SS":     "(?<second>\\d{2})",
  "SSSSS":  "(?<sssss>\\d{1,5})",
  "A.M.":   "(?<ampm>[AaPp]\\.[Mm]\\.)",
  "P.M.":   "(?<ampm>[AaPp]\\.[Mm]\\.)",
  // NOTE 507 — The first character of a time zone hour field must be a sign or a space.
  "TZH":    "(?<tzh>[+ -]\\d{2})",
  "TZM":    "(?<tzm>\\d{2})",
  "FF1":    "(?<ff>\\d{1})",
  "FF2":    "(?<ff>\\d{2})",
  "FF3":    "(?<ff>\\d{3})",
  "FF4":    "(?<ff>\\d{4})",
  "FF5":    "(?<ff>\\d{5})",
  "FF6":    "(?<ff>\\d{6})",
  "FF7":    "(?<ff>\\d{7})",
  "FF8":    "(?<ff>\\d{8})",
  "FF9":    "(?<ff>\\d{9})"
}

const POW10 = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000]

const REJECT_OVERFLOW: Temporal.OverflowOptions = {overflow: "reject"}
const USE_OFFSET_REJECT_OVERFLOW: Temporal.ZonedDateTimeFromOptions = {offset: "use", overflow: "reject"}


// Matches standard tokens or single delimiters
const templateTokenizer = /(A\.M\.|P\.M\.|HH12|HH24|HH|YYYY|YYY|YY|Y|MM|DDD|DD|MI|SSSSS|SS|TZH|TZM|FF[1-9]|RRRR|RR)|([-.\/,';: ])/g

function createFormattedParser(template: string): StringToTemporal {
  const fields = new Set<string>()
  let regexPattern = ""
  let hasYear = false, hasMonthDay = false, hasTime = false

  let lastWasDelim = false
  for (const match of template.toUpperCase().matchAll(templateTokenizer)) {
    const [_, field, delim] = match

    if (field) {
      if (fields.has(field)) {
        throw new Error(`Rule 3: Duplicate field "${field}"`)
      }
      fields.add(field)
      regexPattern += FIELD_TO_REGEX[field]
      lastWasDelim = false
      hasYear = hasYear || "YR".indexOf(field[0]) > -1
      hasMonthDay = hasMonthDay || field.startsWith("MM") || field.startsWith("D")
      hasTime = hasTime || "APFHST".indexOf(field[0]) > -1
    } else if (delim) {
      if (lastWasDelim) {
        throw new Error("Rule 2: Consecutive delimiters")
      }
      regexPattern += RegExp.escape(delim)
      lastWasDelim = true
    }
  }

  const is12hr = fields.has("HH") || fields.has("HH12")
  const parserRegex = new RegExp(`^${regexPattern}$`)

  return (value: string) => {
    const match = parserRegex.exec(value)
    if (!match || !match.groups) {
      throw new Error(`Value "${value}" does not match template "${template}"`)
    }

    const g = match.groups
    let year = g.year ? parseInt(g.year, 10) : 1970
    let month = g.month ? parseInt(g.month, 10) : 1
    let day = g.day ? parseInt(g.day, 10) : 1
    let hour = g.hour ? parseInt(g.hour, 10) : 0
    let minute = g.minute ? parseInt(g.minute, 10) : 0
    let second = g.second ? parseInt(g.second, 10) : 0
    let millisecond = 0
    let microsecond = 0
    let nanosecond = 0

    if (is12hr && g.ampm) {
      const isPm = g.ampm.toUpperCase().startsWith("P")
      if (isPm && hour < 12) {
        hour += 12
      }
      if (!isPm && hour === 12) {
        hour = 0
      }
    }

    if (g.sssss) {
      const totalSeconds = parseInt(g.sssss, 10)
      hour = Math.floor(totalSeconds / 3600)
      minute = Math.floor((totalSeconds % 3600) / 60)
      second = totalSeconds % 60
    }

    if (g.ff) {
      nanosecond = Number(g.ff) * POW10[9 - g.ff.length]
      millisecond = Math.floor(nanosecond / 1_000_000)
      microsecond = Math.floor((nanosecond % 1_000_000) / 1_000)
      nanosecond = nanosecond % 1_000
    }


    const hasDate = hasYear || hasMonthDay
    const offset = fields.has("TZH") && `${g.tzh}:${g.tzm || "00"}`
    if (hasDate && hasTime) {
      if (offset) {
        return Temporal.ZonedDateTime.from({
            year, month, day, hour, minute, second, millisecond, microsecond, nanosecond,
            timeZone: "Etc/UTC",  // timeZone is required but will probably not match the offset
            offset
          },
          USE_OFFSET_REJECT_OVERFLOW
        ).toInstant()
      } else {
         return Temporal.PlainDateTime.from(
           {year, month, day, hour, minute, second, millisecond, microsecond, nanosecond},
           REJECT_OVERFLOW)
      }
    }
    if (hasDate) {
      return Temporal.PlainDate.from({year, month, day}, REJECT_OVERFLOW)
    }
    if (offset) {
      const zdt = Temporal.ZonedDateTime.from({
          year, month, day, hour, minute, second, millisecond, microsecond, nanosecond,
          timeZone: "Etc/UTC",  // timeZone is required but will probably not match the offset
          offset
        },
        USE_OFFSET_REJECT_OVERFLOW
      )
      return ZonedTime.from(zdt)
    }
    return Temporal.PlainTime.from(
      {hour, minute, second, millisecond, microsecond, nanosecond},
      REJECT_OVERFLOW)
  }
}


function parseTemporalString(input: string): TemporalType {
  switch (inferTemporalKind(input)) {
    case TemporalTypes.TIME:
      return Temporal.PlainTime.from(input, REJECT_OVERFLOW)
    case TemporalTypes.TIME_TZ:
      // Instant wants a date portion
      const instant = Temporal.Instant.from(`1970-01-01T${input}`)
      // apply effect of timezone to time
      return ZonedTime.from(instant.toZonedDateTimeISO("UTC"), REJECT_OVERFLOW)
    case TemporalTypes.DATE:
      return Temporal.PlainDate.from(input, REJECT_OVERFLOW)
    case TemporalTypes.TIMESTAMP:
      return Temporal.PlainDateTime.from(input, REJECT_OVERFLOW)
    case TemporalTypes.TIMESTAMP_TZ:
      return Temporal.Instant.from(input)
    default:
      throw new Error(`Not a valid date or time string: "${input}"`)
  }
}


function inferTemporalKind(input: string): TemporalTypes | undefined {
  let dashCount = 0,
      hasTime = false,
      hasZone = false

  for (const char of input) {
    switch (char) {
      case "-":
        dashCount++
        break
      case ":":
        hasTime = true
        break
      case "+":
      case "Z":
      case "z":
        hasZone = true
    }
  }
  // 12:34:56-03:30 has a dash, but it is not a date
  const hasDate = dashCount > 1
  // handle negative offsets like -0800
  hasZone = hasZone
    || (hasDate && dashCount === 3)
    || (hasTime && dashCount === 1)

  if (hasTime && hasDate) {
    return hasZone
      ? TemporalTypes.TIMESTAMP_TZ
      : TemporalTypes.TIMESTAMP
  }
  if (hasTime) {
    return hasZone
      ? TemporalTypes.TIME_TZ
      : TemporalTypes.TIME
  }
  if (hasDate) {
    return TemporalTypes.DATE
  }
}


// Only has max 9 values
const troCache: TimeRoundOptions[] = []
const roundingMode = "halfExpand"

/** @internal */
export function timeRoundOptions(precision?: number): TimeRoundOptions | undefined {
  if (precision !== undefined) {
    let tro = troCache[precision]
    if (!tro) {
      tro = _timeRoundOptions(precision)
      troCache[precision] = tro
    }
    return tro
  }
}


function _timeRoundOptions(precision: number): TimeRoundOptions {
  if (precision > 9) {
    throw new Error(`time/timestamp_tz() precision must be an integer between 0 and 9, found ${precision}.`)
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


// Only has max 9 values
const tsroCache: TimestampRoundOptions[] = []

/** @internal */
export function timestampRoundOptions(precision?: number): TimestampRoundOptions | undefined {
  if (precision !== undefined) {
    let tsro = tsroCache[precision]
    if (!tsro) {
      tsro = _timestampRoundOptions(precision)
      tsroCache[precision] = tsro
    }
    return tsro
  }
}

function _timestampRoundOptions(precision: number): TimestampRoundOptions {
  if (precision > 9) {
  throw new Error(`timestamp() precision must be an integer between 0 and 9, found ${precision}.`)
  }
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
