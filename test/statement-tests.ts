import {expect} from "chai"
// testing from /dist to ensure the exported interface is correct
import {compile, one, SqlJsonPathStatement} from "../dist/index.js"


describe("Statement tests", () => {
  it("exists", () => {
    const stmt: SqlJsonPathStatement = compile('$')
    const actual = stmt.exists("matt")
    expect(actual.next().value).to.be.true
    expect(actual.next().done).to.be.true
  })

  it("queries", () => {
    const stmt = compile('$.a')
    const actual = stmt.query([{a: 1}, {b: 2}, {a: 3}])
    expect(actual.next().value).to.deep.equal({a: 1})
    expect(actual.next().value).to.deep.equal({a: 3})
    expect(actual.next().done).to.be.true
  })

  it("values", () => {
    const stmt = compile('$.a')
    const actual = stmt.values([{a: 1}, {b: 2}, {a: 3}])
    expect(actual.next().value).to.equal(1)
    expect(actual.next().value).to.equal(3)
    expect(actual.next().done).to.be.true
  })

  it("one", () => {
    const stmt = compile('$')
    const iter = stmt.values([1, 2, 3])
    expect(one(iter)).to.equal(1)
    expect(one(iter)).to.equal(2)
    expect(one(iter)).to.equal(3)
    expect(one(iter)).to.be.undefined
  })

  it("applies function to sequence", () => {
    const stmt = compile('$.type()')
    const actual = stmt.values(["matt", true, 100, ["mary", "abby"], {a: 4}])
    expect(one(actual)).to.equal("string")
    expect(one(actual)).to.equal("boolean")
    expect(one(actual)).to.equal("number")
    expect(one(actual)).to.equal("array")
    expect(one(actual)).to.equal("object")
    expect(actual.next().done).to.be.true
  })

  it("unwraps sequence", () => {
    const stmt = compile('$[*]')
    const actual = stmt.values(["matt", true, 100, ["mary", "abby"], {a: 4}])
    expect(one(actual)).to.equal("matt")
    expect(one(actual)).to.be.true
    expect(one(actual)).to.equal(100)
    expect(one(actual)).to.equal("mary")
    expect(one(actual)).to.equal("abby")
    expect(one(actual)).to.deep.equal({a: 4})
    expect(actual.next().done).to.be.true
  })

  it("unwraps sequence and applies type()", () => {
    const stmt = compile('$[*].type()')
    const actual = stmt.values(["matt", true, 100, ["mary", false], {a: 4}])
    expect(one(actual)).to.equal("string")
    expect(one(actual)).to.equal("boolean")
    expect(one(actual)).to.equal("number")
    expect(one(actual)).to.equal("string")
    expect(one(actual)).to.equal("boolean")
    expect(one(actual)).to.deep.equal("object")
    expect(actual.next().done).to.be.true
  })

  it("extracts values from an array", () => {
    const stmt = compile('$ ? (@ starts with "m")')
    const actual = stmt.values(["matt", "angie", "mark", "mary", "abby"])
    expect(one(actual)).to.equal("matt")
    expect(one(actual)).to.equal("mark")
    expect(one(actual)).to.equal("mary")
    expect(actual.next().done).to.be.true
  })

  it("unwraps sequence of arrays", () => {
    const stmt = compile('$.things[*][*]')
    const actual = stmt.values({things:[["matt", true], 100, ["mary", "abby"], [{a: 4}]]})
    expect(one(actual)).to.equal("matt")
    expect(one(actual)).to.be.true
    expect(one(actual)).to.equal(100)
    expect(one(actual)).to.equal("mary")
    expect(one(actual)).to.equal("abby")
    expect(one(actual)).to.deep.equal({a: 4})
    expect(actual.next().done).to.be.true
  })

  it("strictly unwraps sequence of arrays", () => {
    const stmt = compile('strict $.things[*][*]')
    const actual = stmt.values({things:[["matt", true], [1, 2], [{a: 4}]]})
    expect(one(actual)).to.equal("matt")
    expect(one(actual)).to.be.true
    expect(one(actual)).to.equal(1)
    expect(one(actual)).to.equal(2)
    expect(one(actual)).to.deep.equal({a: 4})
    expect(actual.next().done).to.be.true
  })

  it("searches array with an named array value on right side of comparison", () => {
    const stmt = compile('$.players ? (@ == $names[*])')
    const variables = {names:["mary", "angie"]}
    const actual = stmt.values({players:["matt", "angie", "mark", "mary", "abby"]}, {variables})
    expect(one(actual)).to.equal("angie")
    expect(one(actual)).to.equal("mary")
    expect(actual.next().done).to.be.true
  })

  it("strict searches array with an named array value on right side of comparison", () => {
    const stmt = compile('strict $ ? (@[*] == "mary")')
    const actual = stmt.values([["mary", "angie"]])
    const first = one(actual)
    expect(first).to.deep.equal(["mary", "angie"])
    expect(actual.next().done).to.be.true
  })

  it("searches array with an named array value on right side of comparison", () => {
    const stmt = compile('$.players ? (@ == $names)')
    const variables = {names:["mary", "angie"]}
    const actual = stmt.values({players:["matt", "angie", "mark", "mary", "abby"]}, {variables})
    expect(one(actual)).to.equal("angie")
    expect(one(actual)).to.equal("mary")
    expect(actual.next().done).to.be.true
  })

  it("strict does not unwrap named array, but also does not throw an error.", () => {
    const stmt = compile('strict $.players ? ($names == @)')
    const variables = {names:["mary", "angie"]}
    const actual = stmt.values({players:["matt", "angie", "mark", "mary", "abby"]}, {variables})
    expect(actual.next().done).to.be.true
  })

  it("searches array with an unwrapped named array value on left side of comparison", () => {
    const stmt = compile('$.players ? ($names == @)')
    const variables = {names:["mary", "angie"]}
    const actual = stmt.values({players:["matt", "angie", "mark", "mary", "abby"]}, {variables})
    expect(one(actual)).to.equal("angie")
    expect(one(actual)).to.equal("mary")
    expect(actual.next().done).to.be.true
  })

  it("searches array with a specific element in a named array value", () => {
    const stmt = compile('$.players ? ($names.first[1] == @)')
    // return ƒ.filter(ƒ.member($,"players"),v=>ƒ.compare("==",v,ƒ.array(ƒ.member($$("names"),"first"),[1])))
    const variables = {names:{first:["mary", "angie"]}}
    const actual = stmt.values({players:["matt", "angie", "mark", "mary", "abby"]}, {variables})
    expect(one(actual)).to.equal("angie")
    expect(actual.next().done).to.be.true
  })

  it("can do arithmetic", () => {
    const stmt = compile('$ ? (@ % 2 == 0)')
    const actual = stmt.values([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
  })

  it("understands dates", () => {
    const stmt = compile('$.datetime().type()')
    const actual = one(stmt.values("2020-02-01"))
    expect(actual).to.equal("date")
  })

  it("compares dates", () => {
    const stmt = compile('$ ? (@.datetime() == $a)')
    const actual = one(stmt.exists("2020-02-01", {variables: {a: new Date("2020-02-01")}}))
    expect(actual).to.be.true
  })

  describe("default values", () => {
    it("uses default value on error", () => {
      const stmt = compile('strict $.thing')
      let actual = one(stmt.values({zz: "top"}, {defaultOnError: "Rock band"}))
      expect (actual).to.equal("Rock band")
      actual = one(stmt.exists({zz: "top"}, {defaultOnError: true}))
      expect (actual).to.be.true
      actual = one(stmt.query({zz: "top"}, {defaultOnError: {y: "azoo"}}))
      expect (actual).to.deep.equal({y: "azoo"})
    })

    it("uses default value on empty", () => {
      const stmt = compile('$.thing')
      let actual = one(stmt.values({zz: "top"}, {defaultOnEmpty: "Rock band"}))
      expect (actual).to.equal("Rock band")
      actual = one(stmt.exists({zz: "top"}, {defaultOnEmpty: false}))
      expect (actual).to.be.false
      actual = one(stmt.query({zz: "top"}, {defaultOnEmpty: {y: "azoo"}}))
      expect (actual).to.deep.equal({y: "azoo"})
    })
  })

  describe("filter generators", () => {
    const numberGen = function* () {
      for (let i = 0; i < 10; i++) {
        yield i
      }
    }
    const stmt = compile('$ ? (@ % 2 == 0)')
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
    const stmt = compile('$.keyvalue()')

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
      const stmt = compile('$.phones."phone#"')
      const actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([
        "650-506-7000",
        "650-555-5555",
        "88-888-8888"
      ])
    })

    it("finds the folks who have a phone#", () => {
      const stmt = compile('$ ? (exists(@.phones."phone#") || exists(@."phone#")).name')
      const actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([
        "Fred",
        "Molly",
        "Afu"
      ])
    })

    describe("reuse same statement", () => {
      const stmt = compile('$ ? (@.name == $aName)')

      it("sees if folks exist by name", () => {
        let actual = stmt.exists(data, {variables: {aName: "Fred"}})
        // first
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
        // third
        actual = stmt.exists(data, {variables: {aName: "Afu"}})
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
        // fourth
        actual = stmt.exists(data, {variables: {aName: "Justin"}})
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
      })

      it("queries folks by name", () => {
        let actual = stmt.query(data, {variables: {aName: "Fred"}})
        expect(one(actual)).to.deep.equal(data[0])
        actual = stmt.query(data, {variables: {aName: "Afu"}})
        expect(one(actual)).to.deep.equal(data[2])
        actual = stmt.query(data, {variables: {aName: "U La La"}})
        expect(one(actual)).to.deep.equal(data[4])
        actual = stmt.query(data, {variables: {aName: "Snape"}})
        expect(actual.next().done).to.be.true
      })

      it("finds folk's value by name", () => {
        let actual = stmt.values(data, {variables: {aName: "Fred"}})
        expect(one(actual)).to.deep.equal(data[0])
        actual = stmt.values(data, {variables: {aName: "Afu"}})
        expect(one(actual)).to.deep.equal(data[2])
        actual = stmt.values(data, {variables: {aName: "U La La"}})
        expect(one(actual)).to.deep.equal(data[4])
      })
    })

    describe("doc examples", () => {
      it("reuses statement", () => {
        // compile a statement
        const statement = compile('$.name')

        const data = [
          { name: "scripty" },
          { name: "readme" },
          { noName: true }
        ]

        const existsIterator = statement.exists(data)
        expect(Array.from(existsIterator)).to.deep.equal([true, true, false])

        const queryIterator = statement.query(data)
        expect(Array.from(queryIterator)).to.deep.equal([{name: "scripty"}, {name: "readme"}])

        const valuesIterator = statement.values(data)
        expect(Array.from(valuesIterator)).to.deep.equal(["scripty", "readme"])
      })
    })

    it("queries the store", () => {
      const data = {
        "store": {
          "book": [
            { "category": "reference",
              "author": "Nigel Rees",
              "title": "Sayings of the Century",
              "price": 8.95
            },
            { "category": "fiction",
              "author": "Evelyn Waugh",
              "title": "Sword of Honour",
              "price": 12.99
            },
            { "category": "fiction",
              "author": "Herman Melville",
              "title": "Moby Dick",
              "isbn": "0-553-21311-3",
              "price": 8.99
            },
            { "category": "fiction",
              "author": "J. R. R. Tolkien",
              "title": "The Lord of the Rings",
              "isbn": "0-395-19395-8",
              "price": 22.99
            }
          ],
          "bicycle": {
            "colour": "red",
            "price": 19.95
          }
        }
      }

      let stmt = compile('$.store.book[*].author')
      let actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal(["Nigel Rees", "Evelyn Waugh", "Herman Melville", "J. R. R. Tolkien"])

      stmt = compile('$.store')
      actual = stmt.values(data)
      expect (Array.from(actual)[0]).to.deep.equal(data.store)

      stmt = compile('$.store.book[2]')
      actual = stmt.values(data)
      expect (Array.from(actual)[0]).to.deep.equal(data.store.book[2])

      stmt = compile('$.store.book[last]')
      actual = stmt.values(data)
      expect (Array.from(actual)[0]).to.deep.equal(data.store.book.at(-1))

      stmt = compile('$.store.book[0 to 2]')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store.book[0], data.store.book[1], data.store.book[2]])

      stmt = compile('$.store.book ? (exists(@.isbn))')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store.book[2], data.store.book[3]])

      stmt = compile('$.store.book ? (!exists(@.isbn))')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store.book[0], data.store.book[1]])

      stmt = compile('$.store.book.price ? (@ > 10)')
      actual = stmt.query(data)
      expect (one(actual)).to.deep.equal(data)
      expect (actual.next().done).to.be.true

      stmt = compile('$.store.book.title ? (@ starts with "S")')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal(["Sayings of the Century", "Sword of Honour"])

      stmt = compile('$.store.bicycle ? (@.colour like_regex "^RED$" flag "i")')
      actual = stmt.exists(data)
      expect (Array.from(actual)).to.deep.equal([true])

      stmt = compile('$.store.book ? (@.price > 10)')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store.book[1], data.store.book[3]])

      stmt = compile('$.store ? ((@.book.price > 10) || (@.bicycle.price > 10))')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store])

      stmt = compile('$.* ? (exists(@.book) || exists(@.bicycle)).*[*] ? (@.price > 10)')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal([data.store.book[1], data.store.book[3], data.store.bicycle])
    })

    it("pg track", () => {
      const data = {
        "track": {
          "segments": [
            {
              "location":   [ 47.763, 13.4034 ],
              "start time": "2018-10-14 10:05:14",
              "HR": 73
            },
            {
              "location":   [ 47.706, 13.2635 ],
              "start time": "2018-10-14 10:39:21",
              "HR": 135
            }
          ]
        }
      }

      let stmt = compile('$.track.segments')
      let actual = stmt.values(data)
      expect(one(actual)).to.deep.equal(data.track.segments)

      stmt = compile('$.track.segments[*].location')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([data.track.segments[0].location, data.track.segments[1].location])

      stmt = compile('$.track.segments[0].location')
      actual = stmt.values(data)
      expect(one(actual)).to.deep.equal(data.track.segments[0].location)

      stmt = compile('$.track.segments.size()')
      actual = stmt.values(data)
      expect(one(actual)).to.deep.equal(2)

      stmt = compile('$.track.segments[*].HR ? (@ > 130)')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([135])

      stmt = compile('$.track.segments[*] ? (@.HR > 130)."start time".datetime()')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([new Date("2018-10-14 10:39:21")])

      stmt = compile('$.track.segments[*] ? (@.location[1] < 13.4).HR ? (@ > 130)')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([135])

      stmt = compile('$.track ? (exists(@.segments[*] ? (@.HR > 130))).segments.size()')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([2])
    })
  })
})
