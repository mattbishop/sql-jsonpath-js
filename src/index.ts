import {JsonPathParser} from "./parser";
import {allTokens} from "./tokens";
import {Lexer} from "chevrotain"
import {newJsonPathVisitor} from "./visitor";
import {SqlJsonPath, SqlJsonPathStatement} from "./json-path";

const JsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()
const visitor = newJsonPathVisitor(parser.getBaseCstVisitorConstructor())

export function compile(text: string): SqlJsonPath {
  const lexingResult = JsonPathLexer.tokenize(text)

  // "input" is a setter which will reset the parser's state.
  parser.input = lexingResult.tokens

  const cst = parser.jsonPathStatement()
  if (parser.errors.length > 0) {
    throw new Error(`sad sad panda, Parsing errors detected: ${parser.errors[0]}`)
  }

  const statement =  visitor.visit(cst) as SqlJsonPathStatement
  return {
    statement: statement,
    exists: exists,
    match: match,
    query: query,
    first: first
  }
}

function exists(): boolean {
  return false
}

function match(): boolean {
  return false
}

function query(): any[] {
  return []
}

function first(): any {
  return undefined
}
