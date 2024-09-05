import {expect} from "chai"
// testing from /dist to ensure the exported interface is correct
import {compile, one, SqlJsonPathStatement} from "../dist/index.js"
import {CachedIterable} from "indexed-iterable";
import {iterate} from "iterare";


describe("Statement tests", () => {
  it("exists", () => {
    const stmt: SqlJsonPathStatement = compile('$')
    const actual = stmt.exists("matt")
    expect(actual).to.be.true
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
    const iter = stmt.values(iterate([1, 2, 3]))
    expect(one(iter)).to.equal(1)
    expect(one(iter)).to.equal(2)
    expect(one(iter)).to.equal(3)
    expect(one(iter)).to.be.undefined
  })

  it("applies function to sequence", () => {
    const stmt = compile('$.type()')
    const actual = stmt.values(iterate(["matt", true, 100, ["mary", "abby"], {a: 4}]))
    expect(one(actual)).to.equal("string")
    expect(one(actual)).to.equal("boolean")
    expect(one(actual)).to.equal("number")
    expect(one(actual)).to.equal("array")
    expect(one(actual)).to.equal("object")
    expect(actual.next().done).to.be.true
  })

  it("unwraps sequence", () => {
    const stmt = compile('$[*]')
    const actual = stmt.values(iterate(["matt", true, 100, ["mary", "abby"], {a: 4}]))
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
    const actual = stmt.values(iterate(["matt", true, 100, ["mary", false], {a: 4}]))
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
    const actual = stmt.values(iterate(["matt", "angie", "mark", "mary", "abby"]))
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
    const actual = stmt.values(["mary", "angie"])
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
    const actual = stmt.values(iterate([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
  })

  it("understands dates", () => {
    const stmt = compile('$.datetime().type()')
    const actual = one(stmt.values("2020-02-01"))
    expect(actual).to.equal("date")
  })

  it("compares dates", () => {
    const stmt = compile('$ ? (@.datetime() == $a)')
    const actual = stmt.exists("2020-02-01", {variables: {a: new Date("2020-02-01")}})
    expect(actual).to.be.true
  })

  describe("compares arrays", () => {
    const vars = {variables: {a:[1, 2]}}
    it("lax comparison", () => {
      const stmt = compile('$ ? (@ == $a)')
      let actual = stmt.exists([1, 2], vars)
      expect(actual, "1, 2").to.be.true
      actual = stmt.exists([2], vars)
      expect(actual, "2").to.be.true
      actual = stmt.exists([1, 4, 2], vars)
      expect(actual, "1, 4, 2").to.be.true
      actual = stmt.exists([4, 2], vars)
      expect(actual, "4, 2").to.be.true
    })

    it("strict comparison, no unwrapping", () => {
      const stmt = compile('strict $ ? (@ == $a)')
      let actual = stmt.exists([1, 2], vars)
      expect(actual).to.be.false
    })

    it("strict comparison, with unwrapping", () => {
      const stmt = compile('strict $ ? (@[*] == $a[*])')
      let actual = stmt.exists([1, 2], vars)
      expect(actual, "1, 2").to.be.true
      actual = stmt.exists([2, 1], vars)
      expect(actual, "2, 1").to.be.true
      actual = stmt.exists([1, 4, 2], vars)
      expect(actual, "1, 4, 2").to.be.true
      actual = stmt.exists([4, 2], vars)
      expect(actual, "4, 2").to.be.true
    })
  })

  describe("default values", () => {
    it("uses default value on error", () => {
      const stmt = compile('strict $.thing')
      let actual = one(stmt.values({zz: "top"}, {defaultOnError: "Rock band"}))
      expect (actual).to.equal("Rock band")
      actual = stmt.exists({zz: "top"}, {defaultOnError: true})
      expect (actual).to.be.true
    })

    it("uses default value on empty", () => {
      const stmt = compile('$.thing')
      let actual = one(stmt.values({zz: "top"}, {defaultOnEmpty: "Rock band"}))
      expect (actual).to.equal("Rock band")
      actual = stmt.exists({zz: "top"}, {defaultOnEmpty: false})
      expect (actual).to.be.false
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
      const actual = iterate(numberGen()).map(stmt.exists)
      expect(Array.from(actual)).to.deep.equal([true, false, true, false, true, false, true, false, true, false])
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

  describe("README samples", () => {
    it("Usage section", () => {
      const statement = compile('$.name')

// data is an iterable of object values.
      const data = [
        { name: "scripty" },
        { name: "readme" },
        { noName: true }
      ]

// exists() looks for matches and returns true or false for each data element.
      const existsIterator = iterate(data).map(statement.exists)
      expect(Array.from(existsIterator)).to.deep.equal([true, true, false])

// values()
      const valuesIterator = statement.values(data[Symbol.iterator]())
      expect(Array.from(valuesIterator)).to.deep.equal(['scripty', 'readme'])
    })

    it("Iterators section", () => {
      const statement = compile('$ ? (@.size() > 3)')

      const data = [5, 65, 322, 78]

      const iteratedResult = iterate(data).map(statement.exists)
      expect(Array.from(iteratedResult)).to.deep.equal([false, false, false, false])
// data is an iterable, so statement iterates through the elements and applies the statement
// [false, false, false, false]

      const singleResult = statement.exists(data)
      expect(singleResult).to.be.false
// false
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

    const dataIterator = new CachedIterable(data)

    it("coalesce phones arrays", () => {
      const stmt = compile('$.phones."phone#"')
      const actual = stmt.values(dataIterator)
      expect(Array.from(actual)).to.deep.equal([
        "650-506-7000",
        "650-555-5555",
        "88-888-8888"
      ])
    })

    it("finds the folks who have a phone#", () => {
      const stmt = compile('$ ? (exists(@.phones."phone#") || exists(@."phone#")).name')
      const actual = stmt.values(dataIterator)
      expect(Array.from(actual)).to.deep.equal([
        "Fred",
        "Molly",
        "Afu"
      ])
    })

    describe("reuse same statement", () => {
      const stmt = compile('$ ? (@.name == $aName)')

      it("sees if folks exist by name", () => {
        let aName = "Fred"
        const tester = (d: any) => stmt.exists(d, {variables: {aName}})

        let actual = iterate(data).map(tester)
        // first
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
        // third
        aName = "Afu"
        actual = iterate(data).map(tester)
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
        // fourth
        aName = "Justin"
        actual = iterate(data).map(tester)
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.false
        expect(one(actual)).to.be.true
        expect(one(actual)).to.be.false
        expect(actual.next().done).to.be.true
      })

      it("finds folk's value by name", () => {
        let actual = stmt.values(dataIterator, {variables: {aName: "Fred"}})
        expect(one(actual)).to.deep.equal(data[0])
        actual = stmt.values(dataIterator, {variables: {aName: "Afu"}})
        expect(one(actual)).to.deep.equal(data[2])
        actual = stmt.values(dataIterator, {variables: {aName: "U La La"}})
        expect(one(actual)).to.deep.equal(data[4])
      })
    })

    describe("doc examples", () => {
      it("reuses statement", () => {
        // compile a statement
        const statement = compile('$.name')

        const hasName = { name: "scripty" },
              noName = { noName: true }

        expect(statement.exists(hasName)).to.be.true
        expect(statement.exists(noName)).to.be.false

        const valuesIterator = statement.values([hasName, noName])
        expect(Array.from(valuesIterator)).to.deep.equal(["scripty"])
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
      expect (stmt.exists(data)).to.be.true

      stmt = compile('$.store.book.title ? (@ starts with "S")')
      actual = stmt.values(data)
      expect (Array.from(actual)).to.deep.equal(["Sayings of the Century", "Sword of Honour"])

      stmt = compile('$.store.bicycle ? (@.colour like_regex "^RED$" flag "i")')
      const actualExists = stmt.exists(data)
      expect (actualExists).to.be.true

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
