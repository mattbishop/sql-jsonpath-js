import {Temporal} from "temporal-polyfill"

import type {TemporalParser, TemporalType} from "./ƒ-base.ts"

/**
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
  "DD":     "(?<day>\\d{2})",
  "DDD":    "(?<day_of_year>\\d{3})",
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

/**
 * @internal
 * @param template The template string to create a temporal parser for.
 */
function createFormattedParser(template: string): TemporalParser {
  const fields = new Set<string>()
  let regexPattern = ""
  let lastWasDelim = false

  // Matches standard tokens, or single delimiters
  const tokenizer = /(A\.M\.|P\.M\.|HH12|HH24|HH|SSSSS|YYYY|YYY|MM|DD|DDD|MI|SS|TZH|TZM|FF[1-9]|RRRR|RR|YY|Y)|([-.\/,';: ])/g

  for (const match of template.matchAll(tokenizer)) {
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
    let year = g.year ? parseInt(g.year, 10) : 2026
    let month = g.month ? parseInt(g.month, 10) : 1
    let day = g.day ? parseInt(g.day, 10) : 1
    let hour = g.hour ? parseInt(g.hour, 10) : 0
    let minute = g.minute ? parseInt(g.minute, 10) : 0
    let second = g.second ? parseInt(g.second, 10) : 0
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
    }

    const dateArgs = { year, month, day, hour, minute, second, nanosecond }

    const hasYear = ["YYYY", "YYY", "YY", "Y", "RRRR", "RR"].some((f) => { return fields.has(f) })
    const hasMonthDay = ["MM", "DD", "DDD"].some((f) => { return fields.has(f) })
    const hasDate = hasYear || hasMonthDay

    const hasTime = ["HH24", "HH", "SSSSS"].some((f) => { return fields.has(f) }) ||
      ["A.M.", "P.M."].some((f) => { return fields.has(f) }) ||
      ["FF1", "FF2", "FF3", "FF4", "FF5", "FF6", "FF7", "FF8", "FF9"].some((f) => { return fields.has(f) })

    if (hasDate && hasTime) {
      if (fields.has("TZH")) {
        const offset = `${g.tzh}:${g.tzm || "00"}`
        return Temporal.ZonedDateTime.from({
            ...dateArgs,
            timeZone: "Etc/UTC",  // timeZone is required, but will probably not match the offset
            offset
          }, {offset: "use"}      // in the case of conflict between offset and timeZone, use the offset value
        ).toInstant()
      }
       else {
         return Temporal.PlainDateTime.from(dateArgs)
      }
    }
    if (hasDate) {
      return Temporal.PlainDate.from({ year, month, day })
    }

    return Temporal.PlainTime.from({ hour, minute, second, nanosecond })
  }
}


const CLDR_PARSER = (input: string) => parseTemporalString(input)

/**
 * Creates a function that parses an input string into a Temporal type. The input strings
 * can either follow the Unicode CLDR spec, or a template passed into this function.
 *
 * @internal
 * @param template a SQL:2023 template string for parsing input into Temporal values, or "CLDR" for CLDR spec strings.
 */
export function buildTemporalParser(template: string): TemporalParser {
  return template === "CLDR"
    ? CLDR_PARSER
    : createFormattedParser(template);
}


function parseTemporalString(input: string): TemporalType {
  switch (inferTemporalKind(input)) {
    case "time":
      return Temporal.PlainTime.from(input, {overflow: "reject"})
    case "date":
      return Temporal.PlainDate.from(input, {overflow: "reject"})
    case "datetime":
      return Temporal.PlainDateTime.from(input, {overflow: "reject"})
    case "datetime_tz":
      return Temporal.Instant.from(input)
    default:
      throw new Error(`Not a valid date or time string: "${input}"`)
  }
}


type TemporalKind = "date" | "time" | "datetime" | "datetime_tz"

function inferTemporalKind(input: string): TemporalKind | undefined {
  let colonCount = 0,
    dashCount = 0,
    hasZone = false

  for (const char of input) {
    switch (char) {
      case ":":
        colonCount++
        break
      case "-":
        dashCount++
        break
      case "+":
      case "Z":
      case "z":
        hasZone = true
    }
  }

  const hasTime = colonCount > 0
  const hasDate = dashCount > 1
  hasZone = hasZone || dashCount > 2  //todo time_tz

  if (hasTime && hasDate) {
    return hasZone
      ? "datetime_tz"
      : "datetime"
  }
  if (hasTime) {
    return "time"
  }
  if (hasDate) {
    return "date"
  }
}

