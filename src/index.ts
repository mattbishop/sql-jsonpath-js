import {IteratorWithOperators} from "iterare/lib/iterate"
import {FnBase} from "./fn-base"
import {CodegenContext, newCodegenVisitor} from "./codegen-visitor"
import {createStatement} from "./json-path-statement"
import {JsonPathParser} from "./parser"
import {allTokens} from "./tokens"
import {Lexer} from "chevrotain"
import {NamedVariables, SqlJsonPathStatement} from "./json-path"


const jsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()

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


// todo decide if this should be deleted or move to test
type JSONPathFunction = ($: unknown, $named?: NamedVariables) => [unknown]

export function createFunction({source, lax}: CodegenContext): JSONPathFunction {
  const fn = Function("ƒ", "$", "$$", source)
  const ƒ = new FnBase(lax)

  return ($, $named = {}) => {
    const $$ = (name: string): unknown => {
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


export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}
