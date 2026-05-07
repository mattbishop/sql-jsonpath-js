import {Temporal} from "@js-temporal/polyfill"

import {TemporalTypes, type TemporalParser, type TemporalType} from "./ƒ-base.ts"
import {ZonedTime} from "./json-path.ts";

/**
 * Constant for Unicode CLDR spec to parse strings into date / time objects.
 */
export const CLDR = "CLDR"

type StringToTemporal = (input: string) => TemporalType

/**
 * Creates a function that parses an input string into a Temporal type. The input strings
 * can either follow the Unicode CLDR spec, or a template passed into this function.
 *
 * @internal
 * @param template a SQL:2023 template string for parsing input into Temporal values, or "CLDR" for CLDR spec strings.
 */
export function buildTemporalParser(template?: string): TemporalParser {
  const parser = template === undefined
    ? parseTemporalString
    : createFormattedParser(template)

  return {
    toTemporal:     (i) => parser(i),
    toDate:         (i) => _toDate(parser, i),
    toTime:         (i) => _toTime(parser, i),
    toTimeTz:       (i) => _toTimeTz(parser, i),
    toTimestamp:    (i) => _toTimestamp(parser, i),
    toTimestampTz:  (i) => _toTimestampTz(parser, i)
  }
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
    //?? PG 18 goes to UTC, 17 goes to local timezone. I may need to revisit this during comparison
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

// Matches standard tokens, or single delimiters
const templateTokenizer = /(A\.M\.|P\.M\.|HH12|HH24|HH|YYYY|YYY|YY|Y|MM|DDD|DD|MI|SSSSS|SS|TZH|TZM|FF[1-9]|RRRR|RR)|([-.\/,';: ])/g

function createFormattedParser(template: string): StringToTemporal {
  const fields = new Set<string>()
  let regexPattern = ""
  let lastWasDelim = false

  for (const match of template.matchAll(templateTokenizer)) {
    const [_, field, delim] = match

    if (field) {
      if (fields.has(field)) {
        throw new Error(`Rule 3: Duplicate field "${field}"`)
      }
      fields.add(field)
      regexPattern += FIELD_TO_REGEX[field]
      lastWasDelim = false
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
    const match = value.match(parserRegex)
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
      nanosecond = parseInt(g.ff.padEnd(9, "0"), 10)
      millisecond = Math.floor(nanosecond / 1_000_000)
      microsecond = Math.floor((nanosecond % 1_000_000) / 1_000)
      nanosecond = nanosecond % 1_000
    }

    const dateArgs = { year, month, day, hour, minute, second, millisecond, microsecond, nanosecond }

    const hasYear = ["YYYY", "YYY", "YY", "Y", "RRRR", "RR"].some((f) => { return fields.has(f) })
    const hasMonthDay = ["MM", "DD", "DDD"].some((f) => { return fields.has(f) })
    const hasDate = hasYear || hasMonthDay
    const hasTime = ["HH24", "HH", "SSSSS"].some((f) => { return fields.has(f) }) ||
      ["A.M.", "P.M."].some((f) => { return fields.has(f) }) ||
      ["FF1", "FF2", "FF3", "FF4", "FF5", "FF6", "FF7", "FF8", "FF9"].some((f) => { return fields.has(f) })
    const offset = fields.has("TZH") && `${g.tzh}:${g.tzm || "00"}`
    const overflow = "reject"
    if (hasDate && hasTime) {
      if (offset) {
        return Temporal.ZonedDateTime.from({
            ...dateArgs,
            timeZone: "Etc/UTC",  // timeZone is required, but will probably not match the offset
            offset
          }, {
            offset: "use",      // in the case of conflict between offset and timeZone, use the offset value
            overflow
          }
        ).toInstant()
      } else {
         return Temporal.PlainDateTime.from(dateArgs, {overflow})
      }
    }
    if (hasDate) {
      return Temporal.PlainDate.from({ year, month, day }, {overflow})
    }
    if (offset) {
      const zdt = Temporal.ZonedDateTime.from({
          ...dateArgs,
          timeZone: "Etc/UTC",  // timeZone is required, but will probably not match the offset
          offset
        }, {
          offset: "use",      // in the case of conflict between offset and timeZone, use the offset value
          overflow
        }
      )
      return ZonedTime.from(zdt)
    }
    return Temporal.PlainTime.from({ hour, minute, second, millisecond, microsecond, nanosecond }, {overflow})
  }
}


function parseTemporalString(input: string): TemporalType {
  const options: Temporal.AssignmentOptions = {overflow: "reject"}
  switch (inferTemporalKind(input)) {
    case TemporalTypes.TIME:
      return Temporal.PlainTime.from(input, options)
    case TemporalTypes.TIME_TZ:
      // Instant wants a date portion
      const instant = Temporal.Instant.from("1970-01-01T" + input)
      // apply effect of timezone to time
      return ZonedTime.from(instant.toZonedDateTimeISO("UTC"), options)
    case TemporalTypes.DATE:
      return Temporal.PlainDate.from(input, options)
    case TemporalTypes.TIMESTAMP:
      return Temporal.PlainDateTime.from(input, options)
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

