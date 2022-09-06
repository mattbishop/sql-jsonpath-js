import {expect} from "chai"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"

import {generateFunctionSource} from "../src"
import {codegenFunctions} from "../src/codegen-functions"


function createFunction(body: string): Function {
  const fn = Function("$", "$$", body)
  const boundFn = fn.bind(codegenFunctions)
  return (input: any, args?: any) => {
    const i = input instanceof IteratorWithOperators
      ? input
      : iterate([input])
    return boundFn(i, args).toArray()
  }
}


describe("Codegen tests", () => {

  describe("Modes", () => {

    it("default mode is lax", () => {
      const actual = generateFunctionSource("$")
      expect(actual).to.deep.include({lax: true})
    })

    it("explicit mode set to lax", () => {
      const actual = generateFunctionSource("lax$")
      expect(actual).to.deep.include({lax: true})
    })

    it("explicit mode set to strict", () => {
      const actual = generateFunctionSource("strict $")
      expect(actual).to.deep.include({lax: false})
    })
  })

  describe("ContextVariable", () => {
    it("standalone context", () => {
      const actual = generateFunctionSource("$")
      expect(actual.source).to.equal("return $")
      const fn = createFunction(actual.source)
      const value = fn("matt")
      expect(value).to.deep.equal(["matt"])
    })
  })

  describe("item methods", () => {
    it("type()", () => {
      const actual = generateFunctionSource("$.type()")
      expect(actual.source).to.equal("return this.type($)")
      const fn = createFunction(actual.source)
      const nullType = fn(null)
      expect(nullType).to.deep.equal(["null"])
      const stringType = fn("matt")
      expect(stringType).to.deep.equal(["string"])
      const numberType = fn(77.6)
      expect(numberType).to.deep.equal(["number"])
      const booleanType = fn(true)
      expect(booleanType).to.deep.equal(["boolean"])
      const objectType = fn({})
      expect(objectType).to.deep.equal(["object"])
      const arrayType = fn([])
      expect(arrayType).to.deep.equal(["array"])
      const undefinedType = fn(undefined)
      expect (undefinedType).to.deep.equal(["undefined"])
    })

    it("size()", () => {
      const actual = generateFunctionSource("$.size()")
      expect(actual.source).to.equal("return this.size($)")
      const fn = createFunction(actual.source)
      const nullSize = fn(null)
      expect(nullSize).to.deep.equal([1])
      const stringSize = fn("matt")
      expect(stringSize).to.deep.equal([1])
      const numberSize = fn(77.6)
      expect(numberSize).to.deep.equal([1])
      const booleanSize = fn(true)
      expect(booleanSize).to.deep.equal([1])
      const objectSize = fn({})
      expect(objectSize).to.deep.equal([1])
      const arraySize = fn([1, 2, 3])
      expect(arraySize).to.deep.equal([3])
    })

    it("double()", () => {
      const actual = generateFunctionSource("$.double()")
      expect(actual.source).to.equal("return this.double($)")
      const fn = createFunction(actual.source)
      const stringDouble = fn("45")
      expect(stringDouble).to.deep.equal([45])
      const numberDouble = fn(77.6)
      expect(numberDouble).to.deep.equal([77.6])
      expect(() => fn(null)).to.throw()
      expect(() => fn("bond")).to.throw()
      expect(() => fn(true)).to.throw()
      expect(() => fn({})).to.throw()
      expect(() => fn([])).to.throw()
    })

    it("ceiling()", () => {
      const actual = generateFunctionSource("$. ceiling ()")
      expect(actual.source).to.equal("return this.ceiling($)")
      const fn = createFunction(actual.source)
      const numberActual = fn(77.6)
      expect(numberActual).to.deep.equal([78])
      expect(() => fn(null)).to.throw()
      expect(() => fn("77.4")).to.throw()
      expect(() => fn(true)).to.throw()
      expect(() => fn({})).to.throw()
      expect(() => fn([])).to.throw()
    })

    it("abs()", () => {
      const actual = generateFunctionSource("$ .abs (  )")
      expect(actual.source).to.equal("return this.abs($)")
      const fn = createFunction(actual.source)
      const numberActual = fn(-440.33)
      expect(numberActual).to.deep.equal([440.33])
      expect(() => fn(null)).to.throw()
      expect(() => fn("1977")).to.throw()
      expect(() => fn(true)).to.throw()
      expect(() => fn({})).to.throw()
      expect(() => fn([])).to.throw()
    })

    describe("keyvalue()", () => {
      it("lax keyvalue", () => {
        const actual = generateFunctionSource("$ .keyvalue (  )")
        expect(actual.source).to.equal(`return this.keyvalue($,true)`)
        const fn = createFunction(actual.source)
        const kvActual = fn([{a: 1, b: true, c: "see", d: {z: -9}}, {"m b": 1}])
        expect(kvActual).to.deep.equal([
          {id: 0, key: "a", value: 1},
          {id: 0, key: "b", value: true},
          {id: 0, key: "c", value: "see"},
          {id: 0, key: "d", value: {z: -9}},
          {id: 1, key: "m b", value: 1}
        ])
        expect(() => fn(null)).to.throw()
        expect(() => fn("frogs")).to.throw()
        expect(() => fn([{q: 6}, "frogs"])).to.throw()
        expect(() => fn(true)).to.throw()
        expect(() => fn(100)).to.throw()
      })

      it("strict keyvalue", () => {
        const actual = generateFunctionSource("strict $ .keyvalue (  )")
        expect(actual.source).to.equal(`return this.keyvalue($,false)`)
        const fn = createFunction(actual.source)
        const id = 0
        const kvActual = fn({a: 1, b: true, c: "see", d: {z: -9}})
        expect(kvActual).to.deep.equal([
          {id, key: "a", value: 1},
          {id, key: "b", value: true},
          {id, key: "c", value: "see"},
          {id, key: "d", value: {z: -9}}
        ])
        expect(() => fn(null)).to.throw()
        expect(() => fn("star")).to.throw()
        expect(() => fn([{q: 6}, "frogs"])).to.throw()
        expect(() => fn(true)).to.throw()
        expect(() => fn(100)).to.throw()
        expect(() => fn([])).to.throw()
      })
    })

    describe("datetime()", () => {
      it("ISO string date", () => {
        const actual = generateFunctionSource("$ .datetime(  )")
        expect(actual.source).to.equal(`return this.datetime($)`)
        const fn = createFunction(actual.source)
        const actualDate = fn("2020-01-01")
        expect(actualDate[0].getTime()).to.equal(new Date("2020-01-01").getTime())
      })

      it("template string date", () => {
        const actual = generateFunctionSource("$ .datetime(\"M/d/yyyy\")")
        expect(actual.source).to.equal(`return this.datetime($,\"M/d/yyyy\")`)
        const fn = createFunction(actual.source)
        const actualDate = fn("2/21/1900")
        expect(actualDate[0].getTime()).to.deep.equal(new Date("1900-02-21").getTime())
      })

      it("template string datetime with timezone", () => {
        const actual = generateFunctionSource("$ .datetime(\"M•d•yyyy@h#m#sZ\")")
        expect(actual.source).to.equal(`return this.datetime($,\"M•d•yyyy@h#m#sZ\")`)
        const fn = createFunction(actual.source)
        const actualDate = fn("2•21•1900@3#35#19+8")
        expect(actualDate[0].getTime()).to.equal(new Date("1900-02-21 3:35:19+8").getTime())
      })
    })
  })

  describe("Wildcards", () => {
    describe(".*", () => {
      it("lax .*", () => {
        const actual = generateFunctionSource("$.*")
        expect(actual.source).to.equal("return this.dotStar($,true)")
        const fn = createFunction(actual.source)
        const objectValue = fn({"a": 1, "b": {c: "2"}})
        expect(objectValue).to.deep.equal([1, {c: "2"}])
        const arrayValue = fn([{"a": 1}, 77, {"b": {c: "2"}}, true, "cats"])
        expect(arrayValue).to.deep.equal([1, {c: "2"}])
        expect(fn(null)).to.be.empty
        expect(fn({})).to.be.empty
        expect(fn([])).to.be.empty
        expect(fn("dogs")).to.be.empty
        expect(fn(707)).to.be.empty
        expect(fn(false)).to.be.empty
      })

      it("strict .*", () => {
        const actual = generateFunctionSource("strict $.*")
        expect(actual.source).to.equal("return this.dotStar($,false)")
        const fn = createFunction(actual.source)
        const objectValue = fn(iterate([{"a": 1, "b": {c: "2"}}]))
        expect(objectValue).to.deep.equal([1, {c: "2"}])
        expect(() => fn([{"a": 1}, 77, {"b": {c: "2"}}, true, "cats"])).to.throw
        expect(() => fn(null)).to.throw
        expect(() => fn({})).to.throw
        expect(() => fn([])).to.throw
        expect(() => fn("mice")).to.throw
        expect(() => fn(707)).to.throw
        expect(() => fn(false)).to.throw
      })
    })

    describe("[*]", () => {
      it("lax [*]", () => {
        const actual = generateFunctionSource("$[*]")
        expect(actual.source).to.equal("return this.boxStar($,true)")
        const fn = createFunction(actual.source)
        const nullValue = fn(null)
        expect(nullValue).to.deep.equal([null])
        const stringValue = fn("galaxies")
        expect(stringValue).to.deep.equal(["galaxies"])
        const numberValue = fn(9944.839)
        expect(numberValue).to.deep.equal([9944.839])
        const booleanValue = fn(true)
        expect(booleanValue).to.deep.equal([true])
        const objectValue = fn({t: "shirt"})
        expect(objectValue).to.deep.equal([{t: "shirt"}])
        const arrayValue = fn([7, 9, 55])
        expect(arrayValue).to.deep.equal([7, 9, 55])
      })

      it("strict [*]", () => {
        const actual = generateFunctionSource("strict $[*]")
        expect(actual.source).to.equal("return this.boxStar($,false)")
        const fn = createFunction(actual.source)
        const arrayValue = fn([7, 9, 55])
        expect(arrayValue).to.deep.equal([7, 9, 55])
        expect(() => fn(null)).to.throw
        expect(() => fn("galaxies")).to.throw
        expect(() => fn(9944.839)).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({t: "shirt"})).to.throw
      })
    })
  })
})