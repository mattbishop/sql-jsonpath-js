import {expect} from "chai"
import {iterate} from "iterare"
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
    const actual = stmt.query(iterate([{a: 1}, {b: 2}, {a: 3}]))
    expect(actual.next().value).to.deep.equal({a: 1})
    expect(actual.next().value).to.deep.equal({a: 3})
    expect(actual.next().done).to.equal(true)
  })

  it("values", () => {
    const stmt = compile("$.a")
    const actual = stmt.value(iterate([{a: 1}, {b: 2}, {a: 3}]))
    expect(actual.next().value).to.equal(1)
    expect(actual.next().value).to.equal(3)
    expect(actual.next().done).to.equal(true)
  })
})
