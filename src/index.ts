import {JsonPathParser} from "./parser";
import {allTokens} from "./tokens";
import {Lexer} from "chevrotain"
const JsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()

function parseInput(text: string) {
  const lexingResult = JsonPathLexer.tokenize(text)

  // "input" is a setter which will reset the parser's state.
  parser.input = lexingResult.tokens
  parser.jsonPathStatement()

  if (parser.errors.length > 0) {
    throw new Error(`sad sad panda, Parsing errors detected: ${parser.errors[0]}`)
  }
}

const inputText = "$.foo.bar"
parseInput(inputText)
