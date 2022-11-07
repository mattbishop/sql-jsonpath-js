import {Lexer} from "chevrotain"
import {iterate} from "iterare"
import {IteratorWithOperators} from "iterare/lib/iterate"
import {isIterable} from "iterare/lib/utils"
import {newCodegenVisitor} from "./codegen-visitor"
import {EMPTY, FnBase} from "./fn-base"
import {Input, NamedVariables, SqlJsonPathStatement, ValueConfig} from "./json-path"
import {JsonPathParser} from "./parser"
import {allTokens} from "./tokens"


const jsonPathLexer = new Lexer(allTokens)
const parser = new JsonPathParser()
const codegenVisitor = newCodegenVisitor(parser.getBaseCstVisitorConstructor())


export function createStatement(text: string): SqlJsonPathStatement {
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

  const {source, lax} = codegenVisitor.visit(cst, {lax: true, source: ""})
  const fn = Function("ƒ", "$", "$$", source)
  const ƒ = new FnBase(lax)

  const find = ($: any, $named: NamedVariables = {}): any => {
    const $$ = (name: string): any => {
      if ($named.hasOwnProperty(name)) {
        return $named[name]
      }
      throw new Error(`no variable named '${name}'`)
    }
    const result = fn(ƒ, $, $$)
    return result instanceof IteratorWithOperators
      ? result
      : iterate([result])
  }
  return {
    source: text,

    mode: lax ? "lax" : "strict",

    exists(input: any, namedVariables?: NamedVariables): Iterator<boolean> {
      return wrapIterator(input)
        .map((i) => find(i, namedVariables) !== EMPTY)
    },

    query<T>(input: Input<T>, namedVariables?: NamedVariables): Iterator<T> {
      let current: T
      const tapped = tap(wrapIterator<T>(input), (v) => current = v)
      const existsIterator = this.exists(tapped, namedVariables) as IteratorWithOperators<boolean>
      return existsIterator
        .filter((e) => e)
        .map(() => current)
    },

    value<T>(input: Input<T>, config?: ValueConfig): Iterator<unknown> {
      const {defaultOnError, defaultOnEmpty} = config || {}
      let result
      if (defaultOnError !== undefined) {
        // this may not to work because it won't throw errors until the iterator is pulled
        try {
          result = find(input, config?.namedVariables)
        } catch (e) {
          return iterate([defaultOnError])
        }
      } else {
        result = find(input, config?.namedVariables)
      }
      if (result === EMPTY && defaultOnEmpty !== undefined) {
        return iterate([defaultOnEmpty])
      }
      return result.filter((v: any) => v !== EMPTY)
    }
  }
}


function wrapIterator<T>(input: any): IteratorWithOperators<T> {
  if (input instanceof IteratorWithOperators) {
    return input
  }
  if (!isIterable(input)) {
    input = [input]
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
