import {expect} from "chai"
import {describe, it} from "node:test"

import type {CodegenContext} from "../src/codegen-visitor.ts"
import type {NamedVariables} from "../src/json-path.ts"
import {createFunction, generateFunctionSource} from "../src/json-path-statement.ts"


/**
 TODO move all usages of this into statement tests. This test is just supposed to be about codegen.
 @deprecated
 */
function createFunctionForTest(ctx: CodegenContext): ($: any, $named?: NamedVariables) => any[] {
  const fn = createFunction(ctx)
  // this is different from createStatement. This does not wrap the input in an iterator.
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
    })
  })

  describe("NamedVariable", () => {
    it("standalone named variable", () => {
      const ctx = generateFunctionSource('$n')
      expect(ctx.source).to.equal('return $$("n")')
    })
  })

  describe("item methods", () => {
    describe("type()", () => {
      it("single value", () => {
        const ctx = generateFunctionSource('$.type()')
        expect(ctx.source).to.equal('return ƒ.type($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].type()')
        expect (ctx.source).to.equal('return ƒ.type(ƒ.boxStar($))')
      })
    })

    describe("size()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$.size()')
        expect(ctx.source).to.equal('return ƒ.size($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].size()')
        expect (ctx.source).to.equal('return ƒ.size(ƒ.boxStar($))')
      })
    })

    describe("double()", () => {
      it ("single values", () => {
        const ctx = generateFunctionSource('$.double()')
        expect(ctx.source).to.equal('return ƒ.double($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].double()')
        expect (ctx.source).to.equal('return ƒ.double(ƒ.boxStar($))')
      })
    })

    describe("ceiling()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$. ceiling ()')
        expect(ctx.source).to.equal('return ƒ.ceiling($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].ceiling()')
        expect (ctx.source).to.equal('return ƒ.ceiling(ƒ.boxStar($))')
      })
    })

    describe("abs()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$ .abs (  )')
        expect(ctx.source).to.equal('return ƒ.abs($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].abs()')
        expect (ctx.source).to.equal('return ƒ.abs(ƒ.boxStar($))')
      })
    })

    describe("keyvalue()", () => {
      it("lax keyvalue", () => {
        const ctx = generateFunctionSource('$ .keyvalue (  )')
        expect(ctx.source).to.equal('return ƒ.keyvalue($)')
      })

      it("strict keyvalue", () => {
        const ctx = generateFunctionSource('strict $ .keyvalue (  )')
        expect(ctx.source).to.equal('return ƒ.keyvalue($)')
      })

      it("iterator of keyvalue", () => {
        const ctx = generateFunctionSource('$[*].keyvalue()')
        expect (ctx.source).to.equal('return ƒ.keyvalue(ƒ.boxStar($))')
      })
    })

    describe("date()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$ .date (  )')
        expect(ctx.source).to.equal('return ƒ.date($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].date()')
        expect (ctx.source).to.equal('return ƒ.date(ƒ.boxStar($))')
      })
    })

    describe("time()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$ .time (  )')
        expect(ctx.source).to.equal('return ƒ.time($)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].date()')
        expect (ctx.source).to.equal('return ƒ.date(ƒ.boxStar($))')
      })
    })

    describe("datetime()", () => {
      it("ISO string date", () => {
        const ctx = generateFunctionSource('$ .datetime(  )')
        expect(ctx.source).to.equal('return ƒ.datetime($,"CLDR")')
      })

      it("template string date", () => {
        const ctx = generateFunctionSource('$ .datetime("MM/DD/YYYY")')
        expect(ctx.source).to.equal('return ƒ.datetime($,"MM/DD/YYYY")')
      })

      it("template string datetime with timezone", () => {
        const ctx = generateFunctionSource('$.datetime("MM-DD/YYYY HH.MI:SSTZH")')
        expect(ctx.source).to.equal('return ƒ.datetime($,"MM-DD/YYYY HH.MI:SSTZH")')
      })

      it("handles datetime iterators", () => {
        const ctx = generateFunctionSource('$[*].datetime()')
        expect (ctx.source).to.equal('return ƒ.datetime(ƒ.boxStar($),"CLDR")')
      })
    })
  })

  describe("Wildcards", () => {
    describe(".*", () => {
      it("lax .*", () => {
        const ctx = generateFunctionSource('$.*')
        expect(ctx.source).to.equal('return ƒ.dotStar($)')
      })

      it("strict .*", () => {
        const ctx = generateFunctionSource('strict $.*')
        expect(ctx.source).to.equal('return ƒ.dotStar($)')
      })

      it(".* iterator values", () => {
        const ctx = generateFunctionSource('$[*].*')
        expect (ctx.source).to.equal('return ƒ.dotStar(ƒ.boxStar($))')
      })
    })

    describe("[*]", () => {
      it("lax [*]", () => {
        const ctx = generateFunctionSource('$[*]')
        expect(ctx.source).to.equal('return ƒ.boxStar($)')
      })

      it("strict [*]", () => {
        const ctx = generateFunctionSource('strict $[*]')
        expect(ctx.source).to.equal('return ƒ.boxStar($)')
      })

      it("lax [*][*] iterator values", () => {
        const ctx = generateFunctionSource('$[*][*]')
        expect (ctx.source).to.equal('return ƒ.boxStar(ƒ.boxStar($))')
      })

      it("strict [*][*] iterator values", () => {
        const ctx = generateFunctionSource('strict $[*][*]')
        expect (ctx.source).to.equal('return ƒ.boxStar(ƒ.boxStar($))')
      })
    })
  })

  describe("member accessor", () => {
    it(".member", () => {
      const ctx = generateFunctionSource('$.thing')
      expect(ctx.source).to.equal('return ƒ.member($,"thing")')
    })

    it(".\"member\"", () => {
      const ctx = generateFunctionSource('$."thing\\tbrick"')
      expect(ctx.source).to.equal('return ƒ.member($,"thing\\tbrick")')
    })

    it("nested member", () => {
      const ctx = generateFunctionSource('$.thing.name')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"thing"),"name")')
    })

    it("strict .member", () => {
      const ctx = generateFunctionSource('strict $.thing')
      expect(ctx.source).to.equal('return ƒ.member($,"thing")')
    })

    it("supports iterator values", () => {
      const ctx = generateFunctionSource('$[*].a')
      expect (ctx.source).to.equal('return ƒ.member(ƒ.boxStar($),"a")')
    })
  })

  describe("array accessor", () => {
    it("single elements", () => {
      // tests $.size() which is out of bounds, but in lax mode, ignores the access
      const ctx = generateFunctionSource('$[0,4,last,$.size()]')
      expect(ctx.source).to.equal('return ƒ.array($,[0,4,ƒ.last,ƒ.size($)])')
    })

    it("out-of-bounds array access in strict mode", () => {
      const ctx = generateFunctionSource('strict $[100]')
      expect(ctx.source).to.equal('return ƒ.array($,[100])')
    })

    it("non-arrays in lax mode", () => {
      const ctx = generateFunctionSource('$[last]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.last])')
    })

    it("non-arrays in strict mode", () => {
      const ctx = generateFunctionSource('strict $[last]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.last])')
    })

    it("range elements", () => {
      const ctx = generateFunctionSource('$[1 to 3]')
      expect(ctx.source).to.equal('return ƒ.array($,[ƒ.range(1,3)])')
    })

    it("unwraps lax", () => {
      const ctx = generateFunctionSource('$.phones.type')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"phones"),"type")')
    })

    it("nested array unwrapping", () => {
      const ctx = generateFunctionSource('$.phones[last]')
      expect(ctx.source).to.equal('return ƒ.array(ƒ.member($,"phones"),[ƒ.last])')
    })

    it("does not unwrap strict", () => {
      const ctx = generateFunctionSource('strict $.phones.type')
      expect(ctx.source).to.equal('return ƒ.member(ƒ.member($,"phones"),"type")')
    })

    it("nested elements", () => {
      const ctx = generateFunctionSource('$[0,$[last][1]]')
      expect(ctx.source).to.equal('return ƒ.array($,[0,ƒ.array(ƒ.array($,[ƒ.last]),[1])])')
    })
  })

  describe("arithmetic", () => {
    it("can negate a value", () => {
      const ctx = generateFunctionSource('-$.x')
      expect(ctx.source).to.equal('return -ƒ.num(ƒ.member($,"x"))')
    })

    it("can triple-negate a value", () => {
      const ctx = generateFunctionSource('---30')
      expect(ctx.source).to.equal('return -ƒ.num(-(-30))')
    })

    it("can add to a number", () => {
      const ctx = generateFunctionSource('$ + 4')
      expect(ctx.source).to.equal('return ƒ.num($)+4')
    })

    it("can multiply a number", () => {
      const ctx = generateFunctionSource('$ * 10')
      expect(ctx.source).to.equal('return ƒ.num($)*10')
    })

    it("can modulo an array of numbers", () => {
      const ctx = generateFunctionSource('$ ? (@ % 2 == 0)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.num(v)%2,0))')
    })

    it("can divide by a function", () => {
      const ctx = generateFunctionSource('$[0] / $.size()')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.array($,[0]))/ƒ.num(ƒ.size($))')
    })

    it("chain arithmetic statements", () => {
      const ctx = generateFunctionSource('$[0] / ($.size() + 2)')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.array($,[0]))/ƒ.num((ƒ.num(ƒ.size($))+2))')
    })

    it("chain arithmetic statements again", () => {
      const ctx = generateFunctionSource('$[0] / 5 * $.size() + 9 - 1')
      expect(ctx.source).to.equal('return ƒ.num(ƒ.num(ƒ.array($,[0]))/5*ƒ.num(ƒ.size($)))+9-1')
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
