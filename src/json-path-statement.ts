import {Lexer} from "chevrotain"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {isIterable} from "iterare/lib/utils"
import {CodegenContext, newCodegenVisitor} from "./codegen-visitor"
import {FnBase} from "./fn-base"
import {Input, NamedVariables, SqlJsonPathStatement, ValueConfig} from "./json-path"
import {JsonPathParser} from "./parser"
import {SingletonIterator} from "./singleton-iterator"
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


export type SJPFn = ($: any, $named?: NamedVariables) => IteratorWithOperators<any>

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

    exists(input: any, namedVariables?: NamedVariables): IterableIterator<boolean> {
      return wrapIterator(input)
        .map((i) => !find(i, namedVariables).next().done)
    },

    query<T>(input: Input<T>, namedVariables?: NamedVariables): IterableIterator<T> {
      let current: T
      const tapped = tap(wrapIterator<T>(input), (v) => current = v)
      const existsIterator = this.exists(tapped, namedVariables) as IteratorWithOperators<boolean>
      return existsIterator
        .filter((e) => e)
        .map(() => current)
    },

    values<T>(input: Input<T>, config?: ValueConfig): IterableIterator<unknown> {
      const {defaultOnError, defaultOnEmpty} = config || {}
      input = wrapIterator(input)
      let result
      if (defaultOnError !== undefined) {
        // this may not to work because it won't throw errors until the iterator is pulled
        try {
          result = find(input, config?.namedVariables)
        } catch (e) {
          result = iterate(new SingletonIterator(defaultOnError))
        }
      } else {
        result = find(input, config?.namedVariables)
      }
      if (defaultOnEmpty !== undefined) {
        const first = result.next()
        result = first.done
          ? iterate(new SingletonIterator(defaultOnEmpty))
          : iterate(new SingletonIterator(first.value)).concat(result)
      }
      return result.filter((v) => v !== FnBase.EMPTY)
    }
  }
}


function wrapIterator<T>(input: any): IteratorWithOperators<T> {
  if (input instanceof IteratorWithOperators) {
    return input
  }
  if (!isIterable(input)) {
    input = new SingletonIterator(input)
  }
  return iterate(input)
}


function tap<T>(source: IteratorWithOperators<T>, callback: (value: T) => void): IteratorWithOperators<T> {
  return iterate(_tap(source, callback))
}

function* _tap<T>(source: IteratorWithOperators<T>, callback: (value: T) => void): Generator<T> {
  let next
  while (!(next = source.next()).done) {
    const {value} = next
    callback(value);
    yield value;
  }
}
