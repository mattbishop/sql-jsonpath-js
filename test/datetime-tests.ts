import {expect} from "chai"
import {describe, it} from "node:test"
import {Temporal} from "temporal-polyfill"

import {compile, one} from "../src/index.ts"

describe("datetime tests", () => {


  it("understands dates", () => {
    const stmt = compile('$.datetime().type()')
    const actual = one(stmt.values("2020-02-01"))
    expect(actual).to.equal("date")
  })

  it("compares dates", () => {
    const stmt = compile('$ ? (@.datetime() == $a)')
    const actual = stmt.exists("2020-02-01", {variables: {a: Temporal.PlainDate.from("2020-02-01")}})
    expect(actual).to.be.true
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
    })
  })
})
