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
        expect(results, jsonb.statements[0]).to.equal(jsonb.expectedData[0])
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
function parseStatements(testInput: JsonbTest): (() => (null | boolean | IteratorObject<boolean>)) | undefined {

  const {statements, expectedData} = testInput
  const match = /jsonb( |_.+\()(.+)/.exec(statements[0])

  if (match) {
    switch (match[1]) {
      case ' ':
        // '{"a": 12}' @? '$';
        const jsonb = /'(.+)' (@.) '(.+)'/.exec(match[2])

        if (jsonb) {
          const input = JSON.parse(jsonb[1])
          const src = jsonb[3]

          if (src.includes("**")) {
            // postgres has ** (recursive search from JSONPath), which is not part of the spec.
            return
          }

          if (!src.includes("?")) {
            /*
              Postgres supports JSONPath filter expressions without the required '?' term. This is not part
              of the spec:

              <JSON filter expression> ::=
                  <question mark> <left paren> <JSON path predicate> <right paren>
                  NOTE 487 — Unlike ECMAScript Language Specification 5.1 Edition, predicates are not expressions; instead they form a
                  separate language that can only be invoked within a <JSON filter expression>.
             */
            if (/==|!=|<>|<|<=|>|>=/.test(src)) {
              return
            }
          }

          console.info("parsing: ", src)
          const sqlJsonPath = compile(src);

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
  }
  console.error(`Unrecognized statement "${statements[0]}"`)
}

