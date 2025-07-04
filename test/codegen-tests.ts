import {expect} from "chai"
import {CodegenContext} from "../src/codegen-visitor"
import {NamedVariables} from "../src/json-path"
import {createFunction, generateFunctionSource} from "../src/json-path-statement"


function createFunctionForTest(ctx: CodegenContext): ($: any, $named?: NamedVariables) => any[] {
  const fn = createFunction(ctx)
  return ($: any, $named?: NamedVariables) => fn($, $named).toArray()
}


describe("Codegen tests", () => {

  describe("Modes", () => {

    it("default mode is lax", () => {
      const ctx = generateFunctionSource('$')
      expect(ctx).to.deep.include({lax: true})
    })

    it("explicit mode set to lax", () => {
      const ctx = generateFunctionSource('lax$')
      expect(ctx).to.deep.include({lax: true})
    })

    it("explicit mode set to strict", () => {
      const ctx = generateFunctionSource('strict $')
      expect(ctx).to.deep.include({lax: false})
    })
  })

  describe("ContextVariable", () => {
    it("standalone context", () => {
      const ctx = generateFunctionSource('$')
      expect(ctx.source).to.equal('return $')
      const fn = createFunctionForTest(ctx)
      const value = fn("matt")
      expect(value).to.deep.equal(["matt"])
    })
  })

  describe("NamedVariable", () => {
    it("standalone named variable", () => {
      const ctx = generateFunctionSource('$n')
      expect(ctx.source).to.equal('return $$("n")')
      const fn = createFunctionForTest(ctx)
      const value = fn("", {n: "frosty"})
      expect(value).to.deep.equal(["frosty"])
      expect(() => fn(null, {wrong: true})).to.throw
    })
  })

  describe("item methods", () => {
    describe("type()", () => {
      it("single value", () => {
        const ctx = generateFunctionSource('$.type()')
        expect(ctx.source).to.equal('return ƒ.type($)')
        const fn = createFunctionForTest(ctx)
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

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].type()')
        expect (ctx.source).to.equal('return ƒ.type(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn([true, 1, "hi"])
        expect(arrayTypes).to.deep.equal(["boolean", "number", "string"])
      })
    })

    describe("size()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$.size()')
        expect(ctx.source).to.equal('return ƒ.size($)')
        const fn = createFunctionForTest(ctx)
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

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].size()')
        expect (ctx.source).to.equal('return ƒ.size(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn([[1, 2, 3], [], ["a", "b"], true])
        expect(arrayTypes).to.deep.equal([3, 0, 2, 1])
      })
    })

    describe("double()", () => {
      it ("single values", () => {
        const ctx = generateFunctionSource('$.double()')
        expect(ctx.source).to.equal('return ƒ.double($)')
        const fn = createFunctionForTest(ctx)
        let stringDouble = fn("45")
        expect(stringDouble).to.deep.equal([45])
        stringDouble = fn("9.1e7")
        expect(stringDouble).to.deep.equal([91000000])
        const numberDouble = fn(77.6)
        expect(numberDouble).to.deep.equal([77.6])
        expect(() => fn(null)).to.throw
        expect(() => fn("bond")).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({})).to.throw
        expect(() => fn([])).to.throw
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].double()')
        expect (ctx.source).to.equal('return ƒ.double(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn(["100", 289967, "-1.7e-4"])
        expect(arrayTypes).to.deep.equal([100, 289967, -0.00017])
      })
    })

    describe("ceiling()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$. ceiling ()')
        expect(ctx.source).to.equal('return ƒ.ceiling($)')
        const fn = createFunctionForTest(ctx)
        const numberActual = fn(77.6)
        expect(numberActual).to.deep.equal([78])
        expect(() => fn(null)).to.throw
        expect(() => fn("77.4")).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({})).to.throw
        expect(() => fn([])).to.throw
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].ceiling()')
        expect (ctx.source).to.equal('return ƒ.ceiling(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn([1.1, 9.9, -1.7e-4])
        expect(arrayTypes).to.deep.equal([2, 10, -0])
      })
    })

    describe("abs()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$ .abs (  )')
        expect(ctx.source).to.equal('return ƒ.abs($)')
        const fn = createFunctionForTest(ctx)
        const numberActual = fn(-440.33)
        expect(numberActual).to.deep.equal([440.33])
        expect(() => fn(null)).to.throw
        expect(() => fn("1977")).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({})).to.throw
        expect(() => fn([])).to.throw
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].abs()')
        expect (ctx.source).to.equal('return ƒ.abs(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn([33, -11, 9.1, -1.7e-4])
        expect(arrayTypes).to.deep.equal([33, 11, 9.1, 0.00017])
      })
    })

    describe("keyvalue()", () => {
      it("lax keyvalue", () => {
        const ctx = generateFunctionSource('$ .keyvalue (  )')
        expect(ctx.source).to.equal('return ƒ.keyvalue($)')
        const fn = createFunctionForTest(ctx)
        const kvActual = fn([{a: 1, b: true, c: "see", d: {z: -9}}, {"m b": 1}])
        expect(kvActual).to.deep.equal([
          {id: 0, key: "a", value: 1},
          {id: 0, key: "b", value: true},
          {id: 0, key: "c", value: "see"},
          {id: 0, key: "d", value: {z: -9}},
          {id: 1, key: "m b", value: 1}
        ])
        expect(() => fn(null)).to.throw
        expect(() => fn("frogs")).to.throw
        expect(() => fn([{q: 6}, "frogs"])).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn(100)).to.throw
      })

      it("strict keyvalue", () => {
        const ctx = generateFunctionSource('strict $ .keyvalue (  )')
        expect(ctx.source).to.equal('return ƒ.keyvalue($)')
        const fn = createFunctionForTest(ctx)
        const id = 0
        const kvActual = fn({a: 1, b: true, c: "see", d: {z: -9}})
        expect(kvActual).to.deep.equal([
          {id, key: "a", value: 1},
          {id, key: "b", value: true},
          {id, key: "c", value: "see"},
          {id, key: "d", value: {z: -9}}
        ])
        expect(() => fn(null)).to.throw
        expect(() => fn("star")).to.throw
        expect(() => fn([{q: 6}, "frogs"])).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn(100)).to.throw
        expect(() => fn([])).to.throw
      })

      it("iterator of keyvalue", () => {
        const ctx = generateFunctionSource('$[*].keyvalue()')
        expect (ctx.source).to.equal('return ƒ.keyvalue(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayTypes = fn([{a: 1}, {b: 2}, {c: 3}])
        expect(arrayTypes).to.deep.equal([
          {id: 0, key: "a", value: 1},
          {id: 1, key: "b", value: 2},
          {id: 2, key: "c", value: 3}
        ])
      })
    })

    describe("datetime()", () => {
      it("ISO string date", () => {
        const ctx = generateFunctionSource('$ .datetime(  )')
        expect(ctx.source).to.equal('return ƒ.datetime($)')
        const fn = createFunctionForTest(ctx)
        const actualDate = fn("2020-01-01")
        expect(actualDate[0].getTime()).to.equal(new Date("2020-01-01").getTime())
      })

      it("template string date", () => {
        const ctx = generateFunctionSource('$ .datetime("M/d/yyyy")')
        expect(ctx.source).to.equal('return ƒ.datetime($,"M/d/yyyy")')
        const fn = createFunctionForTest(ctx)
        const actualDate = fn("2/21/1900")
        expect(actualDate[0].getTime()).to.deep.equal(new Date("1900-02-21").getTime())
      })

      it("template string datetime with timezone", () => {
        const ctx = generateFunctionSource('$ .datetime("M•d•yyyy@h#m#sZ")')
        expect(ctx.source).to.equal('return ƒ.datetime($,"M•d•yyyy@h#m#sZ")')
        const fn = createFunctionForTest(ctx)
        const actualDate = fn("2•21•1900@3#35#19+8")
        expect(actualDate[0].getTime()).to.equal(new Date("1900-02-21 3:35:19+8").getTime())
      })

      it("handles date iterators", () => {
        const ctx = generateFunctionSource('$[*].datetime()')
        expect (ctx.source).to.equal('return ƒ.datetime(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayDates = fn(["2022-06-15", "2020-01-01 2:27:12+8"])
        expect(arrayDates).to.deep.equal([new Date("2022-06-15"), new Date("2020-01-01 2:27:12+8")])
      })
    })
  })

  describe("Wildcards", () => {
    describe(".*", () => {
      it("lax .*", () => {
        const ctx = generateFunctionSource('$.*')
        expect(ctx.source).to.equal('return ƒ.dotStar($)')
        const fn = createFunctionForTest(ctx)
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
        const ctx = generateFunctionSource('strict $.*')
        expect(ctx.source).to.equal('return ƒ.dotStar($)')
        const fn = createFunctionForTest(ctx)
        const iteratorValue = fn({"a": 1, "b": {c: "2"}, u: undefined})
        expect(iteratorValue).to.deep.equal([1, {c: "2"}, undefined])
        expect(() => fn([{"a": 1}, 77, {"b": {c: "2"}}, true, "cats"])).to.throw
        expect(() => fn(undefined)).to.throw
        expect(() => fn(null)).to.throw
        expect(() => fn({})).to.throw
        expect(() => fn([])).to.throw
        expect(() => fn("mice")).to.throw
        expect(() => fn(707)).to.throw
        expect(() => fn(false)).to.throw
      })

      it(".* iterator values", () => {
        const ctx = generateFunctionSource('$[*].*')
        expect (ctx.source).to.equal('return ƒ.dotStar(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayDates = fn([{"a": 1, "b": 2}, {"c": {d: "2"}}])
        expect(arrayDates).to.deep.equal([1, 2, {d: "2"}])
      })
    })

    describe("[*]", () => {
      it("lax [*]", () => {
        const ctx = generateFunctionSource('$[*]')
        expect(ctx.source).to.equal('return ƒ.boxStar($)')
        const fn = createFunctionForTest(ctx)
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
        const ctx = generateFunctionSource('strict $[*]')
        expect(ctx.source).to.equal('return ƒ.boxStar($)')
        const fn = createFunctionForTest(ctx)
        const arrayValue = fn([7, 9, 55])
        expect(arrayValue).to.deep.equal([7, 9, 55])
        expect(() => fn(undefined)).to.throw
        expect(() => fn(null)).to.throw
        expect(() => fn("galaxies")).to.throw
        expect(() => fn(9944.839)).to.throw
        expect(() => fn(true)).to.throw
        expect(() => fn({t: "shirt"})).to.throw
      })

      it("lax [*][*] iterator values", () => {
        const ctx = generateFunctionSource('$[*][*]')
        expect (ctx.source).to.equal('return ƒ.boxStar(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayDates = fn([[77, 88], [14, 16], [true, false], [["a", "b"]]])
        expect(arrayDates).to.deep.equal([77, 88, 14, 16, true, false, ["a", "b"]])
      })

      it("strict [*][*] iterator values", () => {
        const ctx = generateFunctionSource('strict $[*][*]')
        expect (ctx.source).to.equal('return ƒ.boxStar(ƒ.boxStar($))')
        const fn = createFunctionForTest(ctx)
        const arrayDates = fn([[77, 88], [14, 16], [true, false], [["a", "b"]]])
        expect(arrayDates).to.deep.equal([77, 88, 14, 16, true, false, ["a", "b"]])
      })
    })
  })

  describe("member accessor", () => {
    it(".member", () => {
      const ctx = generateFunctionSource('$.thing')
      expect(ctx.source).to.equal('return ƒ.member($,"thing")')
      const fn = createFunctionForTest(ctx)
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
      const ctx = generateFunctionSource('$."thing\\tbrick"')
      expect(ctx.source).to.equal('return ƒ.member($,"thing\\tbrick")')
      const fn = createFunctionForTest(ctx)
      const objectActual = fn({"thing\tbrick": 14})
      expect(objectActual).to.deep.equal([14])
      expect(fn(undefined)).to.be.empty
      expect(fn(null)).to.be.empty
      expect(fn([])).to.be.empty
      expect(fn("dogs")).to.be.empty
      expect(fn(707)).to.be.empty
      expect(fn(true)).to.be.empty
    })

    it("nested member", () => {
      const ctx = generateFunctionSource('$.thing.name')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"thing"),"name")')
      const fn = createFunctionForTest(ctx)
      const objectActual = fn({thing:{name: "Constance"}})
      expect(objectActual).to.deep.equal(["Constance"])
    })

    it("strict .member", () => {
      const ctx = generateFunctionSource('strict $.thing')
      expect(ctx.source).to.equal('return ƒ.member($,"thing")')
      const fn = createFunctionForTest(ctx)
      let objectActual = fn({thing: []})
      expect(objectActual).to.deep.equal([[]])
      objectActual = fn({thing: "bird"})
      expect(objectActual).to.deep.equal(["bird"])
      expect(() => fn({not: "thing"})).to.throw
      expect(() => fn(undefined)).to.throw
      expect(() => fn(null)).to.throw
      expect(() => fn([])).to.throw
      expect(() => fn("dogs")).to.throw
      expect(() => fn(707)).to.throw
      expect(() => fn(true)).to.throw
    })

    it("supports iterator values", () => {
      const ctx = generateFunctionSource('$[*].a')
      expect (ctx.source).to.equal('return ƒ.member(ƒ.boxStar($),"a")')
      const fn = createFunctionForTest(ctx)
      const arrayDates = fn([{a: 1}, {a: 2}, {a: {a: 5}}])
      expect(arrayDates).to.deep.equal([1, 2, {a: 5}])
    })
  })

  describe("array accessor", () => {
    it("single elements", () => {
      // tests $.size() which is out of bounds, but in lax mode, ignores the access
      const ctx = generateFunctionSource('$[0,4,last,$.size()]')
      expect(ctx.source).to.equal('return ƒ.array($,[0,4,ƒ.last,ƒ.size($)])')
      const fn = createFunctionForTest(ctx)
      const actualArray = fn(["a", "b", "c", "d", [66,77], "f", "g", "h"])
      expect(actualArray).to.deep.equal(["a", [66,77], "h"])
    })

    it("rejects out-of-bounds array access in strict mode", () => {
      const ctx = generateFunctionSource('strict $[100]')
      expect(ctx.source).to.equal('return ƒ.array($,[100])')
      const fn = createFunctionForTest(ctx)
      expect(() => fn(["tea", "Cookies"])).to.throw
    })

    it("auto-wraps non-arrays in lax mode", () => {
      const ctx = generateFunctionSource('$[last]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.last])')
      const fn = createFunctionForTest(ctx)
      const actualArray = fn("coffee")
      expect(actualArray).to.deep.equal(["coffee"])
    })

    it("rejects non-arrays in strict mode", () => {
      const ctx = generateFunctionSource('strict $[last]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.last])')
      const fn = createFunctionForTest(ctx)
      expect(() => fn("tea")).to.throw
    })

    it("range elements", () => {
      const ctx = generateFunctionSource('$[1 to 3]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.range(1,3)])')
      const fn = createFunctionForTest(ctx)
      const actualArray = fn(["a", "b", "c", "d", [66,77]])
      expect(actualArray).to.deep.equal(["b", "c", "d"])
    })

    it("unwraps lax", () => {
      const ctx = generateFunctionSource('$.phones.type')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"phones"),"type")')
      const fn = createFunctionForTest(ctx)
      const data = {phones: [
        {type: "cell", number: "abc-defg"},
        {number: "pqr-wxyz"},
        {type: "home", number: "hij-klmn"}
      ]}
      const actual = fn(data)
      expect(actual).to.deep.equal(["cell", "home"])
    })

    it("nested array unwrapping", () => {
      const ctx = generateFunctionSource('$.phones[last]')
      expect(ctx.source).to.equal('return ƒ.array(ƒ.member($,"phones"),[ƒ.last])')
      const fn = createFunctionForTest(ctx)
      const data = [
        { name: "Fred", phones: [ "372-0453", "558-9345"] },
        { name: "Manjit", phones: "906-2051" }
      ]
      const actual = fn(data)
      expect(actual).to.deep.equal(["558-9345", "906-2051"])
    })

    it("does not unwrap strict", () => {
      const ctx = generateFunctionSource('strict $.phones.type')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"phones"),"type")')
      const fn = createFunctionForTest(ctx)
      const data = { name: "Fred", phones: [
        { type: "home", number: "372-0453" },
        { type: "work", number: "506-2051" }
      ] }
      expect(() => fn(data)).to.throw
    })

    it("nested elements", () => {
      const ctx = generateFunctionSource('$[0,$[last][1]]')
      expect(ctx.source).to.equal('return ƒ.array($,[0,ƒ.array(ƒ.array($,[ƒ.last]),[1])])')
      const fn = createFunctionForTest(ctx)
      const actualArray = fn([27, "testy", true, [1, 2]])
      expect(actualArray).to.deep.equal([27, true])
    })
  })

  describe("arithmetic", () => {
    it("can negate a value", () => {
      const ctx = generateFunctionSource('-$.x')
      expect(ctx.source).to.equal('return -ƒ.num(ƒ.member($,"x"))')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn({x: 100})
      expect(actualNumber).to.deep.equal([-100])
    })

    it("can triple-negate a value", () => {
      const ctx = generateFunctionSource('---30')
      expect(ctx.source).to.equal('return -ƒ.num(-(-30))')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn(null)
      expect(actualNumber).to.deep.equal([-30])
    })

    it("can add to a number", () => {
      const ctx = generateFunctionSource('$ + 4')
      expect(ctx.source).to.equal('return ƒ.num($)+4')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn(10)
      expect(actualNumber).to.deep.equal([14])
    })

    it("can multiply a number", () => {
      const ctx = generateFunctionSource('$ * 10')
      expect(ctx.source).to.equal('return ƒ.num($)*10')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn(2)
      expect(actualNumber).to.deep.equal([20])
    })

    it("can modulo an array of numbers", () => {
      const ctx = generateFunctionSource('$ ? (@ % 2 == 0)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.num(v)%2,0))')
      const fn = createFunctionForTest(ctx)
      const actual = fn([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(actual).to.deep.equal([0, 2, 4, 6, 8])
    })

    it("can divide by a function", () => {
      const ctx = generateFunctionSource('$[0] / $.size()')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.array($,[0]))/ƒ.num(ƒ.size($))')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn([20, 0])
      expect(actualNumber).to.deep.equal([10])
    })

    it("chain arithmetic statements", () => {
      const ctx = generateFunctionSource('$[0] / ($.size() + 2)')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.array($,[0]))/ƒ.num((ƒ.num(ƒ.size($))+2))')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn([20, 0])
      expect(actualNumber).to.deep.equal([5])
    })

    it("chain arithmetic statements again", () => {
      const ctx = generateFunctionSource('$[0] / 5 * $.size() + 9 - 1')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.num(ƒ.array($,[0]))/5*ƒ.num(ƒ.size($)))+9-1')
      const fn = createFunctionForTest(ctx)
      const actualNumber = fn([20, 3])
      expect(actualNumber).to.deep.equal([16])
    })
  })

  describe("filter", () => {
    describe("lax compare", () => {
      it("can filter comparison predicates", () => {
        const ctx = generateFunctionSource('$ ? (@ == 1)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",v,1))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(1)
        expect(actual).to.deep.equal([1])
      })

      it("can filter comparison ! predicates", () => {
        const ctx = generateFunctionSource('$ ? (!(@ == 1))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.compare("==",v,1)))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(3)
        expect(actual).to.deep.equal([3])
      })

      it("can filter comparison predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? (@[*] == 1)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.boxStar(v),1))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([[1], [21, 7], [5, 1]])
        expect(actual).to.deep.equal([[1], [5, 1]])
      })

      it("can filter value accessor predicates", () => {
        const ctx = generateFunctionSource('$ ? (@.sleepy == true)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.member(v,"sleepy"),true))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{sleepy: true}, {sleepy: false}, {sleepy: "yes"}, {not: 1}])
        expect(actual).to.deep.equal([{sleepy: true}])
      })
    })

    describe("strict filter", () => {
      it("filter does not unwrap arrays in strict mode, and does not throw errors", () => {
        const ctx = generateFunctionSource('strict $ ? (@.sleepy == true)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.member(v,"sleepy"),true))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{sleepy: true}, {sleepy: false}, {sleepy: "yes"}, {not: 1}])
        expect(actual).to.deep.equal([])
      })

      it("can filter predicate", () => {
        const ctx = generateFunctionSource('strict $ ? (@ == 1)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",v,1))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(1)
        expect(actual).to.deep.equal([1])
      })
    })

    describe("exists", () => {
      it("can filter predicates on members", () => {
        const ctx = generateFunctionSource('$ ? (exists(@.z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(v,"z"))))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{z: true}, {y: false}, {a: "yes"}])
        expect(actual).to.deep.equal([{z: true}])
      })

      it("can filter not predicates on members", () => {
        const ctx = generateFunctionSource('$ ? (!exists(@.z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.exists(()=>(ƒ.member(v,"z")))))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{z: true}, {y: false}, {a: "yes"}])
        expect(actual).to.deep.equal([{y: false}, {a: "yes"}])
      })

      it("can filter predicates and extract members", () => {
        const ctx = generateFunctionSource('$ ? (exists(@.z)).z')
        expect(ctx.source).to.equal('return ƒ.member(ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(v,"z")))),"z")')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{z: 121.2}, {y: -99.828}, {a: "yes"}])
        expect(actual).to.deep.equal([121.2])
      })

      it("can filter predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? (exists(@[*].z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(ƒ.boxStar(v),"z"))))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([[{z: true}, {y: false}], [{a: "yes"}], [{q: 6, z: 1}]])
        expect(actual).to.deep.equal([[{z: true}, {y: false}], [{q: 6, z: 1}]])
      })
    })

    describe("'is unknown'", () => {
      it("can filter 'is unknown' predicates", () => {
        const ctx = generateFunctionSource('$ ? ((@.sleepy == true) is unknown)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.isUnknown(ƒ.compare("==",ƒ.member(v,"sleepy"),true)))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([{sleepy: 77},{sleepy: true}, {sleepy: false}, {sleepy: "yes"}])
        expect(actual).to.deep.equal([{sleepy: 77}, {sleepy: "yes"}])
      })

      it("can filter 'is unknown' predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? ((@[*] == true) is unknown)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.isUnknown(ƒ.compare("==",ƒ.boxStar(v),true)))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([[false, 100], [true], ["baby", true, {"g": 22}]])
        expect(actual).to.deep.equal([[false, 100], ["baby", true, {"g": 22}]])
      })
    })

    it("can filter not 'is unknown' predicate iterators", () => {
      const ctx = generateFunctionSource('$ ? (!(@[*] == true) is unknown)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.isUnknown(ƒ.compare("==",ƒ.boxStar(v),true))))')
      const fn = createFunctionForTest(ctx)
      const actual = fn([[false, 100], [true], ["baby", true, {"g": 22}]])
      expect(actual).to.deep.equal([[false, 100], [true], ["baby", true, {"g": 22}]])
    })

    it("can filter multiple predicates with && and ||", () => {
      const ctx = generateFunctionSource('$ ? ((@.a==1 || @.b==2 || @.b==3) && @.c=="hi")')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.and([(ƒ.or([ƒ.compare("==",ƒ.member(v,"a"),1),ƒ.compare("==",ƒ.member(v,"b"),2),ƒ.compare("==",ƒ.member(v,"b"),3)])),ƒ.compare("==",ƒ.member(v,"c"),"hi")]))')
      const fn = createFunctionForTest(ctx)
      const actual = fn([{a: 1, c: "hi"}, {b: 2, c: "hi"}, {b: 3, c: "hi"}, {a: "yes"}, {a: 4, c: "hi"}])
      expect(actual).to.deep.equal([{a: 1, c: "hi"}, {b: 2, c: "hi"}, {b: 3, c: "hi"}])
    })

    describe("starts with", () => {
      it("can filter 'starts with' predicates", () => {
        const ctx = generateFunctionSource('$ ? (@ starts with "a")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.startsWith(v,"a"))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(["apple", "orange", "argon"])
        expect(actual).to.deep.equal(["apple", "argon"])
      })

      it("can filter iterator values", () => {
        const ctx = generateFunctionSource('$ ? (@[*] starts with "m")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.startsWith(ƒ.boxStar(v),"m"))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([["matt"], ["arjun", "mark", "mary"], ["abby"]])
        expect(actual).to.deep.equal([["matt"], ["arjun", "mark", "mary"]])
      })
    })

    describe("can filter 'like_regex' predicates", () => {
      it("without flags", () => {
        const ctx = generateFunctionSource('$ ? (@ like_regex "\\\\d+")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(v,/\\d+/))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(["8854", "bear"])
        expect(actual).to.deep.equal(["8854"])
      })

      it("with flags", () => {
        const ctx = generateFunctionSource('$ ? (@ like_regex "court" flag "i")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(v,/court/i))')
        const fn = createFunctionForTest(ctx)
        const actual = fn(["cOuRt", "COURT", 17])
        expect(actual).to.deep.equal(["cOuRt", "COURT"])
      })

      it("can filter an iterator of values", () => {
        const ctx = generateFunctionSource('$ ? (@[*] like_regex "\\\\d+")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(ƒ.boxStar(v),/\\d+/))')
        const fn = createFunctionForTest(ctx)
        const actual = fn([true, ["bear", "8854"], ["not a number"], ["1", "-2"]])
        expect(actual).to.deep.equal([["bear", "8854"], ["1", "-2"]])
      })

      it("with wrong flags", () => {
        expect(() => generateFunctionSource('$ ? (@ like_regex "court" flag "not")')).to.throw
      })

      it("throws Error with unsafe regex", () => {
        expect(() => generateFunctionSource('$ ? (@ like_regex "(x+x+)+y")')).to.throw
      })
    })

    it("chains filters", () => {
      const data = [[{"z": true}, {"y": false}], [{"a": "yes"}], [{"z": 1}]]
      let ctx = generateFunctionSource('$ ? (exists(@[*].z))')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(ƒ.boxStar(v),"z"))))')
      const existsFn = createFunctionForTest(ctx)
      const actualExists = existsFn(data)
      expect(actualExists).to.deep.equal([[{"z": true}, {"y": false}], [{"z": 1}]])

      ctx = generateFunctionSource('$ ? (@.size() > 0)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare(">",ƒ.size(v),0))')
      const sizeFn = createFunctionForTest(ctx)
      const actualSize = sizeFn(data)
      expect(actualSize).to.deep.equal(data)

      ctx = generateFunctionSource('$ ? (exists(@[*].z)) ? (@.size() > 0)')
      expect(ctx.source).to.equal('return ƒ.filter(ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(ƒ.boxStar(v),"z")))),v=>ƒ.compare(">",ƒ.size(v),0))')
      const chainFn = createFunctionForTest(ctx)
      const actualChain = chainFn(data)
      expect(actualChain).to.deep.equal([{"z": true}, {"y": false}, {"z": 1}])
    })
  })
})
