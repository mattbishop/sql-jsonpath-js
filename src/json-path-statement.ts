import {Lexer} from "chevrotain"

import {type CodegenContext, newCodegenVisitor} from "./codegen-visitor.ts"
import {ƒBase} from "./ƒ-base.ts"
import {
  DefaultOnEmptyIterator,
  DefaultOnErrorIterator,
  isIterableInput,
  isSeq,
  noValueFilter,
  one,
  SingletonIterator,
  toInputIterator
} from "./iterators.ts"
import type {Input, NamedVariables, SqlJsonPathStatement, QueryConfig} from "./json-path.ts"
import {JsonPathParser} from "./parser.ts"
import {allTokens} from "./tokens.ts"


const jsonPathLexer = new Lexer(allTokens, {
  ensureOptimizations: true,
  // turn off during development
  positionTracking: "onlyOffset",
  skipValidations: true
})
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
export type SJPFn<T> = ($: unknown, $named?: NamedVariables) => IteratorObject<T>


function createFunction<T>({source, lax, scope}: CodegenContext): SJPFn<T> {
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
    const iter = isSeq(result)
      ? result
      : Iterator.from(new SingletonIterator(result))
    return iter.filter(noValueFilter)
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

    exists(input, config = {}): boolean | IteratorObject<boolean> {
      const {vars} = config
      // iterate through the inputs one at a time and test them against fn()
      // filter() will omit the exists == false elements, and the caller needs to know this
      const existsƒ = (i: unknown) => !fn(i, vars).next().done
      const iterator = toInputIterator(input)
        .map(existsƒ)
      // return the shape that matches input
      return isIterableInput(input)
        ? iterator
        : one(iterator) ?? false
    },

    query<T>(input: Input, config: QueryConfig<T> = {}): IteratorObject<T> {
      const {vars} = config
      const queryƒ = (i: unknown) => fn(i, vars) as IteratorObject<T>
      const iterator = toInputIterator(input)
        .flatMap(queryƒ)
      return Iterator.from(defaultsIterator(iterator, config))
    }
  }
}


function defaultsIterator<T>(iterator: Iterator<T>, config: QueryConfig<T>): Iterator<T> {
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
