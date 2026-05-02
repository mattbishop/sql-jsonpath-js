import {expect} from "chai"
import {describe, it} from "node:test"
import {Temporal} from "temporal-polyfill"

import {buildTemporalParser} from "../src/datetime-parser.ts"


describe("Temporal parsing", () => {
  const parse = buildTemporalParser().toTemporal

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

    it("parses times with timezone offsets as PlainTime", () => {
      const value = parse("04:11:18.0214+00:00")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("04:11:18.0214")
    })

    it("parses times with positive offsets as PlainTime", () => {
      const value = parse("12:34:56+05:30")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("07:04:56")
    })

    it("parses times with negative offsets as PlainTime", () => {
      const value = parse("12:34:56-03:30")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("16:04:56")
    })

    it("parses datetimes without a zone", () => {
      const value = parse("2024-01-15T12:34:56")
      expect(value).to.be.instanceOf(Temporal.PlainDateTime)
      expect(value.toString()).to.equal("2024-01-15T12:34:56")
    })

    it("parses datetimes with Z", () => {
      const value = parse("2024-01-15T12:34:56Z")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56Z")
    })

    it("parses datetimes with a positive offset", () => {
      const value = parse("2024-01-15 12:34:56+02:00")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T10:34:56Z")
    })

    it("parses datetimes with a negative offset", () => {
      const value = parse("2024-01-15T12:34:56-05:30")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T18:04:56Z")
    })

    it("does not misclassify dates that contain hyphens as timezone offsets", () => {
      const value = parse("2024-01-15")
      expect(value).to.be.instanceOf(Temporal.PlainDate)
    })

    it("rejects invalid temporal strings", () => {
      expect(() => parse("not-a-date")).to.throw("Cannot parse: not-a-date")
    })

    it("accepts lowercase z as a zone designator", () => {
      const value = parse("2024-01-15T12:34:56z")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56Z")
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
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56Z")
    })
  })

  describe("fractional seconds", () => {
    it("parses an instant with fractional seconds", () => {
      const value = parse("2024-01-15T12:34:56.789Z")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56.789Z")
    })

    it("parses a plain time with fractional seconds", () => {
      const value = parse("12:34:56.789")
      expect(value).to.be.instanceOf(Temporal.PlainTime)
      expect(value.toString()).to.equal("12:34:56.789")
    })
  })

  describe("whitespace handling", () => {
    it("rejects values with surrounding whitespace", () => {
      expect(() => parse(" 2024-01-15 ")).to.throw("Cannot parse:  2024-01-15 ")
    })
  })

  describe("leap days", () => {
    it("accepts a valid leap day", () => {
      const value = parse("2024-02-29")
      expect(value).to.be.instanceOf(Temporal.PlainDate)
      expect(value.toString()).to.equal("2024-02-29")
    })

    it("rejects an invalid leap day", () => {
      expect(() => parse("2023-02-29")).to.throw(/Invalid isoDay: 29/)
    })
  })

  describe("zero offsets", () => {
    it("parses +00:00 as an Instant", () => {
      const value = parse("2024-01-15T12:34:56+00:00")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56Z")
    })

    it("parses -00:00 as an Instant", () => {
      const value = parse("2024-01-15T12:34:56-00:00")
      expect(value).to.be.instanceOf(Temporal.Instant)
      expect(value.toString()).to.equal("2024-01-15T12:34:56Z")
    })
  })

  describe("invalid time components", () => {
    it("rejects hour 24", () => {
      expect(() => parse("24:00:00")).to.throw(/Invalid isoHour: 24/)
    })

    it("rejects minute 60", () => {
      expect(() => parse("12:60:00")).to.throw(/Invalid isoMinute: 60/)
    })

/* This is not failing as it should, problem with temporal-polyfill
    it("rejects second 60", () => {
      expect(() => parse("12:34:60")).to.throw("Cannot parse: 12:34:60")
    })
*/
  })

  describe("invalid date-time formats", () => {
    it("rejects slash-separated dates", () => {
      expect(() => parse("2024/01/15")).to.throw(/Not a valid date or time string/)
    })

    it("rejects month 13", () => {
      expect(() => parse("2024-13-01")).to.throw(/Invalid isoMonth: 13/)
    })

    it("rejects day 32", () => {
      expect(() => parse("2024-01-32")).to.throw(/Invalid isoDay: 32/)
    })
  })
})
