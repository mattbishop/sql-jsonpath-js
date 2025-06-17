import { Lexer} from "chevrotain"
import { iterate} from "iterare"
import { IteratorWithOperators} from "iterare/lib/iterate.js"

import { CodegenContext, newCodegenVisitor } from "./codegen-visitor.ts"
import { ƒBase } from "./ƒ-base.ts"
import { DefaultOnEmptyIterator, DefaultOnErrorIterator, EMPTY_ITERATOR, isIterableInput, one } from "./iterators.ts"
import { Input, NamedVariables, SqlJsonPathStatement, StatementConfig } from "./json-path.ts"
import { JsonPathParser } from "./parser.js"
import { allTokens } from "./tokens.js"


const jsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()
const codegenVisitor = newCodegenVisitor(parser.getBaseCstVisitorConstructor())


/**
 * @internal
 */
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


/**
 * @internal
 */
export type SJPFn = ($: unknown, $named?: NamedVariables) => IteratorWithOperators<unknown>


/**
 * @internal
 */
export function createFunction({source, lax}: CodegenContext): SJPFn {
  const fn = new Function("ƒ", "$", "$$", source)
  const ƒ = new ƒBase(lax)

  return ($, $named = {}) => {
    const $$ = (name: string): unknown => {
      if ($named.hasOwnProperty(name)) {
        return $named[name]
      }
      // thrown for both LAX and STRICT modes
      throw new Error(`no variable named '$${name}'`)
    }
    const result = fn(ƒ, $, $$)
    return result instanceof IteratorWithOperators
      ? result
      : iterate([result])
  }
}


/**
 * @internal
 */
export function createStatement(text: string): SqlJsonPathStatement {
  const ctx = generateFunctionSource(text)
  const find = createFunction(ctx)

  return {
    mode:     ctx.lax ? "lax" : "strict",
    source:   text,
    fnSource: ctx.source,

    exists<T>(input: Input<T>, config: StatementConfig<boolean> = {}): boolean | IterableIterator<boolean> {
      const {variables} = config
      // iterate through the inputs one at a time and test them against find()
      // because ƒ.filter() will omit the exists == false elements
      const existsƒ = (i: unknown) => !find(i, variables).next().done
      const iterator = defaultsIterator(
          wrapInput(input).map(existsƒ),
          config)

      return isIterableInput(input)
        ? iterator
        : one(iterator) ?? false
    },

    values<T>(input: Input<T>, config: StatementConfig = {}): IterableIterator<unknown> {
      const {variables} = config
      const iterator = find(wrapInput(input), variables)
        .filter((v) => v !== EMPTY_ITERATOR)
      return defaultsIterator(iterator, config)
    }
  }
}


function wrapInput<T>(input: any): IteratorWithOperators<T> {
  // arrays are iterable, but treat them as singleton inputs
  let iterator = isIterableInput(input)
      ? input
      : [input]
  return iterate(iterator)
}


function defaultsIterator<T>(input: Iterator<T>, config: StatementConfig<T>): IteratorWithOperators<T> {
  let iterator = input
  const {defaultOnEmpty, defaultOnError} = config
  // test against undefined so statements can default to false, "", 0, and other truthy values.
  if (defaultOnError !== undefined) {
    iterator = new DefaultOnErrorIterator<T>(defaultOnError, iterator)
  }
  if (defaultOnEmpty !== undefined) {
    iterator = new DefaultOnEmptyIterator<T>(defaultOnEmpty, iterator)
  }
  return iterator instanceof IteratorWithOperators
    ? iterator
    : iterate(iterator)
}
