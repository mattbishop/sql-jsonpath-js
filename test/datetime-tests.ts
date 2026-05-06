import {expect} from "chai"
import {describe, it} from "node:test"
import {Temporal} from "@js-temporal/polyfill"

import {compile, one} from "../src/index.ts"
import {ZonedTime} from "../src/json-path.ts"


describe("datetime tests", () => {

  it("understands dates", () => {
    const stmt = compile('$.datetime().type()')
    const actual = one(stmt.values("2020-02-01"))
    expect(actual).to.equal("date")
  })

  describe("date and time comparisons", () => {
    it("compares dates", () => {
      const stmt = compile('$ ? (@.datetime() == $a)')
      const actual = stmt.exists("2020-02-01", {variables: {a: Temporal.PlainDate.from("2020-02-01")}})
      expect(actual).to.be.true
    })

    it("compares with date()", () => {
      const stmt = compile('$ ? (@.date() > "2020-01-01".date())')
      expect(stmt.exists("2020-02-01")).to.be.true
      expect(stmt.exists("2019-12-31")).to.be.false
    })

    it("compares with time()", () => {
      const stmt = compile('$ ? (@.time() < "12:00:00".time())')
      expect(stmt.exists("10:00:00")).to.be.true
      expect(stmt.exists("14:00:00")).to.be.false
    })

    it("compares with time_tz()", () => {
      // 10:00:00+02:00 is 08:00:00Z
      // 09:00:00Z
      const stmt = compile('$ ? (@.time_tz() > "09:00:00Z".time_tz())')
      expect(stmt.exists("12:00:00+02:00")).to.be.true // 10:00:00Z > 09:00:00Z
      expect(stmt.exists("08:00:00Z")).to.be.false
    })

    it("compares with timestamp()", () => {
      const stmt = compile('$ ? (@.timestamp() == "2020-01-01T10:00:00".timestamp())')
      expect(stmt.exists("2020-01-01T10:00:00")).to.be.true
      expect(stmt.exists("2020-01-01T11:00:00")).to.be.false
    })

    it("compares with timestamp_tz()", () => {
      const stmt = compile('$ ? (@.timestamp_tz() >= "2020-01-01T10:00:00Z".timestamp_tz())')
      expect(stmt.exists("2020-01-01T11:00:00Z")).to.be.true
      expect(stmt.exists("2020-01-01T09:00:00Z")).to.be.false
    })
  })

  describe("datetime comparisons", () => {
    it("compares date and timestamp values at midnight", () => {
      const sameInstant = compile('$ ? (@.date() == "2020-01-01T00:00:00".timestamp())')
      expect(sameInstant.exists("2020-01-01")).to.be.true

      const differentInstant = compile('$ ? (@.date() == "2020-01-01T00:00:01".timestamp())')
      expect(differentInstant.exists("2020-01-01")).to.be.false
    })

    it("compares timestamp and date values in either direction", () => {
      const dateOnLeft = compile('$ ? (@.date() == "2020-01-01T00:00:00".timestamp())')
      expect(dateOnLeft.exists("2020-01-01")).to.be.true

      const timestampOnLeft = compile('$ ? (@.timestamp() == "2020-01-01".date())')
      expect(timestampOnLeft.exists("2020-01-01T00:00:00")).to.be.true
    })

    it("supports ordering comparisons between date and timestamp values", () => {
      expect(compile('$ ? (@.date() < "2020-01-02T00:00:00".timestamp())').exists("2020-01-01")).to.be.true
      expect(compile('$ ? (@.date() <= "2020-01-01T00:00:00".timestamp())').exists("2020-01-01")).to.be.true
      expect(compile('$ ? (@.date() > "2019-12-31T23:59:59".timestamp())').exists("2020-01-01")).to.be.true
      expect(compile('$ ? (@.date() >= "2020-01-01T00:00:00".timestamp())').exists("2020-01-01")).to.be.true
      expect(compile('$ ? (@.date() != "2020-01-02T00:00:00".timestamp())').exists("2020-01-01")).to.be.true
    })

    it("treats non-comparable temporal values as unknown", () => {
      const dateAndTime = compile('$ ? ((@.date() == "10:11:12".time()) is unknown)')
      expect(dateAndTime.exists("2020-01-01")).to.be.true

      const dateAndTimeTz = compile('$ ? ((@.date() == "10:11:12Z".time_tz()) is unknown)')
      expect(dateAndTimeTz.exists("2020-01-01")).to.be.true

      const timeAndTimeTz = compile('$ ? ((@.time() == "10:11:12Z".time_tz()) is unknown)')
      expect(timeAndTimeTz.exists("10:11:12")).to.be.true
    })

    it("does not match non-comparable temporal comparisons without is unknown", () => {
      const dateAndTime = compile('$ ? (@.date() == "10:11:12".time())')
      expect(dateAndTime.exists("2020-01-01")).to.be.false

      const dateAndTimestampTz = compile('$ ? (@.date() == "2020-01-01T00:00:00Z".timestamp_tz())')
      expect(dateAndTimestampTz.exists("2020-01-01")).to.be.false

      const timeAndTimeTz = compile('$ ? (@.time() == "10:11:12Z".time_tz())')
      expect(timeAndTimeTz.exists("10:11:12")).to.be.false
    })
  })

  describe("date and time functions", () => {

    describe("type()", () => {
      const statement = compile('$.type()')
      it("date types", () => {
        const dateType = one(statement.values(Temporal.PlainDate.from("2020-01-01")))
        expect(dateType).to.equal("date")
        const timeType = one(statement.values(Temporal.PlainTime.from("10:11:12")))
        expect(timeType).to.equal("time without time zone")
        const plainDateTimeType = one(statement.values(Temporal.PlainDateTime.from("2020-01-01T10:11:12")))
        expect(plainDateTimeType).to.equal("timestamp without time zone")
        const instantType = one(statement.values(Temporal.Instant.from("2020-01-01T10:11:12Z")))
        expect(instantType).to.equal("timestamp with time zone")
      })
    })

    describe("date()", () => {
      it("single values", () => {
        const statement = compile('$.date()')
        let dateActual = one(statement.values("2024-12-31"))
        expect(dateActual).to.deep.equal(Temporal.PlainDate.from("2024-12-31"))
        dateActual = one(statement.values("2020-07-25T15:32:21"))
        expect(dateActual).to.deep.equal(Temporal.PlainDate.from("2020-07-25"))
        expect(() => one(statement.values(null))).to.throw
        expect(() => one(statement.values("1977"))).to.throw
        expect(() => one(statement.values(true))).to.throw
        expect(() => one(statement.values({}))).to.throw
        expect(() => one(statement.values([]))).to.throw
      })

      it("iterator of values", () => {
        const statement = compile('$[*].date()')
        const arrayTypes = statement.values(["2021-01-01", "1900-11-01", "2047-05-15"])
        expect(Array.from(arrayTypes)).to.deep.equal([
          Temporal.PlainDate.from("2021-01-01"),
          Temporal.PlainDate.from("1900-11-01"),
          Temporal.PlainDate.from("2047-05-15")
        ])
      })
    })

    describe("time()", () => {
      it("single values", () => {
        const statement = compile('$.time()')
        let timeActual = one(statement.values("01:01:01"))
        expect(timeActual).to.deep.equal(Temporal.PlainTime.from("01:01:01"))
        timeActual = one(statement.values("15:32:21"))
        expect(timeActual).to.deep.equal(Temporal.PlainTime.from("15:32:21"))
        expect(() => one(statement.values(null))).to.throw
        expect(() => one(statement.values("1977"))).to.throw
        expect(() => one(statement.values(true))).to.throw
        expect(() => one(statement.values({}))).to.throw
        expect(() => one(statement.values([]))).to.throw
      })

      it("single values with precision", () => {
        const statement = compile('$.time(3)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.7894"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:56.789")
      })

      it("rounds half expand at the requested precision", () => {
        const statement = compile('$.time(3)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.7895"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:56.79")
      })

      it("supports zero precision", () => {
        const statement = compile('$.time(0)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.5"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:57")
      })

      it("rejects invalid precision values", () => {
        const statement = compile('$.time(10)')
        expect(() => one(statement.values("12:34:56.789"))).to.throw
      })


      it("iterator of values", () => {
        const statement = compile('$[*].time()')
        const arrayTypes = statement.values(["01:01:01", "15:32:21", "23:59:59"])
        expect(Array.from(arrayTypes)).to.deep.equal([
          Temporal.PlainTime.from("01:01:01"),
          Temporal.PlainTime.from("15:32:21"),
          Temporal.PlainTime.from("23:59:59")
        ])
      })
    })

    describe("time_tz()", () => {
      it("single values", () => {
        // this works in PG
        const statement = compile('$.time_tz()')
        let timeActual = one(statement.values("01:01:01Z"))
        expect(timeActual).to.deep.equal(Temporal.PlainTime.from("01:01:01"))
        timeActual = one(statement.values("02:11:18.0214-02:00"))
        expect(timeActual).to.deep.equal(Temporal.PlainTime.from("04:11:18.0214"))
        expect(() => one(statement.values(null))).to.throw
        expect(() => one(statement.values("1977"))).to.throw
        expect(() => one(statement.values(true))).to.throw
        expect(() => one(statement.values({}))).to.throw
        expect(() => one(statement.values([]))).to.throw
      })

      it("single values with precision", () => {
        const statement = compile('$.time_tz(3)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.7894+00:00"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:56.789")
      })

      it("rounds half expand at the requested precision", () => {
        const statement = compile('$.time_tz(3)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.7895+00:00"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:56.79")
      })

      it("supports zero precision", () => {
        const statement = compile('$.time_tz(0)')
        const timeActual = one(statement.values<Temporal.PlainTime>("12:34:56.5+00:00"))
        // @ts-ignore
        expect(timeActual.toString()).to.equal("12:34:57")
      })

      it("rejects invalid precision values", () => {
        const statement = compile('$.time_tz(10)')
        expect(() => one(statement.values("12:34:56.789+00:00"))).to.throw
      })

      it("iterator of values", () => {
        const statement = compile('$[*].time_tz()')
        const arrayTypes = statement.values(["01:01:01+00:00", "15:32:21-02:00", "23:59:59Z"])
        expect(Array.from(arrayTypes)).to.deep.equal([
          Temporal.PlainTime.from("01:01:01"),
          Temporal.PlainTime.from("17:32:21"),
          Temporal.PlainTime.from("23:59:59")
        ])
      })
    })

    describe("datetime()", () => {
      const statement = compile('$.datetime()')
      it("ISO timestamp", () => {
        const actualDate = statement.values("2020-01-01T09:11:18.0214-02:30")
        expect(one(actualDate)).to.deep.equal(Temporal.Instant.from("2020-01-01T09:11:18.0214-02:30"))
      })

      it("just date", () => {
        const actualDate = statement.values("2020-01-01")
        expect(one(actualDate)).to.deep.equal(Temporal.PlainDate.from("2020-01-01"))
      })

      it("just time", () => {
        const actualTime = statement.values("10:09:55")
        expect(one(actualTime)).to.deep.equal(Temporal.PlainTime.from("10:09:55"))
      })

      it("iterator of values", () => {
        const boxStatement = compile('$[*].datetime()')
        const actualDate = boxStatement.values(["2020-01-01", "2020-01-01T09:11:18.0214-02:30"])
        expect(one(actualDate)).to.deep.equal(Temporal.PlainDate.from("2020-01-01"))
        expect(one(actualDate)).to.deep.equal(Temporal.Instant.from("2020-01-01T09:11:18.0214-02:30"))
        expect(actualDate.next().done).to.be.true
      })

    })

    describe("datetime(template)", () => {
      it("datetime with timezone", () => {
        const statement = compile('$.datetime("MM-DD/YYYY;HH.MI:SSTZH")')
        const actualDate = statement.values("02-21/1900;03.35:19+06")
        expect(one(actualDate)).to.deep.equal(Temporal.Instant.from("1900-02-21 03:35:19+06"))
      })

      it("datetime", () => {
        const statement = compile('$.datetime("MM-DD/YYYY;HH.MI:SS")')
        const actualDate = statement.values("02-21/1900;03.35:19")
        expect(one(actualDate)).to.deep.equal(Temporal.PlainDateTime.from("1900-02-21 03:35:19"))
      })

      it("date only", () => {
        const statement = compile('$.datetime("MM DD.YYYY")')
        const actualDate = statement.values("02 21.1900")
        expect(one(actualDate)).to.deep.equal(Temporal.PlainDate.from("1900-02-21"))
      })

      it("time only", () => {
        const statement = compile('$.datetime("HH;MI:SS")')
        const actualDate = statement.values("02;41:12")
        expect(one(actualDate)).to.deep.equal(Temporal.PlainTime.from("02:41:12"))
      })
      it("time with timezone hour", () => {
        const statement = compile('$.datetime("HH24:MI:SSTZH")')
        const actualTime = statement.values("12:00:00-02")
        expect(one(actualTime)).to.deep.equal(ZonedTime.from("14:00:00"))
      })

      it("time with timezone hour and minute", () => {
        const statement = compile('$.datetime("HH24:MI:SSTZH:TZM")')
        const actualTime = statement.values("12:34:56+05:30")
        expect(one(actualTime)).to.deep.equal(ZonedTime.from("07:04:56"))
      })

      it("time with fractional seconds and timezone", () => {
        const statement = compile('$.datetime("HH24:MI:SS.FF4TZH:TZM")')
        const actualTime = statement.values("02:11:18.0214-02:00")
        expect(one(actualTime)).to.deep.equal(ZonedTime.from("04:11:18.0214"))
      })
    })
  })
})
