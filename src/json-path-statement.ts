import {Lexer} from "chevrotain"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {isIterable} from "iterare/lib/utils"
import {CodegenContext, newCodegenVisitor} from "./codegen-visitor"
import {FnBase} from "./fn-base"
import {DefaultOnEmptyIterator, DefaultOnErrorIterator, SingletonIterator} from "./iterators"
import {Input, NamedVariables, SqlJsonPathStatement, StatementConfig} from "./json-path"
import {JsonPathParser} from "./parser"
import {allTokens} from "./tokens"


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


export type SJPFn = ($: unknown, $named?: NamedVariables) => IteratorWithOperators<unknown>

export function createFunction({source, lax}: CodegenContext): SJPFn {
  const fn = Function("ƒ", "$", "$$", source)
  const ƒ = new FnBase(lax)

  return ($, $named = {}) => {
    const $$ = (name: string): unknown => {
      if ($named.hasOwnProperty(name)) {
        return $named[name]
      }
      throw new Error(`no variable named '$${name}'`)
    }
    const result = fn(ƒ, $, $$)
    return result instanceof IteratorWithOperators
      ? result
      : iterate(new SingletonIterator(result))
  }
}


export function createStatement(text: string): SqlJsonPathStatement {
  const ctx = generateFunctionSource(text)
  const find = createFunction(ctx)
  return {
    mode:     ctx.lax ? "lax" : "strict",
    source:   text,
    fnSource: ctx.source,

    exists(input: any, config: StatementConfig<boolean> = {}): IterableIterator<boolean> {
      const {variables} = config
      const iterator = wrapInput(input)
      // have to walk through the inputs one at a time and test them against find()
      // because filter() will omit the exists == false elements
      return defaultsIterator<boolean>(
        iterator.map((i) => !find(i, variables).next().done), config)
    },

    query<T>(input: Input<T>, config: StatementConfig<T> = {}): IterableIterator<T> {
      const {defaultOnEmpty, defaultOnError, variables} = config
      let current: T
      const tapped = tap(wrapInput<T>(input), (v) => current = v)
      return defaultsIterator(find(tapped, variables), config)
        .filter((v) => v !== FnBase.EMPTY)
        .map((v) => (v === defaultOnEmpty || v === defaultOnError) ? v as T : current)
    },

    values<T>(input: Input<T>, config: StatementConfig = {}): IterableIterator<unknown> {
      const {variables} = config
      const iterator = wrapInput(input)
      return defaultsIterator(find(iterator, variables), config)
        .filter((v) => v !== FnBase.EMPTY)
    }
  }
}


function wrapInput<T>(input: any): IteratorWithOperators<T> {
  let iterator
  if (typeof input === "string" || !isIterable(input)) {
    iterator = new SingletonIterator(input)
  } else {
    iterator = input
  }
  return iterate(iterator)
}


function defaultsIterator<T>(input: Iterator<T>, config: StatementConfig<T>): IteratorWithOperators<T> {
  let iterator = input
  const {defaultOnEmpty, defaultOnError} = config
  // test against undefined so methods can default to false, "", 0, and other truthy values.
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


function tap<T>(source: Iterator<T>, callback: (value: T) => void): IteratorWithOperators<T> {
  return iterate(_tap(source, callback))
}

function* _tap<T>(source: Iterator<T>, callback: (value: T) => void): Generator<T> {
  let next
  while (!(next = source.next()).done) {
    const {value} = next
    callback(value);
    yield value;
  }
}
