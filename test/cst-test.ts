import { expect } from "chai"
import {Lexer} from "chevrotain"
import {JsonPathParser} from "../src/parser"
import {allTokens} from "../src/tokens"


const JsonPathLexer = new Lexer(allTokens, { ensureOptimizations: true })
const parser = new JsonPathParser()

function parseJsonPath(statement: string) {
  const lexingResult = JsonPathLexer.tokenize(statement)
  parser.input = lexingResult.tokens
  const cst = parser.jsonPathStatement()
  if (parser.errors?.length) {
    console.error(parser.errors)
    throw(parser.errors[0])
  }
  return cst
}

describe("SQL JSONPath CST", () => {

  describe("Mode tests", () => {

    it("parses context variable without a mode", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.primary[0].children.ContextVariable")
    })

    it("parses lax mode", () => {
      const actual = parseJsonPath("lax $")
      expect(actual).to.nested.include({"children.Mode[0].image": "lax"})
    })

    it("parses strict mode", () => {
      const actual = parseJsonPath("strict $")
      expect(actual).to.nested.include({"children.Mode[0].image": "strict"})
    })
  })

  describe("Variable tests", () => {

    const cstPrefix = "children.wff[0].children.left[0].children.primary[0].children"

    it("parses context variable", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property(`${cstPrefix}.ContextVariable`)
    })

    it("parses named variable with word characters", () => {
      const actual = parseJsonPath("$book")
      expect(actual).to.have.nested.include({[`${cstPrefix}.NamedVariable[0].image`]: "$book"})
    })

    it("parses named variable with extra characters", () => {
      const actual = parseJsonPath("$m3@#x")
      expect(actual).to.have.nested.include({[`${cstPrefix}.NamedVariable[0].image`]: "$m3@#x"})
    })
  })

  describe("Literal tests", () => {

    const cstPrefix = "children.wff[0].children.left[0].children.primary[0].children.literal[0].children"

    it("parses zero", () => {
      const actual = parseJsonPath("0")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Number[0].image`]: "0"})
    })

    it("parses positive integer number", () => {
      const actual = parseJsonPath("100")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Number[0].image`]: "100"})
    })

    it("parses negative integer number", () => {
      const actual = parseJsonPath("-95")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Number[0].image`]: "-95"})
    })

    it("parses decimal number", () => {
      const actual = parseJsonPath("-758.004")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Number[0].image`]: "-758.004"})
    })

    it("parses exponent number", () => {
      const actual = parseJsonPath("-2.2e-33")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Number[0].image`]: "-2.2e-33"})
    })

    it("parses empty string", () => {
      const actual = parseJsonPath("\"\"")
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: "\"\""})
    })

    it("parses sentence string", () => {
      const actual = parseJsonPath("\"The quick, brown fox jumped over the lazy dog!\"")
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: "\"The quick, brown fox jumped over the lazy dog!\""})
    })

    it("parses unicode string", () => {
      const actual = parseJsonPath("\"ब्राउन फक्स\"")
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: "\"ब्राउन फक्स\""})
    })

    it("parses emoji string", () => {
      const actual = parseJsonPath("\"🟫🦊\"")
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: "\"🟫🦊\""})
    })

    it("parses emoji surrogate pair string", () => {
      const actual = parseJsonPath("\"🇨🇦👨‍👨‍👧‍👧\"")
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: "\"🇨🇦👨‍👨‍👧‍👧\""})
    })

    it("parses string with quoted term", () => {
      const actual = parseJsonPath('"Pete \\"Maverick\\" Pilot"')
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: '"Pete \\"Maverick\\" Pilot"'})
    })

    it("parses string with multiple escaped quotes", () => {
      const actual = parseJsonPath('"\\"\\"\\""')
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: '"\\"\\"\\""'})
    })

    it("parses string with escaped invisible characters", () => {
      const actual = parseJsonPath('"\\t\\r\\n\\b\\\\"')
      expect(actual).to.have.nested.include({[`${cstPrefix}.String[0].image`]: '"\\t\\r\\n\\b\\\\"'})
    })

    it("parses exponent boolean true", () => {
      const actual = parseJsonPath("true")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Boolean[0].image`]: "true"})
    })

    it("parses exponent boolean false", () => {
      const actual = parseJsonPath("false")
      expect(actual).to.have.nested.include({[`${cstPrefix}.Boolean[0].image`]: "false"})
    })

    it("parses null", () => {
      const actual = parseJsonPath("null")
      expect(actual).to.have.nested.property(`${cstPrefix}.Null`)
    })
  })

  describe("wff tests", () => {

    const cstPrefix = "children.wff[0].children"

    it("adds ContextVariable and MemberVariable", () => {
      const actual = parseJsonPath("$\n+\r$car")
      expect(actual).to.have.nested.property(`${cstPrefix}.left[0].children.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.ArithmeticOperator[0].image`]: "+"})
      expect(actual).to.have.nested.property(`${cstPrefix}.right[0].children.primary[0].children.NamedVariable`)
    })

    it("multiplies MemberVariable and ContextVariable with no whitespace", () => {
      const actual = parseJsonPath("$bling*$")
      expect(actual).to.have.nested.property(`${cstPrefix}.left[0].children.primary[0].children.NamedVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.ArithmeticOperator[0].image`]: "*"})
      expect(actual).to.have.nested.property(`${cstPrefix}.right[0].children.primary[0].children.ContextVariable`)
    })

    it("scopes with parentheses", () => {
      const actual = parseJsonPath("($)")
      const cstPrefix = "children.wff[0].children.left[0].children.primary[0]"
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].children.LeftParen`)
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].${cstPrefix}.children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].children.RightParen`)
    })

    it("scopes with nested parentheses", () => {
      const actual = parseJsonPath("(($))")
      const cstPrefix = "children.wff[0].children.left[0].children.primary[0]"
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].children.LeftParen`)
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].${cstPrefix}.children.scopedWff[0].children.LeftParen`)
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].${cstPrefix}.children.scopedWff[0].${cstPrefix}.children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.children.scopedWff[0].${cstPrefix}.children.scopedWff[0].children.RightParen`)
    })
  })

  describe("Accessor expression tests", () => {
    const cstPrefix = "children.wff[0].children.left[0].children"

    it("ASCII member names", () => {
      const actual = parseJsonPath("$.matt")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.Member[0].image`]: ".matt"})
    })

    it("$ start member name not allowed", () => {
      expect(() => parseJsonPath("$.$matt")).to.throw("expecting EOF but found: $matt")
    })

    it("Unicode member names", () => {
      const actual = parseJsonPath("$.ಠ_ಠ")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.Member[0].image`]: ".ಠ_ಠ"})
    })

    it("Quoted member names", () => {
      const actual = parseJsonPath("$.\"first name\"")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.Member[0].image`]: ".\"first name\""})
    })

    it("Member names with spaces", () => {
      const actual = parseJsonPath("$. クッキー")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.Member[0].image`]: ". クッキー"})
    })

    it("Wildcard member", () => {
      const actual = parseJsonPath("$.*")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.WildcardMember`)
    })

    it("Wildcard member with spaces", () => {
      const actual = parseJsonPath("$ . *")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.WildcardMember`)
    })

    it("Wildcard array", () => {
      const actual = parseJsonPath("$[*]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.WildcardArray`)
    })

    it("Wildcard array with spaces", () => {
      const actual = parseJsonPath("$[ *\n]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.WildcardArray`)
    })

    it("wildcard member array", () => {
      const actual = parseJsonPath("$.*[1]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.WildcardMember`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[1].children.array[0].children.subscript[0].${cstPrefix}.primary[0].children.literal[0].children.Number`)
    })

    it("item method", () => {
      const actual = parseJsonPath("$.size()")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.ItemMethod[0].image`]: ".size()"})
    })

    it("item method with spaces", () => {
      const actual = parseJsonPath("$.  keyvalue\t(\r)")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.ItemMethod[0].image`]: ".  keyvalue\t(\r)"})
    })
  })

  describe("Array tests", () => {
    const cstPrefix = "children.wff[0].children.left[0].children"

    it("accesses last element", () => {
      const actual = parseJsonPath("$[last]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.LeftBracket`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.primary[0].children.Last`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.RightBracket`)
    })

    it("accesses range of elements with 'to'", () => {
      const actual = parseJsonPath("$[4 to last]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.LeftBracket`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.primary[0].children.literal[0].children.Number`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].children.To`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix.replace("wff[0]", "wff[1]")}.primary[0].children.Last`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.RightBracket`)
    })

    it("accesses comma-separated list of elements", () => {
      const actual = parseJsonPath("$[1, 3, 5]")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.LeftBracket`)
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.primary[0].children.literal[0].children.Number[0].image`]: "1"})
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.array[0].children.subscript[1].${cstPrefix}.primary[0].children.literal[0].children.Number[0].image`]: "3"})
      expect(actual).to.nested.include({[`${cstPrefix}.accessor[0].children.array[0].children.subscript[2].${cstPrefix}.primary[0].children.literal[0].children.Number[0].image`]: "5"})
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.Comma[0]`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.Comma[1]`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.RightBracket`)
    })

    it("accesses members at array element", () => {
      const actual = parseJsonPath("$[$.things[*] ? (@ == true)]")

      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.primary[0].children.ContextVariable`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.accessor[0].children.Member`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.accessor[1].children.WildcardArray`)
      expect(actual).to.have.nested.property(`${cstPrefix}.accessor[0].children.array[0].children.subscript[0].${cstPrefix}.accessor[2].children.filter`)
    })
  })

  describe("Predicate tests", () => {
    const cstPrefix = "children.wff[0].children.left[0].children"
    const filterPrefix = `${cstPrefix}.accessor[0].children.filter[0].children`

    it("starts with", () => {
      const actual = parseJsonPath("$ ? (@ starts with \"m\")")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

      expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].${cstPrefix}.primary[0].children.FilterValue`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.startsWith[0].children.StartsWith`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.startsWith[0].children.String`)
      expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
    })

    it("exists", () => {
      const actual = parseJsonPath("$ ? (exists(@))")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

      expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.delimitedPredicate[0].children.exists[0].children.Exists`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.delimitedPredicate[0].children.exists[0].${cstPrefix}.primary[0].children.FilterValue`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.delimitedPredicate[0].children.exists[0].children.RightParen`)
      expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
    })

    it("is unknown", () => {
      const actual = parseJsonPath("$ ? ((@.max > 1) is unknown)")
      expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

      expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.isUnknown[0].children.IsUnknown`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.isUnknown[0].children.scopedPredicate[0].children.predicate[0].${cstPrefix}.primary[0].children.FilterValue`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.isUnknown[0].children.scopedPredicate[0].children.predicate[0].${cstPrefix}.accessor[0].children.Member`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.isUnknown[0].children.scopedPredicate[0].children.predicate[0].children.comparison[0].children.ComparisonOperator`)
      expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.isUnknown[0].children.scopedPredicate[0].children.predicate[0].children.comparison[0].${cstPrefix}.primary[0].children.literal[0].children.Number`)
      expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
    })

    describe("like_regex", () => {
      it("without flag", () => {
        const actual = parseJsonPath("$ ? (@ like_regex \"\d+\")")
        expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

        expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].${cstPrefix}.primary[0].children.FilterValue`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.LikeRegex`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.Pattern`)
        expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
      })

      it("with flag", () => {
        const actual = parseJsonPath("$ ? (@ like_regex \"\d+\" flag \"m\")")
        expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

        expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].${cstPrefix}.primary[0].children.FilterValue`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.LikeRegex`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.Pattern`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.Flag`)
        expect(actual).to.have.nested.property(`${filterPrefix}.predicate[0].children.likeRegex[0].children.FlagValue`)
        expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
      })
    })

    describe("accessor after predicate", () => {
      it("calls method after predicate", () => {
        const actual = parseJsonPath("$ ? (@ <> 2).keyvalue()")
        expect(actual).to.have.nested.property(`${cstPrefix}.primary[0].children.ContextVariable`)

        expect(actual).to.have.nested.property(`${filterPrefix}.PredicateStart`)
        expect(actual).to.have.nested.property(`${filterPrefix}.RightParen`)
        expect(actual).to.have.nested.property(`${cstPrefix}.accessor[1].children.ItemMethod`)
      })
    })
  })
})