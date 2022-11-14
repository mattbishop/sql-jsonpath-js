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

  describe("spec tests", () => {
    const data = [{
      name: "Fred",
      phonetype: "work",
      "phone#": "650-506-2051"
    }, {
      name: "Molly",
      phones: [ {
        phonetype: "work",
        "phone#": "650-506-7000"
      }, {
        phonetype: "cell",
        "phone#": "650-555-5555"
      }]
    }, {
      name: "Afu",
      phones: [{
        phonetype: "cell",
        "phone#": "88-888-8888"
      }]
    }, {
      name: "Justin"
    }, {
      name: "U La La",
      phones: []
    }]

    it("coalesce phones arrays", () => {
      const stmt = compile("$.phones.\"phone#\"")
      const actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([
        "650-506-7000",
        "650-555-5555",
        "88-888-8888"
      ])
    })

    it("finds the folks who have a phone#", () => {
      const stmt = compile("$ ? (exists(@.phones.\"phone#\") || exists(@.\"phone#\")).name")
      const actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([
        "Fred",
        "Molly",
        "Afu"
      ])
    })

    describe("reuse same statement", () => {
      const stmt = compile("$ ? (@.name == $aName)")

      it("sees if folks exist by name", () => {
        let actual = stmt.exists(data, {aName: "Fred"})
        // first
        expect(actual.next().value).to.be.true
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().done).to.be.true
        // third
        actual = stmt.exists(data, {aName: "Afu"})
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.true
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().done).to.be.true
        // fourth
        actual = stmt.exists(data, {aName: "Justin"})
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.false
        expect(actual.next().value).to.be.true
        expect(actual.next().value).to.be.false
        expect(actual.next().done).to.be.true
      })

      it("queries folks by name", () => {
        let actual = stmt.query(data, {aName: "Fred"})
        expect(actual.next().value).to.deep.equal(data[0])
        actual = stmt.query(data,  {aName: "Afu"})
        expect(actual.next().value).to.deep.equal(data[2])
        actual = stmt.query(data,  {aName: "U La La"})
        expect(actual.next().value).to.deep.equal(data[4])
        actual = stmt.query(data,  {aName: "Snope"})
        expect(actual.next().done).to.be.true
      })

      it("finds folk's value by name", () => {
        const config = {defaultOnEmpty: "EMPTY"}
        let actual = stmt.values(data, {...config, namedVariables: {aName: "Fred"}})
        expect(actual.next().value).to.deep.equal(data[0])
        actual = stmt.values(data,  {...config, namedVariables: {aName: "Afu"}})
        expect(actual.next().value).to.deep.equal(data[2])
        actual = stmt.values(data,  {...config, namedVariables: {aName: "U La La"}})
        expect(actual.next().value).to.deep.equal(data[4])
        actual = stmt.values(data,  {...config, namedVariables: {aName: "Snope"}})
        expect(actual.next().value).to.deep.equal("EMPTY")
      })
    })
  })
})
