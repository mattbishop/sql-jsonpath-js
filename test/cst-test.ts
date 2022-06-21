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
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.ContextVariable")
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

  describe("Context variable tests", () => {

    it("parses context variable", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.ContextVariable")
    })

    it("parses named variable with word characters", () => {
      const actual = parseJsonPath("$book")
      expect(actual).to.have.nested.include({"children.wff[0].children.left[0].children.NamedVariable[0].image": "$book"})
    })

    it("parses named variable with extra characters", () => {
      const actual = parseJsonPath("$m@#x")
      expect(actual).to.have.nested.include({"children.wff[0].children.left[0].children.NamedVariable[0].image": "$m@#x"})
    })

    // todo @ is not allowed in root expressions. Must be in a filter expression.
    it("parses filter value", () => {
      const actual = parseJsonPath("@")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.FilterValue")
    })
  })

  describe("wff tests", () => {

    it("adds ContextVariable and MemberVariable", () => {
      const actual = parseJsonPath("$ + $car")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.ContextVariable")
      expect(actual).to.nested.include({"children.wff[0].children.ArithmeticOperator[0].image": "+"})
      expect(actual).to.have.nested.property("children.wff[0].children.right[0].children.NamedVariable")
    })

    it("multiplies MemberVariable and ContextVariable with no whitespace", () => {
      const actual = parseJsonPath("$bling*$")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.NamedVariable")
      expect(actual).to.nested.include({"children.wff[0].children.ArithmeticOperator[0].image": "*"})
      expect(actual).to.have.nested.property("children.wff[0].children.right[0].children.ContextVariable")
    })

    it("divides MemberVariable and FilterValue with no whitespace", () => {
      const actual = parseJsonPath("$bling/@")
      expect(actual).to.have.nested.property("children.wff[0].children.left[0].children.NamedVariable")
      expect(actual).to.nested.include({"children.wff[0].children.ArithmeticOperator[0].image": "/"})
      expect(actual).to.have.nested.property("children.wff[0].children.right[0].children.FilterValue")
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