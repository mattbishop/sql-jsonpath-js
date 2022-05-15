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

    it("parses context item without a mode", () => {
      const actual = parseJsonPath("$")
      expect(actual).to.have.nested.property("children.jsonPathWff[0].children.left[0].children.left[0].children.ContextVariable")
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

  describe("wff tests", () => {
    const actual = parseJsonPath("$ + $")
    expect(actual).to.have.nested.property("children.jsonPathWff[0].children.left[0].children.left[0].children.ContextVariable")
    expect(actual).to.have.nested.property("children.jsonPathWff[0].children.left[0].children.PlusMinusOperator")
    expect(actual).to.have.nested.property("children.jsonPathWff[0].children.left[0].children.right[0].children.left[0].children.ContextVariable")
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