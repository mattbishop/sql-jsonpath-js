import * as fs from "node:fs"
import {it} from "node:test"

import {createTester} from "./tests-fsm.ts"
import {parseTest} from "./test-parser.ts"
import {createTestsBuilder} from "./fsm-actions.ts"

/*
  Parses and runs the postgres test sql/jsonpath test suite found here:

  https://github.com/postgres/postgres/blob/master/src/test/regress/expected/jsonb_jsonpath.out
 */
const testFile = fs.readFileSync("./test/postgres/jsonpaths.txt", "utf8")
const testLines = testFile.split(/\r?\n/)
const testsBuilder = createTestsBuilder()
const testMachine = createTester(testsBuilder)

for (const line of testLines) {
  testMachine(line)
}

testsBuilder.tests
  .filter(test => test.statement !== "")
  .forEach((test) => {
  const testƒ = parseTest(test)
  if (test.statement) {
    it(`Postgres project tests: ${test.statement}`, testƒ)
  }
})
