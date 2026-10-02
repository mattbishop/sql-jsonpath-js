import { expect } from "chai"
import type { TestFn } from "node:test"

import { isIterable } from "../../src/iterators.ts"
import { type JsonbTest} from "./fsm-actions.ts"
import { compile } from "../../src/index.ts"


export function parseTest(jsonb: JsonbTest): TestFn {
  const testƒ = parseStatements(jsonb)
  if (!testƒ) {
    return () => undefined
  }

  return () => {
    if (jsonb.errorExpected) {
      expect(testƒ).to.throw()
    } else {
      const results = testƒ()
      if (isIterable(results)) {
        const actual = Array.from(results)
        expect(actual).to.deep.equal(jsonb.expectedData)
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

  match = /^jsonb_path_([^\(]+)(\((.*)\));$/.exec(statement)
  if (match) {
    return parse_jsonbFunctionTest(testInput, match[1], match[3])
  }
  console.error(`Unrecognized statement "${statement}"`)
}

function parseJsonbTest(testInput: JsonbTest, statement: string): (() => (null | boolean | IteratorObject<boolean>)) | undefined {
  const {expectedData} = testInput

  // '{"a": 12}' @? '$';
  const jsonb = /'(.+)' (@.) '(.+)'/.exec(statement)

  if (jsonb) {
    const input = JSON.parse(jsonb[1])
    const src = jsonb[3]

    if (isUnsupportedStatement(src)) {
      return
    }

    console.info("parsing: ", src)
    const sqlJsonPath = compile(src)

    // https://justatheory.com/2023/10/sql-jsonpath-operators/
    if (jsonb[2] == '@?') {
      //convert to booleans
      testInput.expectedData = expectedData.map((item) => {
        if (item === "t") {
          return true
        }
        if (item === "f") {
          return false
        }
        return null
      })
      return () => {
        try {
          return sqlJsonPath.exists(input)
        } catch (err) {
          return null
        }
      }
    } else {
      // @@ is same as jsonb_path_match, not part of the SQL/JSONPath spec.
      // convert to values, most of the test results are boolean.
      // Only a few expected results are null, so I changed those to the query result value.
      testInput.expectedData = expectedData.map((item) => JSON.parse(item))
      return () => sqlJsonPath.query(input)
    }
  }
}
function parse_jsonbFunctionTest(testInput:     JsonbTest,
                                 functionName:  string,
                                 args:          string): (() => (unknown | IteratorObject<unknown>)) | undefined {
  const {expectedData} = testInput
  const parsedArgs = parseSqlFunctionArgs(args)

  if (parsedArgs.length < 2) {
    return
  }

  const input = JSON.parse(parsedArgs[0])
  const src = parsedArgs[1]

  if (isUnsupportedStatement(src)) {
    return
  }

  console.info("parsing: ", src)
  // compile path in a function so it can throw during test execution.
  const sqlJsonPath = () => compile(src)

  switch (functionName) {
    case "exists":
      testInput.expectedData = expectedData.map(postgresBoolean)
      return () => {
        try {
          return sqlJsonPath().exists(input)
        } catch (err) {
          return null
        }
      }

    case "query":
    case "query_tz":
      testInput.expectedData = expectedData.map((item) => JSON.parse(item))
      return () => sqlJsonPath().query(input)

    case "query_array":
      testInput.expectedData = expectedData.map((item) => JSON.parse(item))
      return () => [Array.from(sqlJsonPath().query(input))][Symbol.iterator]()

    case "query_first":
      testInput.expectedData = expectedData.map((item) => item === null ? null : JSON.parse(item))
      return () => {
        const first = sqlJsonPath().query(input).next()
        return first.done ? null : first.value
      }

    case "match":
      testInput.expectedData = expectedData.map(postgresBoolean)
      return () => {
        const first = sqlJsonPath().query(input).next()
        return first.done ? null : first.value
      }
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

function postgresBoolean(item: unknown): boolean | null {
  if (item === "t") {
    return true
  }
  if (item === "f") {
    return false
  }
  return null
}
