import {expect} from "chai"
import {compile} from "../src"

describe("Statement tests", () => {
  it("exists", () => {
    const stmt = compile("$")
    const actual = stmt.exists("matt")
    expect(actual.next().value).to.equal(true)
    expect(actual.next().done).to.equal(true)
  })

  it("queries", () => {
    const stmt = compile("$.a")
    const actual = stmt.query([{a: 1}, {b: 2}, {a: 3}])
    expect(actual.next().value).to.deep.equal({a: 1})
    expect(actual.next().value).to.deep.equal({a: 3})
    expect(actual.next().done).to.equal(true)
  })

  it("values", () => {
    const stmt = compile("$.a")
    const actual = stmt.values([{a: 1}, {b: 2}, {a: 3}])
    expect(actual.next().value).to.equal(1)
    expect(actual.next().value).to.equal(3)
    expect(actual.next().done).to.equal(true)
  })

  it("applies function to sequence", () => {
    const stmt = compile("$.type()")//[*].type()")
    const actual = stmt.values(["matt", true, 100, ["mary", "abby"], {a: 4}])
    expect(actual.next().value).to.equal("string")
    expect(actual.next().value).to.equal("boolean")
    expect(actual.next().value).to.equal("number")
    expect(actual.next().value).to.equal("array")
    expect(actual.next().value).to.equal("object")
    expect(actual.next().done).to.equal(true)
  })

  it("unwraps sequence", () => {
    const stmt = compile("$[*]")
    const actual = stmt.values(["matt", true, 100, ["mary", "abby"], {a: 4}])
    expect(actual.next().value).to.equal("matt")
    expect(actual.next().value).to.equal(true)
    expect(actual.next().value).to.equal(100)
    expect(actual.next().value).to.equal("mary")
    expect(actual.next().value).to.equal("abby")
    expect(actual.next().value).to.deep.equal({a: 4})
    expect(actual.next().done).to.equal(true)
  })

  it("unwraps sequence and applies type()", () => {
    const stmt = compile("$[*].type()")
    const actual = stmt.values(["matt", true, 100, ["mary", false], {a: 4}])
    expect(actual.next().value).to.equal("string")
    expect(actual.next().value).to.equal("boolean")
    expect(actual.next().value).to.equal("number")
    expect(actual.next().value).to.equal("string")
    expect(actual.next().value).to.equal("boolean")
    expect(actual.next().value).to.deep.equal("object")
    expect(actual.next().done).to.equal(true)
  })

  it("extracts values from an array", () => {
    const stmt = compile("$ ? (@ starts with \"m\")")
    const actual = stmt.values(["matt", "angie", "mark", "mary", "abby"])
    expect(actual.next().value).to.equal("matt")
    expect(actual.next().value).to.equal("mark")
    expect(actual.next().value).to.equal("mary")
    expect(actual.next().done).to.equal(true)
  })

  it("can do arithmetic", () => {
    const stmt = compile("$ ? (@ % 2 == 0)")
    const actual = stmt.values([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
  })

  describe("filter generators", () => {
    const numberGen = function* () {
      for (let i = 0; i < 10; i++) {
        yield i
      }
    }
    const stmt = compile("$ ? (@ % 2 == 0)")
    it("*number values", () => {
      const actual = stmt.values(numberGen())
      expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
    })
    it("*number exists", () => {
      const actual = stmt.exists(numberGen())
      expect(Array.from(actual)).to.deep.equal([true, false, true, false, true, false, true, false, true, false])
    })
    it("*number query", () => {
      const actual = stmt.query(numberGen())
      expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
    })
  })

  describe("keyvalue generators", () => {
    const objectGen = function* () {
      let key = "a"
      for (let i = 0; i < 5; i++) {
        yield {[key]: i}
        key = String.fromCharCode(key.charCodeAt(0) + 1)
      }
    }
    const stmt = compile("$.keyvalue()")

    it("*object values", () =>  {
      const actual = stmt.values(objectGen())
      expect(Array.from(actual)).to.deep.equal([
        {id: 0, key: "a", value: 0},
        {id: 1, key: "b", value: 1},
        {id: 2, key: "c", value: 2},
        {id: 3, key: "d", value: 3},
        {id: 4, key: "e", value: 4}
      ])
    })
  })
})
