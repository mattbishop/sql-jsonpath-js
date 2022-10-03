import {IteratorWithOperators} from "iterare/lib/iterate"
import {CodegenBase} from "./codegen-base"
import {CodegenContext, newCodegenVisitor} from "./codegen-visitor"
import {JsonPathParser} from "./parser";
import {allTokens} from "./tokens";
import {Lexer} from "chevrotain"
import {newJsonPathVisitor} from "./visitor";
import {SqlJsonPath, SqlJsonPathStatement} from "./json-path";


const jsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()

const origVisitor = newJsonPathVisitor(parser.getBaseCstVisitorConstructor())
const codegenVisitor = newCodegenVisitor(parser.getBaseCstVisitorConstructor())


export function generateFunctionSource(text: string): CodegenContext {
  const {tokens, errors} = jsonPathLexer.tokenize(text)

  if (errors?.length) {
    console.error(`Cannot tokenize "${text}": ${JSON.stringify(errors)}`)
    throw errors[0]
  }
  parser.input = tokens

  const cst = parser.jsonPathStatement()
  if (parser?.errors.length) {
    console.error(`Parsing errors detected: ${JSON.stringify(parser.errors)}`)
    throw parser.errors[0]
  }

  return codegenVisitor.visit(cst, {lax: true, source: ""})
}


type JSONPathFunction = ($: any, $named?: Record<string, any>) => [any]

export function createFunction({source, lax}: CodegenContext): JSONPathFunction {
  const fn = Function("ƒ", "$", "$$", source)
  const ƒ = new CodegenBase(lax)

  return ($, $named = {}) => {
    const $$ = (name: string): any => {
      if ($named.hasOwnProperty(name)) {
        return $named[name]
      }
      throw new Error(`no variable named '${name}'`)
    }
    let result = fn(ƒ, $, $$)
    if (result instanceof IteratorWithOperators) {
      result = result.toArray()
    } else {
      result = [result]
    }
    return result
  }
}


export function compile(text: string): SqlJsonPath {
  const lexingResult = jsonPathLexer.tokenize(text)

  // "input" is a setter which will reset the parser's state.
  parser.input = lexingResult.tokens

  const cst = parser.jsonPathStatement()
  if (parser.errors.length > 0) {
    throw new Error(`sad sad panda, Parsing errors detected: ${parser.errors[0]}`)
  }


  const statement = origVisitor.visit(cst) as SqlJsonPathStatement
  return {
    statement,
    exists,
    value,
    query
  }
}

function exists(): boolean {
  return false
}

function value(): boolean {
  return false
}

function query(): any {
  return []
}
