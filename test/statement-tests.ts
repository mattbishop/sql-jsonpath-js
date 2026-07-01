import {expect} from "chai"
import {CachedIterable} from "indexed-iterable"
import {isIterator} from "iterare/lib/utils.js"
import {iterate} from "iterare"
import * as assert from "node:assert"
import {after, describe, it} from "node:test"
import {PGlite} from "@electric-sql/pglite"


// better for debugging issues
import {compile, one} from "../src/index.ts"
import {isIterableInput} from "../src/iterators.ts"
import type {Input} from "../src/json-path.ts"

// testing from /dist to ensure the exported interface is correct

/*
import {compile, one} from "../dist/index.js"
*/

const pg = await PGlite.create()

after(async () => {
  await pg.close()
})


async function testCompareToPg(statement: string, data: Input<any>, variables?: Record<string, unknown>) {
  await testExistsCompareToPg(statement, data, variables)
  await testValuesCompareToPg(statement, data, variables)
  if (Array.isArray(data)) {
    await testExistsCompareToPg(statement, data.values(), variables)
    await testValuesCompareToPg(statement, data.values(), variables)
  }
}


async function testExistsCompareToPg(statement: string, data: Input<any>, variables?: Record<string, unknown>) {
  if (!isIterableInput(data)) {
    data = [data]
  }
  const stmt = compile(statement)
  for (const datum of data) {
    const pgActual = await pgExists(statement, datum, variables)
    let actual
    try {
      actual = stmt.exists(datum, {variables})
    } catch (e) {
      actual = e as Error
    }
    if (actual instanceof Error) {
      expect(pgActual instanceof Error).to.be.true
      console.info(`actual: ${actual.message}, pgActual: ${(pgActual as Error).message}`)
    } else {
      expect(actual).to.equal(pgActual)
    }
  }
}

async function testValuesCompareToPg(statement: string, data: Input<any>, variables?: Record<string, unknown>) {
  if (!isIterableInput(data)) {
    data = [data]
  }
  const stmt = compile(statement)
  for (const datum of data) {
    const pgActual = await pgValues(statement, datum, variables)
    let actual
    try {
      actual = Array.from(stmt.values(datum, {variables}))
    } catch (e) {
      actual = e as Error
    }
    if (actual instanceof Error) {
      expect(pgActual instanceof Error).to.be.true
      console.info(`actual: ${actual.message}, pgActual: ${(pgActual as Error).message}`)
    } else {
      expect(actual).to.deep.equal(pgActual)
    }
  }
}

async function pgExists(statement: string, data: any, vars?: Record<string, unknown>): Promise<boolean | Error> {
  try {
    const result = await _pgTest("exists", statement, data, vars)
    assert.strictEqual(result.length, 1, `pgExists returned unexpected result: ${result}`)
    return result[0] as boolean
  } catch (e) {
    return e as Error
  }
}

async function pgQuery(statement: string, data: any, vars?: Record<string, unknown>) {
  return _pgTest("query", statement, data, vars)
}

async function pgValues(statement: string, data: any, vars?: Record<string, unknown>) {
  try {
    if (isIterableInput(data)) {
      const results = await Promise.all(
        Array.from(data).map((element) => pgQuery(statement, element, vars))
      )
      return results.flat()
    }
    return await pgQuery(statement, data, vars)
  } catch (e) {
    return e as Error
  }
}

async function _pgTest(method: string, statement: string, data: any, vars: Record<string, unknown> = {}) {
  const result = await pg.query<{value: unknown}>(`
    SELECT jsonb_path_${method}(
      $1::JSONB,
      $2,
      $3::JSONB
    ) AS value`, [
      JSON.stringify(data),
      statement,
      JSON.stringify(vars)
  ])

  return result.rows.map(({value}) => value)
}
const url = new URL("http://somewhere")

