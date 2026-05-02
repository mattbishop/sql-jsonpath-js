import {expect} from "chai"
import {describe, it} from "node:test"

import {generateFunctionSource} from "../src/json-path-statement.ts"


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

      it("single values with precision", () => {
        const ctx = generateFunctionSource('$ .time ( 3 )')
        expect(ctx.source).to.equal('return ƒ.time($,3)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].time()')
        expect (ctx.source).to.equal('return ƒ.time(ƒ.boxStar($))')
      })
    })

    describe("time_tz()", () => {
      it("single values", () => {
        const ctx = generateFunctionSource('$ .time_tz (  )')
        expect(ctx.source).to.equal('return ƒ.time_tz($)')
      })

      it("single values with precision", () => {
        const ctx = generateFunctionSource('$ .time_tz ( 3 )')
        expect(ctx.source).to.equal('return ƒ.time_tz($,3)')
      })

      it("iterator of values", () => {
        const ctx = generateFunctionSource('$[*].time_tz()')
        expect (ctx.source).to.equal('return ƒ.time_tz(ƒ.boxStar($))')
      })
    })

    describe("datetime()", () => {
      it("ISO string date", () => {
        const ctx = generateFunctionSource('$ .datetime(  )')
        expect(ctx.source).to.equal('return ƒ.datetime($)')
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
        expect (ctx.source).to.equal('return ƒ.datetime(ƒ.boxStar($))')
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
      })

      it("can filter comparison ! predicates", () => {
        const ctx = generateFunctionSource('$ ? (!(@ == 1))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.compare("==",v,1)))')
      })

      it("can filter comparison predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? (@[*] == 1)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.boxStar(v),1))')
      })

      it("can filter value accessor predicates", () => {
        const ctx = generateFunctionSource('$ ? (@.sleepy == true)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.member(v,"sleepy"),true))')
      })
    })

    describe("strict filter", () => {
      it("filter does not unwrap arrays in strict mode, and does not throw errors", () => {
        const ctx = generateFunctionSource('strict $ ? (@.sleepy == true)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",ƒ.member(v,"sleepy"),true))')
      })

      it("can filter predicate", () => {
        const ctx = generateFunctionSource('strict $ ? (@ == 1)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare("==",v,1))')
      })
    })

    describe("exists", () => {
      it("can filter predicates on members", () => {
        const ctx = generateFunctionSource('$ ? (exists(@.z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(v,"z"))))')
      })

      it("can filter not predicates on members", () => {
        const ctx = generateFunctionSource('$ ? (!exists(@.z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.exists(()=>(ƒ.member(v,"z")))))')
      })

      it("can filter predicates and extract members", () => {
        const ctx = generateFunctionSource('$ ? (exists(@.z)).z')
        expect(ctx.source).to.equal('return ƒ.member(ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(v,"z")))),"z")')
      })

      it("can filter predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? (exists(@[*].z))')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(ƒ.boxStar(v),"z"))))')
      })
    })

    describe("'is unknown'", () => {
      it("can filter 'is unknown' predicates", () => {
        const ctx = generateFunctionSource('$ ? ((@.sleepy == true) is unknown)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.isUnknown(ƒ.compare("==",ƒ.member(v,"sleepy"),true)))')
      })

      it("can filter 'is unknown' predicate iterators", () => {
        const ctx = generateFunctionSource('$ ? ((@[*] == true) is unknown)')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.isUnknown(ƒ.compare("==",ƒ.boxStar(v),true)))')
      })
    })

    it("can filter not 'is unknown' predicate iterators", () => {
      const ctx = generateFunctionSource('$ ? (!(@[*] == true) is unknown)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.not(ƒ.isUnknown(ƒ.compare("==",ƒ.boxStar(v),true))))')
    })

    it("can filter multiple predicates with && and ||", () => {
      const ctx = generateFunctionSource('$ ? ((@.a==1 || @.b==2 || @.b==3) && @.c=="hi")')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.and([(ƒ.or([ƒ.compare("==",ƒ.member(v,"a"),1),ƒ.compare("==",ƒ.member(v,"b"),2),ƒ.compare("==",ƒ.member(v,"b"),3)])),ƒ.compare("==",ƒ.member(v,"c"),"hi")]))')
    })

    describe("starts with", () => {
      it("can filter 'starts with' predicates", () => {
        const ctx = generateFunctionSource('$ ? (@ starts with "a")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.startsWith(v,"a"))')
      })

      it("can filter iterator values", () => {
        const ctx = generateFunctionSource('$ ? (@[*] starts with "m")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.startsWith(ƒ.boxStar(v),"m"))')
      })
    })

    describe("can filter 'like_regex' predicates", () => {
      it("without flags", () => {
        const ctx = generateFunctionSource('$ ? (@ like_regex "\\\\d+")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(v,/\\d+/))')
      })

      it("with flags", () => {
        const ctx = generateFunctionSource('$ ? (@ like_regex "court" flag "i")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(v,/court/i))')
      })

      it("can filter an iterator of values", () => {
        const ctx = generateFunctionSource('$ ? (@[*] like_regex "\\\\d+")')
        expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.match(ƒ.boxStar(v),/\\d+/))')
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

      ctx = generateFunctionSource('$ ? (@.size() > 0)')
      expect(ctx.source).to.equal('return ƒ.filter($,v=>ƒ.compare(">",ƒ.size(v),0))')

      ctx = generateFunctionSource('$ ? (exists(@[*].z)) ? (@.size() > 0)')
      expect(ctx.source).to.equal('return ƒ.filter(ƒ.filter($,v=>ƒ.exists(()=>(ƒ.member(ƒ.boxStar(v),"z")))),v=>ƒ.compare(">",ƒ.size(v),0))')
    })
  })
})
