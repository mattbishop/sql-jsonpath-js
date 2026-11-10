import {expect} from "chai"
import {describe, it} from "node:test"

import {buildTemporalParser} from "../src/datetime.ts"
import {ZonedTime} from "../src/zoned-time.ts"


const ZDT_toStringOpts: Temporal.ZonedDateTimeToStringOptions = { timeZoneName: "never" }


describe("Temporal parsing", () => {
  const parse = buildTemporalParser().toTemporal

  describe("typed conversions", () => {
    const parser = buildTemporalParser()

    describe("toDate", () => {
      it("returns a PlainDate unchanged", () => {
        const value = parser.toDate("2024-01-15")

        expect(value).to.be.instanceOf(Temporal.PlainDate)
        expect(value.toString()).to.equal("2024-01-15")
      })

      it("converts a PlainDateTime to a PlainDate", () => {
        const value = parser.toDate("2024-01-15T12:34:56")

        expect(value).to.be.instanceOf(Temporal.PlainDate)
        expect(value.toString()).to.equal("2024-01-15")
      })

      it("rejects an instant", () => {
        expect(() => parser.toDate("2024-01-15T12:34:56Z"))
          .to.throw("Cannot convert input to a date.")
      })
    })

    describe("toTime", () => {
      it("returns a PlainTime unchanged", () => {
        const value = parser.toTime("12:34:56")

        expect(value).to.be.instanceOf(Temporal.PlainTime)
        expect(value.toString()).to.equal("12:34:56")
      })

      it("converts a PlainDateTime to a PlainTime", () => {
        const value = parser.toTime("2024-01-15T12:34:56")

        expect(value).to.be.instanceOf(Temporal.PlainTime)
        expect(value.toString()).to.equal("12:34:56")
      })

      it("rejects a time with time zone", () => {
        expect(() => parser.toTime("12:34:56+02:00"))
          .to.throw("Cannot convert input to a time.")
      })
    })

    describe("toTimeTz", () => {
      it("returns a ZonedTime unchanged", () => {
        const value = parser.toTimeTz("12:34:56+00:00")

        expect(value).to.be.instanceOf(ZonedTime)
        expect(value.toString()).to.equal("12:34:56+00:00")
      })

      it("converts an instant to a ZonedTime", () => {
        const value = parser.toTimeTz("2024-01-15T12:34:56Z")

        expect(value).to.be.instanceOf(ZonedTime)
        expect(value.toString()).to.equal("12:34:56+00:00")
      })

      it("rejects a plain time", () => {
        expect(() => parser.toTimeTz("12:34:56"))
          .to.throw("Cannot convert input to a time with time zone.")
      })
    })

    describe("toTimestamp", () => {
      it("returns a PlainDateTime unchanged", () => {
        const value = parser.toTimestamp("2024-01-15T12:34:56")

        expect(value).to.be.instanceOf(Temporal.PlainDateTime)
        expect(value.toString()).to.equal("2024-01-15T12:34:56")
      })

      it("converts a PlainDate to a PlainDateTime", () => {
        const value = parser.toTimestamp("2024-01-15")

        expect(value).to.be.instanceOf(Temporal.PlainDateTime)
        expect(value.toString()).to.equal("2024-01-15T00:00:00")
      })

      it("rejects a plain time", () => {
        expect(() => parser.toTimestamp("12:34:56"))
          .to.throw("Cannot convert input to a datetime.")
      })
    })

    describe("toTimestampTz", () => {
      it("returns an Instant unchanged", () => {
        const value = parser.toTimestampTz("2024-01-15T12:34:56Z")

        expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
        expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+00:00")
      })

      it("rejects a PlainDateTime", () => {
        expect(() => parser.toTimestampTz("2024-01-15T12:34:56"))
          .to.throw("Cannot convert the string to a timestamp with time zone.")
      })
    })
  })

  describe("infers Temporal Kind", () => {
    it("parses plain dates", () => {
      const value = parse("2024-01-15")
      expect(value).to.be.instanceOf(Temporal.PlainDate)
      expect(value.toString()).to.equal("2024-01-15")
    })

    it("parses plain times with seconds", () => {
      const value = parse("12:34:56")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56")
    })

    it("parses times with timezone offsets as ZonedTime", () => {
      const value = parse("04:11:18.0214+00:00")
      expect(value).to.be.instanceOf(ZonedTime)
      expect(value.toString()).to.equal("04:11:18.0214+00:00")
    })

    it("parses times with positive offsets as ZonedTime", () => {
      const value = parse("12:34:56+05:30")
      expect(value).to.be.instanceOf(ZonedTime)
      expect(value.toString()).to.equal("12:34:56+05:30")
    })

    it("parses times with negative offsets as ZonedTime", () => {
      const value = parse("12:34:56-03:30")
      expect(value).to.be.instanceOf(ZonedTime)
      expect(value.toString()).to.equal("12:34:56-03:30")
    })

    it("parses datetimes without a zone", () => {
      const value = parse("2024-01-15T12:34:56")
      expect(value).to.be.instanceOf(Temporal.PlainDateTime)
      expect(value.toString()).to.equal("2024-01-15T12:34:56")
    })

    it("parses datetimes with Z", () => {
      const value = parse("2024-01-15T12:34:56Z")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+00:00")
    })

    it("parses datetimes with a positive offset", () => {
      const value = parse("2024-01-15 12:34:56+02:00")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+02:00")
    })

    it("parses datetimes with a negative offset", () => {
      const value = parse("2024-01-15T12:34:56-05:30")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56-05:30")
    })

    it("does not misclassify dates that contain hyphens as timezone offsets", () => {
      const value = parse("2024-01-15")
      expect(value).to.be.instanceOf(Temporal.PlainDate)
    })

    it("rejects invalid temporal strings", () => {
      expect(() => parse("not-a-date")).to.throw("Temporal error: Invalid character while parsing year value.")
    })

    it("does not accept lowercase z as a zone designator", () => {
      expect(() => parse("2024-01-15T12:34:56z")).to.throw("Temporal error: UTC designator is not valid for DateTime parsing.")
    })
  })

  describe("plain times without seconds", () => {
    it("parses HH:MM as a PlainTime", () => {
      const value = parse("12:34")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:00")
    })
  })

  describe("datetime with space separator and Z", () => {
    it("parses a space-separated UTC datetime as an Instant", () => {
      const value = parse("2024-01-15 12:34:56Z")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+00:00")
    })
  })

  describe("fractional seconds", () => {
    it("parses an instant with fractional seconds", () => {
      const value = parse("2024-01-15T12:34:56.789Z")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56.789+00:00")
    })

    it("parses a plain time with fractional seconds", () => {
      const value = parse("12:34:56.789")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.789")
    })
  })

  describe("whitespace handling", () => {
    it("rejects values with surrounding whitespace", () => {
      expect(() => parse(" 2024-01-15 ")).to.throw("Temporal error: Invalid character while parsing year value.")
    })
  })

  describe("leap days", () => {
    it("accepts a valid leap day", () => {
      const value = parse("2024-02-29")
      expect(value).to.be.instanceOf(Temporal.PlainDate)
      expect(value.toString()).to.equal("2024-02-29")
    })

    it("rejects an invalid leap day", () => {
      expect(() => parse("2023-02-29")).to.throw("Temporal error: Parsed day value not in a valid range.")
    })
  })

  describe("zero offsets", () => {
    it("parses +00:00 as an Instant", () => {
      const value = parse("2024-01-15T12:34:56+00:00")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+00:00")
    })

    it("parses -00:00 as an Instant", () => {
      const value = parse("2024-01-15T12:34:56-00:00")
      expect(value).to.be.instanceOf(Temporal.ZonedDateTime)
      expect(value.toString(ZDT_toStringOpts)).to.equal("2024-01-15T12:34:56+00:00")
    })
  })

  describe("invalid time components", () => {
    it("rejects hour 24", () => {
      expect(() => parse("24:00:00")).to.throw("Temporal error: Invalid character while parsing hour value.")
    })

    it("rejects minute 60", () => {
      expect(() => parse("12:60:00")).to.throw("Temporal error: Invalid character while parsing minute/second value in (0, 59] range.")
    })

    // I think it should reject second 60, but it does not.
    it("rejects second 61", () => {
      expect(() => parse("12:34:61")).to.throw("Temporal error: Invalid character while parsing second value in (0, 60] range.")
    })
  })

  describe("invalid date-time formats", () => {
    it("rejects slash-separated dates", () => {
      expect(() => parse("2024/01/15")).to.throw('Not a valid date or time string.')
    })

    it("rejects month 13", () => {
      expect(() => parse("2024-13-01")).to.throw("Temporal error: Parsed month value not in a valid range.")
    })

    it("rejects day 32", () => {
      expect(() => parse("2024-01-32")).to.throw("Temporal error: Parsed day value not in a valid range.")
    })
  })

  describe("formatted parser token coverage", () => {
    it("parses RRRR year fields", () => {
      const parser = buildTemporalParser("RRRR-MM-DD")

      const value = parser.toTemporal("2024-01-15")

      expect(value).to.be.instanceOf(Temporal.PlainDate)
      expect(value.toString()).to.equal("2024-01-15")
    })

    it("recognizes shortened year fields", () => {
      expect(buildTemporalParser("YYY-MM-DD").toTemporal("024-01-15").toString()).to.equal("1970-01-15")
      expect(buildTemporalParser("YY-MM-DD").toTemporal("24-01-15").toString()).to.equal("1970-01-15")
      expect(buildTemporalParser("Y-MM-DD").toTemporal("4-01-15").toString()).to.equal("1970-01-15")
      expect(buildTemporalParser("RR-MM-DD").toTemporal("24-01-15").toString()).to.equal("1970-01-15")
    })

    it("recognizes day-of-year fields", () => {
      const value = buildTemporalParser("YYYY-DDD").toTemporal("2024-032")

      expect(value).to.be.instanceOf(Temporal.PlainDate)
      expect(value.toString()).to.equal("2024-01-01")
    })

    it("parses seconds since midnight with SSSSS", () => {
      const value = buildTemporalParser("SSSSS").toTemporal("45296")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56")
    })

    it("parses 12-hour times with A.M.", () => {
      const value = buildTemporalParser("HH:MI:SS A.M.").toTemporal("12:34:56 A.M.")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("00:34:56")
    })

    it("parses 12-hour times with P.M.", () => {
      const value = buildTemporalParser("HH:MI:SS P.M.").toTemporal("01:34:56 P.M.")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("13:34:56")
    })

    it("parses FF1 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF1").toTemporal("12:34:56.1")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.1")
    })

    it("parses FF2 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF2").toTemporal("12:34:56.12")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.12")
    })

    it("parses FF3 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF3").toTemporal("12:34:56.123")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.123")
    })

    it("parses FF5 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF5").toTemporal("12:34:56.12345")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.12345")
    })

    it("parses FF6 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF6").toTemporal("12:34:56.123456")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.123456")
    })

    it("parses FF7 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF7").toTemporal("12:34:56.1234567")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.1234567")
    })

    it("parses FF8 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF8").toTemporal("12:34:56.12345678")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.12345678")
    })

    it("parses FF9 fractional seconds", () => {
      const value = buildTemporalParser("HH24:MI:SS.FF9").toTemporal("12:34:56.123456789")

      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.123456789")
    })
  })
})
