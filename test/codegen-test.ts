import {expect} from "chai"
import {generateFunctionSource} from "../src"
import {itemMethodFns} from "../src/codegen-visitor"


function createFunction(body: String): Function {
  const src = `${body}`
  const fn = Function("$", "$$", src)
  return fn.bind(itemMethodFns)
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
      expect(value).to.equal("matt")
    })

    describe("context methods", () => {
      it("type()", () => {
        const actual = generateFunctionSource("$.type()")
        expect(actual.source).to.equal("return this.type($)")
        const fn = createFunction(actual.source)
        const stringType = fn("matt")
        expect(stringType).to.equal("string")
        const numberType = fn(77.6)
        expect(numberType).to.equal("number")
        const booleanType = fn(true)
        expect(booleanType).to.equal("boolean")
        const objectType = fn({})
        expect(objectType).to.equal("object")
        const arrayType = fn([])
        expect(arrayType).to.equal("array")
      })

      it("size()", () => {
        const actual = generateFunctionSource("$.size()")
        expect(actual.source).to.equal("return this.size($)")
        const fn = createFunction(actual.source)
        const stringSize = fn("matt")
        expect(stringSize).to.equal(1)
        const numberSize = fn(77.6)
        expect(numberSize).to.equal(1)
        const booleanSize = fn(true)
        expect(booleanSize).to.equal(1)
        const objectSize = fn({})
        expect(objectSize).to.equal(1)
        const arraySize = fn([1, 2, 3])
        expect(arraySize).to.equal(3)
      })

      it("double()", () => {
        const actual = generateFunctionSource("$.double()")
        expect(actual.source).to.equal("return this.double($)")
        const fn = createFunction(actual.source)
        const stringDouble = fn("45")
        expect(stringDouble).to.equal(45)
        const numberDouble = fn(77.6)
        expect(numberDouble).to.equal(77.6)
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
        expect(numberActual).to.equal(78)
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
        expect(numberActual).to.equal(440.33)
        expect(() => fn("77.4")).to.throw()
        expect(() => fn(true)).to.throw()
        expect(() => fn({})).to.throw()
        expect(() => fn([])).to.throw()
      })

      describe("keyvalue()", () => {
        it("lax keyvalue", () => {
          const actual = generateFunctionSource("$ .keyvalue (  )")
          expect(actual.source).to.equal(`return this.keyvalue($,true)`)
          const fn = createFunction(actual.source)
          const kvActual = fn([{a: 1, b: true, c: "see", d: {z: -9}}, {"m": 1}])
          expect(kvActual).to.deep.equal([
            {id: 0, key: "a", value: 1},
            {id: 0, key: "b", value: true},
            {id: 0, key: "c", value: "see"},
            {id: 0, key: "d", value: {z: -9}},
            {id: 1, key: "m", value: 1}
          ])
          expect(() => fn("77.4")).to.throw()
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
          expect(() => fn("77.4")).to.throw()
          expect(() => fn(true)).to.throw()
          expect(() => fn(100)).to.throw()
          expect(() => fn([])).to.throw()
        })
      })
    })
  })
})