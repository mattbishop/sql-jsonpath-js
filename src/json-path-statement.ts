import {Lexer} from "chevrotain"

import {type CodegenContext, newCodegenVisitor} from "./codegen-visitor.ts"
import {ƒBase} from "./ƒ-base.ts"
import {
  DefaultOnEmptyIterator,
  DefaultOnErrorIterator,
  FlattenWithIterator,
  isIterableInput,
  MapWithIterator,
  toInputIterator
} from "./iterators.ts"
import {type Input, MissingVariableError, type NamedVariables, type QueryConfig, type SqlJsonPathStatement} from "./json-path.ts"
import {JsonPathParser} from "./parser.ts"
import {allTokens} from "./tokens.ts"
import {hasValue, isObject} from "./ƒ-utils.ts"
import type { SingleOrSeq } from "./types.ts"


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
export type SJPFn<T> = ($: unknown, isQuery: boolean, $named?: NamedVariables) => T | IteratorObject<T>

const EMPTY$$ = (name: string) => {
  missingVarError(name)
}


// thrown for both LAX and STRICT modes
function missingVarError(name: string) {
  throw new MissingVariableError(`no variable named '$${name}'`)
}

function createFunction<T>({source, lax, scope}: CodegenContext): SJPFn<T> {
  const fn = new Function("ƒ", "$", "$$", source)
  const ƒ = new ƒBase(lax, scope)

  return ($, isQuery, $named?) => {
    if ($named !== undefined && !isObject($named)) {
      throw new Error("vars must be an object")
    }
    const $$ = !$named
      ? EMPTY$$
      : (name: string): unknown => {
        if (Object.hasOwn($named, name)) {
          return $named[name]
        }
        missingVarError(name)
      }

    ƒ.inQuery = isQuery
    return fn(ƒ, $, $$)
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
      const existsƒ = (i: unknown) => hasValue(fn(i, false, vars), ctx.lax)
      return isIterableInput(input)
        ? new MapWithIterator(input, existsƒ, false)
        // single input requires single output
        : existsƒ(input)
    },

    query<T>(input: Input, config: QueryConfig<T> = {}): IteratorObject<T> {
      const {vars} = config
      const queryƒ = (i: unknown) => fn(i, true, vars) as SingleOrSeq<T>
      const iterator = new FlattenWithIterator<T>(toInputIterator(input), queryƒ, true)
      return defaultsIterator(iterator, config)
    }
  }
}


function defaultsIterator<T>(iterator: IteratorObject<T>, config: QueryConfig<T>): IteratorObject<T> {
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
