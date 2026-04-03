import {expect} from "chai"
import {describe, it} from "node:test"
import {Temporal} from "temporal-polyfill"

import {buildTemporalParser} from "../src/date-utils.ts"


describe("Temporal parsing", () => {
  const parse = buildTemporalParser("CLDR")

  describe("inferTemporalKind via CLDR parser", () => {
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
})