describe("Statement tests", () => {
  it("exists", async () => {
    const src = '$'
    const data = "matt"
    await testExistsCompareToPg(src, data)
  })

  describe("public compile error handling", () => {
    it("throws for lexical errors", () => {
      expect(() => compile("$ # bad")).to.throw
    })

    it("throws for parser errors", () => {
      expect(() => compile("$.")).to.throw
    })
  })

  describe("public exists return shape", () => {
    it("returns an iterator of booleans for iterable input", async () => {
      const src = '$.name'
      const data = [
        {name: "Ada"},
        {missing: true},
        {name: "Grace"}
      ]
      const statement = compile(src)
      const actual = statement.exists(data.values())
      expect(actual).to.not.be.a("boolean")
      expect(isIterator(actual)).to.be.true
      await testCompareToPg(src, data)
    })

    it("returns false for a single input with no match", async () => {
      const src = '$.missing'
      const data = {name: "Ada"}
      await testCompareToPg(src, data)
    })
  })

  it("values", async () => {
    const src = '$.a'
    const data = [{a: 1}, {b: 2}, {a: 3}]
    await testCompareToPg(src, data.values())
  })

  it("named variables", async () => {
    const src = '$n'
    const data = ""
    const vars = {n: "frosty"}
    await testCompareToPg(src, data, vars)
  })

  it("missing named variables throws", () => {
    const stmt = compile('$n')
    expect(() => stmt.exists(null, {variables: {wrong: true}})).to.throw
  })

  it("one() takes one from an iterator and advances", () => {
    const stmt = compile('$')
    const iter = stmt.values([1, 2, 3].values())
    expect(one(iter)).to.equal(1)
    expect(one(iter)).to.equal(2)
    expect(one(iter)).to.equal(3)
    expect(iter.next().done).to.be.true
  })

  it("applies function to sequence", async () => {
    const src = '$.type()'
    const data = ["matt", true, 100, ["mary", "abby"], {a: 4}]
    await testCompareToPg(src, data)
  })

  it("unwraps sequence", async () => {
    const src = '$[*]'
    const data = ["matt", true, 100, ["mary", "abby"], {a: 4}]
    await testCompareToPg(src, data)
  })

  it("strictly unwraps sequence", async () => {
    const src = 'strict $[*]'
    const data = ["matt", true, 100, ["mary", "abby"], {a: 4}]
    await testCompareToPg(src, data)
  })

  it("unwraps sequence and applies type()", async () => {
    const src = '$[*].type()'
    const data = ["matt", true, 100, ["mary", false], {a: 4}, undefined]
    // testing 'exists' makes no sense for this function.
    await testValuesCompareToPg(src, data)
  })

  /*
    strict: pg returns [] (empty results), code returns false
    lax:    pg returns ["matt", "mark", "mary"], code returns false

    lax unwraps the data into an iterator, and filters back the items therein.
      It goes into iterator mode for filter
    strict does not unwrap, and returns an empty result
   */
  it("extracts values from an array", async () => {
    const src = '$ ? (@ starts with "m")'
    const data = ["matt", "angie", "mark", "mary", "abby"]
    await testCompareToPg(src, data)
  })

  it("does not extract values from an array in strict mode", async () => {
    const src = 'strict $ ? (@ starts with "m")'
    const data = ["matt", "angie", "mark", "mary", "abby"]
    await testCompareToPg(src, data)
  })

  it("unwraps sequence of arrays", async () => {
    const src = '$.things[*][*]'
    const data = {things: [["matt", true], 100, ["mary", "abby"], [{a: 4}]]}
    await testCompareToPg(src, data)
  })

  it("strictly unwraps sequence of arrays", async () => {
    const src = 'strict $.things[*][*]'
    const data = {things: [["matt", true], [1, 2], [{a: 4}]]}
    await testCompareToPg(src, data)
  })

  it("searches array with an unboxed named array value on right side of comparison", async () => {
    const src = '$.players ? (@ == $names[*])'
    const data = {players: ["matt", "mark", "angie", "abby", "mary"]}
    const variables = {names: ["mary", "bob", "angie"]}
    await testCompareToPg(src, data, variables)
  })

  /*
    PG behavior:
      lax:
        @ and @[*] both return an iterator of the name matches, not the data array
      strict:
        @ returns []
        @[*] returns data array
   */
  it("strict searches array with an named array value on right side of comparison", async () => {
    const src = 'strict $ ? (@[*] == "angie")'
    const data = ["mary", "angie"]
    await testValuesCompareToPg(src, data)
  })

  it("searches array with an named array value on right side of comparison", async () => {
    const src = '$.players ? (@ == $names)'
    const data = {players: ["matt", "angie", "mark", "mary", "abby"]}
    const variables = {names: ["mary", "angie"]}
    await testValuesCompareToPg(src, data, variables)
  })

  it("strict does not unwrap named array, but also does not throw an error.", async () => {
    const src = 'strict $.players ? ($names == @)'
    const data = {players: ["matt", "angie", "mark", "mary", "abby"]}
    const variables = {names: ["mary", "angie"]}
    await testValuesCompareToPg(src, data, variables)
  })

  it("searches array with an unwrapped named array value on left side of comparison", async () => {
    const src = '$.players ? ($names == @)'
    const data = {players: ["matt", "angie", "mark", "mary", "abby"]}
    const variables = {names: ["mary", "angie"]}
    await testValuesCompareToPg(src, data, variables)
  })

  it("searches array with a specific element in a named array value", async () => {
    const src = '$.players ? ($names.first[1] == @)'
    const data = {players: ["matt", "angie", "mark", "mary", "abby"]}
    const variables = {names: {first: ["mary", "angie"]}}
    await testValuesCompareToPg(src, data, variables)
  })

  it("can filter by arithmetic", async () => {
    const src = '$ ? (@ % 2 == 0)'
    const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].values()
    await testValuesCompareToPg(src, data)
  })


  describe("filter", () => {
    describe("lax compare", () => {
      it("can filter comparison predicates", async () => {
        await testValuesCompareToPg('$ ? (@ == 1)', 1)
      })

      it("can filter comparison ! predicates", async () => {
        await testValuesCompareToPg('$ ? (!(@ == 1))', 3)
      })

      it("can filter comparison predicate iterators", async () => {
        await testValuesCompareToPg('$ ? (@[*] == 1)', [[1], [21, 7], [5, 1]])
      })

      it("can filter multiple comparison predicates", async () => {
        const src = '$ ? (@[*] == 2 && @[*] + 1 == 3)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("can filter value accessor predicates", async () => {
        const src = '$ ? (@.sleepy == true)'
        const data = [{sleepy: true}, {sleepy: false}, {sleepy: "yes"}, {not: 1}]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("filter and boolean branches", () => {
      it("swallows filter errors and treats them as false", async () => {
        const src = '$ ? (@.double() > 1)'
        const data = ["not-a-number", "2", 3]
        await testValuesCompareToPg(src, data)
      })

      it("short-circuits OR when the first predicate is true", async () => {
        const src = '$ ? (@ == 1 || @.double() > 1)'
        // the values() array input is not being treated like a single item, it is being iterated over
        const data = [1, "not-a-number", "2"].values()
        await testValuesCompareToPg(src, data)
      })

      it("short-circuits AND when the first predicate is false", async () => {
        const src = '$ ? (@ == 1 && @.double() > 1)'
        const data = [1, "not-a-number", "2"]
        await testValuesCompareToPg(src, data)
      })

      it("treats exists errors as unknown", async () => {
        const src = '$ ? ((exists(@.double())) is unknown)'
        const data = ["not-a-number", "2"]
        await testValuesCompareToPg(src, data)
      })

      it("can filter multiple predicates with && and ||", async () => {
        const src = '$ ? ((@.a==1 || @.b==2 || @.b==3) && @.c=="hi")'
        const data = [{a: 1, c: "hi"}, {b: 2, c: "hi"}, {b: 3, c: "hi"}, {a: "yes"}, {a: 4, c: "hi"}]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("strict iterator and structural branches", () => {
      it("supports strict member access over iterable inputs", async () => {
        const src = 'strict $.name'
        const data = new Set([
          {name: "Ada"},
          {name: "Grace"}
        ])
        await testValuesCompareToPg(src, data)
      })

      it("supports strict wildcard array access over iterable inputs", async () => {
        const src = 'strict $[*]'
        const data = new Set([
          [1, 2],
          [3, 4]
        ])
        await testValuesCompareToPg(src, data)
      })
    })

    describe("default on error and empty", () => {
      const defaultName = "no name"

      it("uses defaultOnError with false", () => {
        const statement = compile('strict $.name')
        const actual = one(statement.values({}, {defaultOnError: defaultName}))
        expect(actual).to.equal(defaultName)
      })

      it("uses defaultOnEmpty with false", () => {
        const statement = compile('$.name')
        const actual = one(statement.values({}, {defaultOnEmpty: defaultName}))
        expect(actual).to.equal(defaultName)
      })
    })

    describe("strict filter", () => {
      it("filter does not unwrap arrays in strict mode, and does not throw errors", async () => {
        const src = 'strict $ ? (@.sleepy == true)'
        const data = [{sleepy: true}, {sleepy: false}, {sleepy: "yes"}, {not: 1}]
        await testValuesCompareToPg(src, data)
      })

      it("can filter predicate", async () => {
        const src = 'strict $ ? (@ == 1)'
        await testValuesCompareToPg(src, 1)
      })
    })

    describe("comparison operators", () => {
      it("supports not-equals comparison operator <>", async () => {
        const src = '$ ? (@ <> 2)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("supports not-equals comparison operator !=", async () => {
        const src = '$ ? (@ != 2)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("supports greater-than-or-equal comparison", async () => {
        const src = '$ ? (@ >= 2)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("supports less-than comparison", async () => {
        const src = '$ ? (@ < 2)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("supports less-than-or-equal comparison", async () => {
        const src = '$ ? (@ <= 2)'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })

      it("returns no matches for incomparable values", async () => {
        const src = '$ ? (@ > "2")'
        const data = [1, 2, 3]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("'exists'", () => {
      it("can filter predicates on members", async () => {
        const src = '$ ? (exists(@.z))'
        const data = [{z: true}, {y: false}, {a: "yes"}]
        await testValuesCompareToPg(src, data)
      })

      it("can filter ! predicates on members", async () => {
        const src = '$ ? (!exists(@.z))'
        const data = [{z: true}, {y: false}, {a: "yes"}]
        await testValuesCompareToPg(src, data)
      })

      it("can filter predicates and extract members", async () => {
        const src = '$ ? (exists(@.z)).z'
        const data = [{z: 121.2}, {y: -99.828}, {a: "yes"}]
        await testValuesCompareToPg(src, data)
      })

      it("can filter predicate iterators", async () => {
        const src = '$ ? (exists(@[*].z))'
        const data = [[{z: true}, {y: false}], [{a: "yes"}], [{q: 6, z: 1}]]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("'is unknown'", () => {
      it("can filter 'is unknown' predicates", async () => {
        const src = '$ ? ((@.sleepy == true) is unknown)'
        const data = [{sleepy: 77}, {sleepy: true}, {sleepy: false}, {sleepy: "yes"}]
        await testValuesCompareToPg(src, data)
      })

      it("can filter 'is unknown' predicate iterators", async () => {
        const src = '$ ? ((@[*] == true) is unknown)'
        // [false, 100] is known (false)
        // [true] is known
        const data = [[false, 100], [true], ["baby", true, {"g": 22}]]
        await testValuesCompareToPg(src, data)
      })

      it("can filter ! 'is unknown' predicate iterators", async () => {
        const src = '$ ? ((!(@[*] == true)) is unknown)'
        const data = [[false, 100], [true], ["baby", true, {"g": 22}]]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("starts with", () => {
      it("can filter 'starts with' predicates", async () => {
        const src = '$ ? (@ starts with "a")'
        const data = ["apple", "orange", "argon"]
        await testValuesCompareToPg(src, data)
      })

      it("can filter iterator values", async () => {
        const src = '$ ? (@[*] starts with "m")'
        const data = [["matt"], ["arjun", "mark", "mary"], ["abby"]]
        await testValuesCompareToPg(src, data)
      })
    })

    describe("can filter 'like_regex' predicates", () => {
      it("without flags", () => {
        const statement = compile('$ ? (@ like_regex "\\\\d+")')
        const actual = statement.values(["8854", "bear"])
        expect(Array.from(actual)).to.deep.equal(["8854"])
      })

      it("with flags", () => {
        const statement = compile('$ ? (@ like_regex "court" flag "i")')
        const actual = statement.values(["cOuRt", "COURT", 17])
        expect(Array.from(actual)).to.deep.equal(["cOuRt", "COURT"])
      })

      it("can filter an iterator of values", () => {
        const statement = compile('$ ? (@[*] like_regex "\\\\d+")')
        const actual = statement.values([true, ["bear", "8854"], ["not a number"], ["1", "-2"]])
        expect(Array.from(actual)).to.deep.equal([["bear", "8854"], ["1", "-2"]])
      })
    })

    it("chains filters", () => {
      const data = [[{"z": true}, {"y": false}], [{"a": "yes"}], [{"z": 1}]]
      let statement = compile('$ ? (exists(@[*].z))')
      const actualExists = statement.values(data)
      expect(Array.from(actualExists)).to.deep.equal([[{"z": true}, {"y": false}], [{"z": 1}]])

      statement = compile('$ ? (@.size() > 0)')
      const actualSize = statement.values(data)
      expect(Array.from(actualSize)).to.deep.equal(data)

      statement = compile('$ ? (exists(@[*].z)) ? (@.size() > 0)')
      const actualChain = statement.values(data)
      expect(Array.from(actualChain)).to.deep.equal([{"z": true}, {"y": false}, {"z": 1}])
    })
  })

  describe("strict filter", () => {
    it("filter does not unwrap arrays in strict mode, and does not throw errors", () => {
      const statement = compile('strict $ ? (@.sleepy == true)')
      const actual = statement.values([{sleepy: true}, {sleepy: false}, {sleepy: "yes"}, {not: 1}])
      expect(Array.from(actual)).to.deep.equal([])
    })

    it("can filter predicate", () => {
      const statement = compile('strict $ ? (@ == 1)')
      const actual = statement.values(1)
      expect(one(actual)).to.deep.equal(1)
    })
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
    })

    it("uses default value on empty", () => {
      const stmt = compile('$.thing')
      let actual = one(stmt.values({zz: "top"}, {defaultOnEmpty: "Rock band"}))
      expect (actual).to.equal("Rock band")
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



  describe("size()", () => {
    it ("single values", () => {
      const statement = compile('$.size()')
      const nullSize = one(statement.values(null))
      expect(nullSize).to.equal(1)
      const stringSize = one(statement.values("matt"))
      expect(stringSize).to.equal(1)
      const numberSize = one(statement.values(77.6))
      expect(numberSize).to.equal(1)
      const booleanSize = one(statement.values(true))
      expect(booleanSize).to.equal(1)
      const objectSize = one(statement.values({}))
      expect(objectSize).to.equal(1)
      const arraySize = one(statement.values([1, 2, 3]))
      expect(arraySize).to.equal(3)
    })


    it("iterator of values", () => {
      const statement = compile('$[*].size()')
      const arrayTypes = statement.values([[1, 2, 3], [], ["a", "b"], true])
      expect(Array.from(arrayTypes)).to.deep.equal([3, 0, 2, 1])
    })
  })

  describe("double()", () => {
    it ("single values", () => {
      const statement = compile('$.double()')
      let stringDouble = one(statement.values("45"))
      expect(stringDouble).to.equal(45)
      stringDouble = one(statement.values("9.1e7"))
      expect(stringDouble).to.equal(91000000)
      const numberDouble = one(statement.values(77.6))
      expect(numberDouble).to.equal(77.6)
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values("bond"))).to.throw
      expect(() => one(statement.values(true))).to.throw
      expect(() => one(statement.values({}))).to.throw
      expect(() => one(statement.values([]))).to.throw
    })

    it("iterator of values", () => {
      const statement = compile('$[*].double()')
      const arrayTypes = statement.values(["100", 289967, "-1.7e-4"])
      expect(Array.from(arrayTypes)).to.deep.equal([100, 289967, -0.00017])
    })
  })

  describe("ceiling()", () => {
    it ("single values", () => {
      const statement = compile('$.ceiling()')
      const numberActual = one(statement.values(77.6))
      expect(numberActual).to.equal(78)
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values("77.4"))).to.throw
      expect(() => one(statement.values(true))).to.throw
      expect(() => one(statement.values({}))).to.throw
      expect(() => one(statement.values([]))).to.throw
    })

    it("iterator of values", () => {
      const statement = compile('$[*].ceiling()')
      const arrayTypes = statement.values([1.1, 9.9, -1.7e-4])
      expect(Array.from(arrayTypes)).to.deep.equal([2, 10, -0])
    })
  })

  describe("abs()", () => {
    it ("single values", () => {
      const statement = compile('$.abs()')
      const numberActual = one(statement.values(-440.33))
      expect(numberActual).to.equal(440.33)
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values("1977"))).to.throw
      expect(() => one(statement.values(true))).to.throw
      expect(() => one(statement.values({}))).to.throw
      expect(() => one(statement.values([]))).to.throw
    })

    it("iterator of values", () => {
      const statement = compile('$[*].abs()')
      const arrayTypes = statement.values([33, -11, 9.1, -1.7e-4])
      expect(Array.from(arrayTypes)).to.deep.equal([33, 11, 9.1, 0.00017])
    })
  })

  describe("keyvalue generators", () => {
    it("lax keyvalue", () => {
      const statement = compile('$.keyvalue()')
      const actual = Array.from(statement.values([{a: 1, b: true, c: "see", d: {z: -9}}, {"m b": 1}]))
      expect(actual).to.deep.equal([
        {id: 0, key: "a", value: 1},
        {id: 0, key: "b", value: true},
        {id: 0, key: "c", value: "see"},
        {id: 0, key: "d", value: {z: -9}},
        {id: 1, key: "m b", value: 1}
      ])
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values("frogs"))).to.throw
      expect(() => one(statement.values([{q: 6}, "frogs"]))).to.throw
      expect(() => one(statement.values(true))).to.throw
      expect(() => one(statement.values(100))).to.throw
    })

    it("strict keyvalue", () => {
      const statement = compile('strict $.keyvalue()')
      const actual = Array.from(statement.values({a: 1, b: true, c: "see", d: {z: -9}}))
      expect(actual).to.deep.equal([
        {id: 0, key: "a", value: 1},
        {id: 0, key: "b", value: true},
        {id: 0, key: "c", value: "see"},
        {id: 0, key: "d", value: {z: -9}}
      ])
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values("star"))).to.throw
      expect(() => one(statement.values([{q: 6}, "frogs"]))).to.throw
      expect(() => one(statement.values(true))).to.throw
      expect(() => one(statement.values(100))).to.throw
      expect(() => one(statement.values([]))).to.throw
    })

    it("iterator of keyvalue", () => {
      const statement = compile('$[*].keyvalue()')
      const actual = statement.values([{a: 1}, {b: 2}, {c: 3}])
      expect(Array.from(actual)).to.deep.equal([
        {id: 0, key: "a", value: 1},
        {id: 1, key: "b", value: 2},
        {id: 2, key: "c", value: 3}
      ])
    })
  })

  describe("Wildcards", () => {
    describe(".*", () => {
      it("lax .*", () => {
        const statement = compile('$.*')
        const objectValue = statement.values({"a": 1, "b": {c: "2"}})
        expect(Array.from(objectValue)).to.deep.equal([1, {c: "2"}])

        const arrayValue = statement.values([{"a": 1, e: [], q: null, g: undefined}, 77, {"b": {c: "2"}}, true, [], "cats"])
        expect(Array.from(arrayValue)).to.deep.equal([1, [], null, undefined, {c: "2"}])

        expect(Array.from(statement.values(undefined))).to.be.empty
        expect(Array.from(statement.values(null))).to.be.empty
        expect(Array.from(statement.values({}))).to.be.empty
        expect(Array.from(statement.values([]))).to.be.empty
        expect(Array.from(statement.values("dogs"))).to.be.empty
        expect(Array.from(statement.values(707))).to.be.empty
        expect(Array.from(statement.values(false))).to.be.empty
      })

      it("strict .*", () => {
        const statement = compile('strict $.*')
        const iteratorValue = statement.values({"a": 1, "b": {c: "2"}, u: undefined})
        expect(Array.from(iteratorValue)).to.deep.equal([1, {c: "2"}, undefined])
        expect(() => Array.from(statement.values([{"a": 1}, 77, {"b": {c: "2"}}, true, "cats"]))).to.throw
        expect(() => Array.from(statement.values(undefined))).to.throw
        expect(() => Array.from(statement.values(null))).to.throw
        expect(() => Array.from(statement.values({}))).to.throw
        expect(() => Array.from(statement.values([]))).to.throw
        expect(() => Array.from(statement.values("mice"))).to.throw
        expect(() => Array.from(statement.values(707))).to.throw
        expect(() => Array.from(statement.values(false))).to.throw
      })

      it(".* iterator values", () => {
        const statement = compile('$[*].*')
        const actual = statement.values([{"a": 1, "b": 2}, {"c": {d: "2"}}])
        expect(Array.from(actual)).to.deep.equal([1, 2, {d: "2"}])
      })
    })

    describe("[*]", () => {
      it("lax [*]", () => {
        const statement = compile('$[*]')
        const undefinedValue = one(statement.values(undefined))
        expect(undefinedValue).to.equal(undefined)
        const nullValue = one(statement.values(null))
        expect(nullValue).to.equal(null)
        const stringValue = one(statement.values("galaxies"))
        expect(stringValue).to.equal("galaxies")
        const numberValue = one(statement.values(9944.839))
        expect(numberValue).to.equal(9944.839)
        const booleanValue = one(statement.values(true))
        expect(booleanValue).to.equal(true)
        const objectValue = one(statement.values({t: "shirt"}))
        expect(objectValue).to.deep.equal({t: "shirt"})
        let arrayValue = Array.from(statement.values([]))
        expect(arrayValue).to.be.empty
        arrayValue = Array.from(statement.values([true, false]))
        expect(arrayValue).to.deep.equal([true, false])
        arrayValue = Array.from(statement.values([[]]))
        expect(arrayValue).to.deep.equal([[]])
        arrayValue = Array.from(statement.values([undefined]))
        expect(arrayValue).to.deep.equal([undefined])
        arrayValue = Array.from(statement.values([7, 9, 55]))
        expect(arrayValue).to.deep.equal([7, 9, 55])
      })

      it("strict [*]", () => {
        const statement = compile('strict $[*]')
        const arrayValue = Array.from(statement.values([7, 9, 55]))
        expect(arrayValue).to.deep.equal([7, 9, 55])
        expect(() => one(statement.values(undefined))).to.throw
        expect(() => one(statement.values(null))).to.throw
        expect(() => one(statement.values("galaxies"))).to.throw
        expect(() => one(statement.values(9944.839))).to.throw
        expect(() => one(statement.values(true))).to.throw
        expect(() => one(statement.values({t: "shirt"}))).to.throw
      })

      it("lax [*][*] iterator values", () => {
        const statement = compile('$[*][*]')
        const actual = statement.values([[77, 88], [14, 16], [true, false], [["a", "b"]]])
        expect(Array.from(actual)).to.deep.equal([77, 88, 14, 16, true, false, ["a", "b"]])
      })

      it("strict [*][*] iterator values", () => {
        const statement = compile('strict $[*][*]')
        const actual = statement.values([[77, 88], [14, 16], [true, false], [["a", "b"]]])
        expect(Array.from(actual)).to.deep.equal([77, 88, 14, 16, true, false, ["a", "b"]])
      })
    })
  })

  describe("member tests", () => {
    it(".member", () => {
      const statement = compile('$.thing')
      let objectActual = one(statement.values({thing: "bird"}))
      expect(objectActual).to.equal("bird")
      objectActual = one(statement.values({thing: []}))
      expect(objectActual).to.deep.equal([])
      objectActual = one(statement.values({thing: [9, 8, 7]}))
      expect(objectActual).to.deep.equal([9, 8, 7])
      objectActual = one(statement.values({thing: undefined}))
      expect(objectActual).to.be.undefined
      expect(statement.values({not: "thing"}).next().done).to.be.true
      expect(statement.values(undefined).next().done).to.be.true
      expect(statement.values(null).next().done).to.be.true
      expect(statement.values([]).next().done).to.be.true
      expect(statement.values("dogs").next().done).to.be.true
      expect(statement.values(707).next().done).to.be.true
      expect(statement.values(true).next().done).to.be.true
    })

    it(".\"member\"", () => {
      const statement = compile('$."thing\\tbrick"')
      const objectActual = one(statement.values({"thing\tbrick": 14}))
      expect(objectActual).to.equal(14)
      expect(statement.values(undefined).next().done).to.be.true
      expect(statement.values(null).next().done).to.be.true
      expect(statement.values([]).next().done).to.be.true
      expect(statement.values("dogs").next().done).to.be.true
      expect(statement.values(707).next().done).to.be.true
      expect(statement.values(true).next().done).to.be.true
    })

    it("nested member", () => {
      const statement = compile('$.character.name')
      const objectActual = one(statement.values({character: {name: "Constance"}}))
      expect(objectActual).to.equal("Constance")
    })

    it("strict .member", () => {
      const statement = compile('strict $.thing')
      let objectActual = one(statement.values({thing: []}))
      expect(objectActual).to.deep.equal([])
      objectActual = one(statement.values({thing: "bird"}))
      expect(objectActual).to.equal("bird")
      expect(() => one(statement.values({not: "thing"}))).to.throw
      expect(() => one(statement.values(undefined))).to.throw
      expect(() => one(statement.values(null))).to.throw
      expect(() => one(statement.values([]))).to.throw
      expect(() => one(statement.values("dogs"))).to.throw
      expect(() => one(statement.values(707))).to.throw
      expect(() => one(statement.values(true))).to.throw
    })

    it("supports iterator values", () => {
      const statement = compile('$[*].a')
      const actual = statement.values([{a: 1}, {a: 2}, {a: {a: 5}}])
      expect(Array.from(actual)).to.deep.equal([1, 2, {a: 5}])
    })
  })

  describe("array accessor", () => {
    it("single elements", () => {
      // tests $.size() which is out of bounds, but in lax mode, ignores the access
      const statement = compile('$[0,4,last,$.size()]')
      const actualArray = Array.from(statement.values(["a", "b", "c", "d", [66,77], "f", "g", "h"]))
      expect(actualArray).to.deep.equal(["a", [66,77], "h"])
    })

    it("rejects out-of-bounds array access in strict mode", () => {
      const statement = compile('strict $[100]')
      expect(() => one(statement.values(["tea", "Cookies"]))).to.throw
    })

    it("auto-wraps non-arrays in lax mode", () => {
      const statement = compile('$[last]')
      const actual = one(statement.values("coffee"))
      expect(actual).to.equal("coffee")
    })

    it("rejects non-arrays in strict mode", () => {
      const statement = compile('strict $[last]')
      expect(() => one(statement.values("tea"))).to.throw
    })

    it("range elements", () => {
      const statement = compile('$[1 to 3]')
      const actualArray = Array.from(statement.values(["a", "b", "c", "d", [66,77]]))
      expect(actualArray).to.deep.equal(["b", "c", "d"])
    })

    it("unwraps lax", () => {
      const statement = compile('$.phones.type')
      const data = {phones: [
          {type: "cell", number: "abc-defg"},
          {number: "pqr-wxyz"},
          {type: "home", number: "hij-klmn"}
        ]}
      const actual = Array.from(statement.values(data))
      expect(actual).to.deep.equal(["cell", "home"])
    })

    it("nested array unwrapping", () => {
      const statement = compile('$.phones[last]')
      const data = [
        { name: "Fred", phones: [ "372-0453", "558-9345"] },
        { name: "Manjit", phones: "906-2051" }
      ]
      const actual = Array.from(statement.values(data))
      expect(actual).to.deep.equal(["558-9345", "906-2051"])
    })

    it("does not unwrap strict", () => {
      const statement = compile('strict $.phones.type')
      const data = { name: "Fred", phones: [
          { type: "home", number: "372-0453" },
          { type: "work", number: "506-2051" }
        ] }
      expect(() => one(statement.values(data))).to.throw
    })

    it("nested elements", () => {
      // $[last] is [1, 2], and [1] is 2
      // So get [0, 2]
      const statement = compile('$[0,$[last][1]]')
      const actualArray = Array.from(statement.values([27, "testy", true, [1, 2]]))
      expect(actualArray).to.deep.equal([27, true])
    })
  })

  describe("arithmetic", () => {
    it("can negate a value", () => {
      const statement = compile('-$.x')
      const actualNumber = statement.values({x: 100})
      expect(one(actualNumber)).to.equal(-100)
    })

    it("can triple-negate a value", () => {
      const statement = compile('---30')
      const actualNumber = statement.values(null)
      expect(one(actualNumber)).to.equal(-30)
    })

    it("can add to a number", () => {
      const statement = compile('$ + 4')
      const actualNumber = statement.values(10)
      expect(one(actualNumber)).to.equal(14)
    })

    it("can multiply a number", () => {
      const statement = compile('$ * 10')
      const actualNumber = statement.values(2)
      expect(one(actualNumber)).to.equal(20)
    })

    it("can modulo an array of numbers", () => {
      const statement = compile('$ ? (@ % 2 == 0)')
      const actual = statement.values([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].values())
      expect(Array.from(actual)).to.deep.equal([0, 2, 4, 6, 8])
    })

    it("can divide by a function", () => {
      const statement = compile('$[0] / $.size()')
      const actualNumber = statement.values([20, 0])
      expect(one(actualNumber)).to.equal(10)
    })

    it("chain arithmetic statements", () => {
      const statement = compile('$[0] / ($.size() + 2)')
      const actualNumber = statement.values([20, 0])
      expect(one(actualNumber)).to.equal(5)
    })

    it("chain arithmetic statements again", () => {
      const statement = compile('$[0] / 5 * $.size() + 9 - 1')
      const actualNumber = statement.values([20, 3])
      expect(one(actualNumber)).to.equal(16)
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
      const valuesIterator = statement.values(data.values())
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
      actual = one(stmt.values(data))
      expect(actual.toString()).to.equal("2018-10-14T10:39:21")

      stmt = compile('$.track.segments[*] ? (@.location[1] < 13.4).HR ? (@ > 130)')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([135])

      stmt = compile('$.track ? (exists(@.segments[*] ? (@.HR > 130))).segments.size()')
      actual = stmt.values(data)
      expect(Array.from(actual)).to.deep.equal([2])
    })
  })
})
