import { expect } from "chai"
import {Lexer} from "chevrotain"
import {JsonPathParser} from "../src/parser"
import {allTokens} from "../src/tokens"


const JsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()

function parseJsonPath(statement: string, parserPart = () => parser.jsonPathStatement()) {
  const lexingResult = JsonPathLexer.tokenize(statement)
  parser.input = lexingResult.tokens
  const cst = parserPart()
  if (parser.errors?.length) {
    console.error(parser.errors)
  }
  expect(parser.errors).to.be.empty
  return cst
}

describe("SQL JSONPath CST", () => {

  describe("Mode tests", () => {

    it("parses context variable without a mode", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.primary[0].children.Variable")
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

    const expectedPrefix = "children.wff[0].children.left[0].children.primary[0].children.Variable"

    it("parses context variable", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property(expectedPrefix)
    })

    it("parses named variable with word characters", () => {
      const actual = parseJsonPath("$book")
      expect(actual).to.have.nested.include({[`${expectedPrefix}[0].image`]: "$book"})
    })

    it("parses named variable with extra characters", () => {
      const actual = parseJsonPath("$m3@#x")
      expect(actual).to.have.nested.include({[`${expectedPrefix}[0].image`]: "$m3@#x"})
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

    const expectedPrefix = "children.wff[0].children"

    it("adds ContextVariable and MemberVariable", () => {
      const actual = parseJsonPath("$ + $car")
      expect(actual).to.have.nested.property(`${expectedPrefix}.left[0].children.primary[0].children.Variable`)
      expect(actual).to.nested.include({[`${expectedPrefix}.ArithmeticOperator[0].image`]: "+"})
      expect(actual).to.have.nested.property(`${expectedPrefix}.right[0].children.primary[0].children.Variable`)
    })

    it("multiplies MemberVariable and ContextVariable with no whitespace", () => {
      const actual = parseJsonPath("$bling*$")
      expect(actual).to.have.nested.property(`${expectedPrefix}.left[0].children.primary[0].children.Variable`)
      expect(actual).to.nested.include({[`${expectedPrefix}.ArithmeticOperator[0].image`]: "*"})
      expect(actual).to.have.nested.property(`${expectedPrefix}.right[0].children.primary[0].children.Variable`)
    })

    it("scopes with parentheses", () => {
      const actual = parseJsonPath("($)")
      const expectedPrefix = "children.wff[0].children.left[0].children.primary[0]"
      expect(actual).to.have.nested.property(`${expectedPrefix}.children.LeftParen`)
      expect(actual).to.have.nested.property(`${expectedPrefix}.${expectedPrefix}.children.Variable`)
      expect(actual).to.have.nested.property(`${expectedPrefix}.children.RightParen`)
    })

    it("scopes with nested parentheses", () => {
      const actual = parseJsonPath("(($))")
      const expectedPrefix = "children.wff[0].children.left[0].children.primary[0]"
      expect(actual).to.have.nested.property(`${expectedPrefix}.children.LeftParen`)
      expect(actual).to.have.nested.property(`${expectedPrefix}.${expectedPrefix}.children.LeftParen`)
      expect(actual).to.have.nested.property(`${expectedPrefix}.${expectedPrefix}.${expectedPrefix}.children.Variable`)
      expect(actual).to.have.nested.property(`${expectedPrefix}.${expectedPrefix}.children.RightParen`)
    })
  })

  describe("Member tests", () => {
    it("parses ASCII member names", () => {
      const actual = parseJsonPath(".matt", () => parser.memberRule())
      expect(actual).to.nested.include({"children.Member[0].image": ".matt"})
    })

    it("parses Emoji member names", () => {
      const actual = parseJsonPath(".ಠ_ಠ", () => parser.memberRule())
      expect(actual).to.nested.include({"children.Member[0].image": ".ಠ_ಠ"})
    })
  })

  describe("Filter tests", () => {

    describe("like_regex tests", () => {
      it("parses without flags", () => {
        const actual = parseJsonPath("like_regex \".+\"", () => parser.likeRegex())
        expect(actual).to.nested.include({"children.LikeRegex[0].image": "like_regex", "children.pattern[0].image": "\".+\""})
      })

      it("parses with flags", () => {
        const actual = parseJsonPath("like_regex \".+\" flag \"i\"", () => parser.likeRegex())
        expect(actual).to.nested.include({
          "children.LikeRegex[0].image": "like_regex",
          "children.pattern[0].image": "\".+\"",
          "children.FlagValue[0].image": "\"i\""
        })
      })
    })
  })
})