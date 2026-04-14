import {Lexer} from "chevrotain"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate.js"

import {type CodegenContext, newCodegenVisitor} from "./codegen-visitor.ts"
import {ƒBase} from "./ƒ-base.ts"
import {DefaultOnEmptyIterator, DefaultOnErrorIterator, isIterableInput, one, SingletonIterator} from "./iterators.ts"
import type {Input, NamedVariables, SqlJsonPathStatement, ValuesConfig} from "./json-path.ts"
import {JsonPathParser} from "./parser.ts"
import {allTokens} from "./tokens.ts"


const jsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()
const codegenVisitor = newCodegenVisitor(parser.getBaseCstVisitorConstructor())


/** @internal */
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

  return codegenVisitor.visit(cst, {lax: true, source: "", scope: new Map()})
}


/** @internal */
export type SJPFn = ($: unknown, $named?: NamedVariables) => IteratorWithOperators<unknown>


/** @internal */
export function createFunction({source, lax, scope}: CodegenContext): SJPFn {
  const fn = new Function("ƒ", "$", "$$", source)
  const ƒ = new ƒBase(lax, scope)

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


/** @internal */
export function createStatement(text: string): SqlJsonPathStatement {
  const ctx = generateFunctionSource(text)
  const fn = createFunction(ctx)

  return {
    mode:     ctx.lax ? "lax" : "strict",
    source:   text,
    fnSource: ctx.source,

    exists(input, config = {}): boolean | IterableIterator<boolean> {
      const {variables} = config
      // iterate through the inputs one at a time and test them against fn()
      // filter() will omit the exists == false elements, and the caller needs to know this
      const existsƒ = (i: unknown) => !fn(i, variables).next().done
      const iterator = iterate(toIterator(input))
            .map(existsƒ)

      // return the shape that matches input
      return isIterableInput(input)
        ? iterator as IterableIterator<boolean>
        : one(iterator) ?? false
    },

    values<T>(input: Input<T>, config: ValuesConfig = {}): IterableIterator<unknown> {
      const {variables} = config
      const valuesƒ = (i: unknown) => fn(i, variables)
      const valuesIterator = iterate(toIterator(input))
        .map(valuesƒ)
        .flatten()
      return defaultsIterator(valuesIterator, config) as IterableIterator<unknown>
    }
  }
}

function toIterator<T>(input: Input<T>): Iterator<T> {
  return isIterableInput(input)
    ? input[Symbol.iterator]()
    : new SingletonIterator<T>(input as T)
}


function defaultsIterator<T>(iterator: Iterator<T>, config: ValuesConfig<T>): Iterator<T> {
  const {defaultOnEmpty, defaultOnError} = config
  // test against undefined so statements can default to false, "", 0, and other truthy values.
  if (defaultOnError !== undefined) {
    iterator = new DefaultOnErrorIterator<T>(defaultOnError, iterator)
  }
  if (defaultOnEmpty !== undefined) {
    iterator = new DefaultOnEmptyIterator<T>(defaultOnEmpty, iterator)
  }
  return iterator
}
