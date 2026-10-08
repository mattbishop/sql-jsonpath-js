import { expect } from "chai"
import type { TestFn } from "node:test"

import {DefaultOnErrorIterator, isIterable, isSeq, next, noValueFilter, one} from "../../src/iterators.ts"
import { type JsonbTest} from "./fsm-actions.ts"
import { compile } from "../../src/index.ts"
import {NO_VALUE} from "../../src/types"


export function parseTest(jsonb: JsonbTest): TestFn | undefined {
  const testƒ = parseStatements(jsonb)
  if (!testƒ) {
    return
  }

  return () => {
    if (jsonb.errorExpected) {
      expect(() => {
        const result = next(testƒ())
        console.warn("Expected error, but result is " + result)
      }, jsonb.statement).to.throw()
    } else {
      const results = testƒ()
      if (isIterable(results)) {
        const actual = Array.from(results)
          .filter(noValueFilter)
        expect(actual, jsonb.statement).to.deep.equal(jsonb.expectedData)
      } else {
        expect(results, jsonb.statement).to.equal(jsonb.expectedData[0])
      }
    }
  }
}


/*
Possible select terms:
        jsonb ...
        jsonb_path_query(...)
        jsonb_path_exists(...)
        jsonb_path_match(...)
        jsonb_path_query_array(...)
        jsonb_path_query_tz(...)
        jsonb_path_query_first(...)
 */
function parseStatements(testInput: JsonbTest): (() => (unknown | IteratorObject<unknown>)) | undefined {

  const {statement} = testInput
  let match = /^jsonb (.+);/.exec(statement)

  if (match) {
    return parseJsonbTest(testInput, match[1])
  }

  match = /^jsonb_path_([^(]+)(\((.*)\));$/.exec(statement)
  if (match) {
    return parse_jsonbFunctionTest(match[1], match[3])
  }
  console.error(`Unrecognized statement "${statement}"`)
}

function parseJsonbTest(testInput: JsonbTest, statement: string): (() => (boolean | IteratorObject<boolean>)) | undefined {
  // '{"a": 12}' @? '$';
  const jsonb = /'(.+)' (@.) '(.+)'/.exec(statement)

  if (jsonb) {
    const input = JSON.parse(jsonb[1])
    const src = jsonb[3]

    if (isUnsupportedStatement(src)) {
      return
    }

    console.info("parsing: ", src)
    // compile path in a function so it can throw during test execution.
    const sqlJsonPath = () => compile(src)

    // https://justatheory.com/2023/10/sql-jsonpath-operators/
    if (jsonb[2] == '@?') {
      return () => callMaybeSilently(() => sqlJsonPath().exists(input), true)
    } else {
      // @@ is same as jsonb_path_match, not part of the SQL/JSONPath spec.
      // convert to values, most of the test results are boolean.
      // Only a few expected results are null, so I changed those to the query result value.
      return () => sqlJsonPath().query(input)
    }
  }
}


function parse_jsonbFunctionTest(functionName:  string,
                                 args:          string): (() => (unknown | IteratorObject<unknown>)) | undefined {
  const [dataArg, srcArg, last1, last2] = parseSqlFunctionArgs(args)
  if (isUnsupportedStatement(srcArg)) {
    return
  }
  const silent = last1?.endsWith("true") || "true" === last2
  const input = JSON.parse(dataArg)
  const vars = parseVars(last1)

  console.info("parsing: ", srcArg)
  // compile path in a function so it can throw during test execution.
  const sqlJsonPath = () => compile(srcArg)

  switch (functionName) {
    case "exists":
      return () => callMaybeSilently<boolean>(() => sqlJsonPath().exists(input, vars), silent)

    case "query":
    case "query_tz":
      return () => callMaybeSilently(() => sqlJsonPath().query(input, vars), silent)

    case "query_array":
      return () => callMaybeSilently(() => sqlJsonPath().query(input, vars), silent)

    case "query_first":
      return () => {
          const first = callMaybeSilently(() => sqlJsonPath().query(input, vars), silent)
          return one(first)
        }

    case "match":
      return () => {
        const first = callMaybeSilently(() => sqlJsonPath().query(input, vars), silent)
        return one(first)
      }
  }
}

function parseVars(input?: string) {
  if (input === undefined || input === "NULL" || input.startsWith("silent")) {
    return
  }
  const varsStr = input.match(/(:?vars => )?(.+)/)
  const vars = JSON.parse(varsStr ? varsStr[2] : input)
  return {vars}
}

function callMaybeSilently<T>(fn: () => T | Iterator<T>, silent: boolean): T | IteratorObject<T | NO_VALUE> | NO_VALUE {
  try {
    const result = fn()
    if (isSeq(result) && silent) {
      return Iterator.from(new DefaultOnErrorIterator(NO_VALUE, result))
    }
    return result
  } catch (err) {
    if (silent) {
      return NO_VALUE
    }
    throw err
  }
}

function parseSqlFunctionArgs(args: string): string[] {
  const parsedArgs: string[] = []
  let current = ""
  let inString = false

  for (let i = 0; i < args.length; i++) {
    const char = args[i]

    if (char === "'") {
      if (inString && args[i + 1] === "'") {
        current += "'"
        i++
      } else {
        inString = !inString
      }
      continue
    }

    if (!inString && char === ",") {
      parsedArgs.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  if (current.trim()) {
    parsedArgs.push(current.trim())
  }

  return parsedArgs
}

function isUnsupportedStatement(src: string): boolean {
  if (src.includes("**")) {
    // postgres has ** (recursive search from JSONPath), which is not part of the spec.
    return true
  }

  if (src.includes("?")) {
    // Postgres chains predicates, but this is not part of the spec. Example: ($[*] > 2) ? (@ == true)
    if (/\) \? \(/.test(src)) {
      return true
    }
  } else {
    /*
      Postgres supports JSONPath filter expressions without the required '?' term. This is not part
      of the spec:

      <JSON filter expression> ::=
          <question mark> <left paren> <JSON path predicate> <right paren>
          NOTE 487 — Unlike ECMAScript Language Specification 5.1 Edition, predicates are not expressions; instead they form a
          separate language that can only be invoked within a <JSON filter expression>.
     */
    if (/==|!=|<>|<|<=|>|>=|exists/.test(src)) {
      return true
    }
  }
  return false
}
