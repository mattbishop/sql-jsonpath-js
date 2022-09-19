import {expect} from "chai"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"

import {generateFunctionSource} from "../src"
import {CodegenBase} from "../src/codegen-base"
import {CodegenContext} from "../src/codegen-visitor"


function createFunction({source, lax}: CodegenContext): Function {
  const fn = Function("$", source)
  const fnBase = new CodegenBase(lax)
  const boundFn = fn.bind(fnBase)
  return (contextVariable: any, args?: any) => {
    let result = boundFn(contextVariable, args)
    if (result instanceof IteratorWithOperators) {
      result = result.toArray()
    } else {
      result = [result]
    }
    return result
  }
}


describe("Codegen tests", () => {

  describe("Modes", () => {

    it("default mode is lax", () => {
      const ctx = generateFunctionSource("$")
      expect(ctx).to.deep.include({lax: true})
    })

    it("explicit mode set to lax", () => {
      const ctx = generateFunctionSource("lax$")
      expect(ctx).to.deep.include({lax: true})
    })

    it("explicit mode set to strict", () => {
      const ctx = generateFunctionSource("strict $")
      expect(ctx).to.deep.include({lax: false})
    })
  })

  describe("ContextVariable", () => {
    it("standalone context", () => {
      const ctx = generateFunctionSource("$")
      expect(ctx.source).to.equal("return $")
      const fn = createFunction(ctx)
      const value = fn("matt")
      expect(value).to.deep.equal(["matt"])
    })
  })

  describe("item methods", () => {
    it("type()", () => {
      const ctx = generateFunctionSource("$.type()")
      expect(ctx.source).to.equal("return this.type($)")
      const fn = createFunction(ctx)
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
      const ctx = generateFunctionSource("$.size()")
      expect(ctx.source).to.equal("return this.size($)")
      const fn = createFunction(ctx)
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
      const ctx = generateFunctionSource("$.double()")
      expect(ctx.source).to.equal("return this.double($)")
      const fn = createFunction(ctx)
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
      const ctx = generateFunctionSource("$. ceiling ()")
      expect(ctx.source).to.equal("return this.ceiling($)")
      const fn = createFunction(ctx)
      const numberActual = fn(77.6)
      expect(numberActual).to.deep.equal([78])
      expect(() => fn(null)).to.throw()
      expect(() => fn("77.4")).to.throw()
      expect(() => fn(true)).to.throw()
      expect(() => fn({})).to.throw()
      expect(() => fn([])).to.throw()
    })

    it("abs()", () => {
      const ctx = generateFunctionSource("$ .abs (  )")
      expect(ctx.source).to.equal("return this.abs($)")
      const fn = createFunction(ctx)
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
        const ctx = generateFunctionSource("$ .keyvalue (  )")
        expect(ctx.source).to.equal(`return this.keyvalue($)`)
        const fn = createFunction(ctx)
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
        const ctx = generateFunctionSource("strict $ .keyvalue (  )")
        expect(ctx.source).to.equal(`return this.keyvalue($)`)
        const fn = createFunction(ctx)
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
        const ctx = generateFunctionSource("$ .datetime(  )")
        expect(ctx.source).to.equal(`return this.datetime($)`)
        const fn = createFunction(ctx)
        const actualDate = fn("2020-01-01")
        expect(actualDate[0].getTime()).to.equal(new Date("2020-01-01").getTime())
      })

      it("template string date", () => {
        const ctx = generateFunctionSource("$ .datetime(\"M/d/yyyy\")")
        expect(ctx.source).to.equal(`return this.datetime($,\"M/d/yyyy\")`)
        const fn = createFunction(ctx)
        const actualDate = fn("2/21/1900")
        expect(actualDate[0].getTime()).to.deep.equal(new Date("1900-02-21").getTime())
      })

      it("template string datetime with timezone", () => {
        const ctx = generateFunctionSource("$ .datetime(\"M•d•yyyy@h#m#sZ\")")
        expect(ctx.source).to.equal(`return this.datetime($,\"M•d•yyyy@h#m#sZ\")`)
        const fn = createFunction(ctx)
        const actualDate = fn("2•21•1900@3#35#19+8")
        expect(actualDate[0].getTime()).to.equal(new Date("1900-02-21 3:35:19+8").getTime())
      })
    })
  })

  describe("Wildcards", () => {
    describe(".*", () => {
      it("lax .*", () => {
        const ctx = generateFunctionSource("$.*")
        expect(ctx.source).to.equal("return this.dotStar($)")
        const fn = createFunction(ctx)
        const objectValue = fn({"a": 1, "b": {c: "2"}})
        expect(objectValue).to.deep.equal([1, {c: "2"}])
        const arrayValue = fn([{"a": 1, e: [], q: null, g: undefined}, 77, {"b": {c: "2"}}, true, [], "cats"])
        expect(arrayValue).to.deep.equal([1, [], null, undefined, {c: "2"}])
        expect(fn(undefined)).to.be.empty
        expect(fn(null)).to.be.empty
        expect(fn({})).to.be.empty
        expect(fn([])).to.be.empty
        expect(fn("dogs")).to.be.empty
        expect(fn(707)).to.be.empty
        expect(fn(false)).to.be.empty
      })

      it("strict .*", () => {
        const ctx = generateFunctionSource("strict $.*")
        expect(ctx.source).to.equal("return this.dotStar($)")
        const fn = createFunction(ctx)
        const objectValue = fn(iterate([{"a": 1, "b": {c: "2"}, u: undefined}]))
        expect(objectValue).to.deep.equal([1, {c: "2"}, undefined])
        expect(() => fn([{"a": 1}, 77, {"b": {c: "2"}}, true, "cats"])).to.throw
        expect(() => fn(undefined)).to.throw
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
        const ctx = generateFunctionSource("$[*]")
        expect(ctx.source).to.equal("return this.boxStar($)")
        const fn = createFunction(ctx)
        const undefinedValue = fn(undefined)
        expect(undefinedValue).to.deep.equal([undefined])
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
        let arrayValue = fn([])
        expect(arrayValue).to.be.empty
        arrayValue = fn([true, false])
        expect(arrayValue).to.deep.equal([true, false])
        arrayValue = fn([[]])
        expect(arrayValue).to.deep.equal([[]])
        arrayValue = fn([undefined])
        expect(arrayValue).to.deep.equal([undefined])
        arrayValue = fn([7, 9, 55])
        expect(arrayValue).to.deep.equal([7, 9, 55])
      })

      it("strict [*]", () => {
        const ctx = generateFunctionSource("strict $[*]")
        expect(ctx.source).to.equal("return this.boxStar($)")
        const fn = createFunction(ctx)
        const arrayValue = fn([7, 9, 55])
        expect(arrayValue).to.deep.equal([7, 9, 55])
        expect(() => fn(undefined)).to.throw
        expect(() => fn(null)).to.throw
        expect(() => fn("galaxies")).to.throw
        expect(() => fn(9944.839)).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({t: "shirt"})).to.throw
      })
    })
  })

  describe("member accessor", () => {
    it(".member", () => {
      const ctx = generateFunctionSource("$.thing")
      expect(ctx.source).to.equal("return this.member($,\"thing\")")
      const fn = createFunction(ctx)
      let objectActual = fn({thing: "bird"})
      expect(objectActual).to.deep.equal(["bird"])
      objectActual = fn({thing: []})
      expect(objectActual).to.deep.equal([[]])
      objectActual = fn({thing: [9, 8, 7]})
      expect(objectActual).to.deep.equal([[9, 8, 7]])
      objectActual = fn({thing: undefined})
      expect(objectActual).to.deep.equal([undefined])
      expect(fn({not: "thing"})).to.be.empty
      expect(fn(undefined)).to.be.empty
      expect(fn(null)).to.be.empty
      expect(fn([])).to.be.empty
      expect(fn("dogs")).to.be.empty
      expect(fn(707)).to.be.empty
      expect(fn(true)).to.be.empty
    })

    it(".\"member\"", () => {
      const ctx = generateFunctionSource("$.\"thing\\tbrick\"")
      expect(ctx.source).to.equal("return this.member($,\"thing\\tbrick\")")
      const fn = createFunction(ctx)
      const objectActual = fn({"thing\tbrick": 14})
      expect(objectActual).to.deep.equal([14])
      expect(fn(undefined)).to.be.empty
      expect(fn(null)).to.be.empty
      expect(fn([])).to.be.empty
      expect(fn("dogs")).to.be.empty
      expect(fn(707)).to.be.empty
      expect(fn(true)).to.be.empty
    })

    it("strict .member", () => {
      const ctx = generateFunctionSource("strict $.thing")
      expect(ctx.source).to.equal("return this.member($,\"thing\")")
      const fn = createFunction(ctx)
      let objectActual = fn({thing: []})
      expect(objectActual).to.deep.equal([[]])
      objectActual = fn({thing: "bird"})
      expect(objectActual).to.deep.equal(["bird"])
      expect(fn({not: "thing"})).to.be.empty
      expect(() => fn(undefined)).to.throw
      expect(() => fn(null)).to.throw
      expect(() => fn([])).to.throw
      expect(() => fn("dogs")).to.throw
      expect(() => fn(707)).to.throw
      expect(() => fn(true)).to.throw
    })
  })

  describe("array accessor", () => {
    it("single elements", () => {
      const ctx = generateFunctionSource("$[0,4,last,$.size()]")
      expect(ctx.source).to.equal("return this.array(this.push$$a($),[0,4,this.last(),this.size($)])")
      const fn = createFunction(ctx)
      const actualArray = fn(["a", "b", "c", "d", [66,77], "f", "g", "h"])
      expect(actualArray).to.deep.equal(["a", [66,77], "h"])
    })

    it("auto-wraps non-arrays in lax mode", () => {
      const ctx = generateFunctionSource("$[last]")
      expect(ctx.source).to.equal("return this.array(this.push$$a($),[this.last()])")
      const fn = createFunction(ctx)
      const actualArray = fn("coffee")
      expect(actualArray).to.deep.equal(["coffee"])
    })

    it("rejects non-arrays in strict mode", () => {
      const ctx = generateFunctionSource("strict $[last]")
      expect(ctx.source).to.equal("return this.array(this.push$$a($),[this.last()])")
      const fn = createFunction(ctx)
      expect(() => fn("tea")).to.throw
    })

    it("range elements", () => {
      const ctx = generateFunctionSource("$[1 to 3]")
      expect(ctx.source).to.equal("return this.array(this.push$$a($),[this.range(1,3)])")
      const fn = createFunction(ctx)
      const actualArray = fn(["a", "b", "c", "d", [66,77]])
      expect(actualArray).to.deep.equal(["b", "c", "d"])
    })
  })
})