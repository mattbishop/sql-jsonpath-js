import {type TransitionActions} from "./tests-fsm.ts"
import {NO_VALUE} from "../../src/types"


export interface JsonbTest {
  errorExpected: boolean
  setup?: Function
  statement: string
  cleanup?: Function
  test: Function
  expectedData: any[]
}


interface TestsBuilder extends TransitionActions {
  tests: JsonbTest[]
}

export function createTestsBuilder(): TestsBuilder {

  // TransitionActions needs to emit the tests somehow
  const tests: JsonbTest[] = []
  let current: JsonbTest

  function startNewTest() {
    current = {
      errorExpected: false,
      statement: "",
      test: () => console.error("no test"),
      expectedData: []
    }
    tests.push(current)
  }

  function onSet(args: unknown) {
    // set is always the first state, so don't test
    startNewTest()
    // todo change setup and cleanup functions to do whatever 'set' has in mind
  }

  function onSelect(args: unknown) {
    if (!current || !current.setup) {
      startNewTest()
    }
    current.statement = args as string
  }

  function onContinue(args: unknown) {
    console.info("onContinue: ", args)
    current.statement += args
  }

  function onError(args: unknown) {
    current.errorExpected = true
    startNewTest()
  }

  function onData(args: unknown) {
    let data
    if (args === "t") {
      data = true
    } else if (args === "f") {
      data = false
    } else if (args === "") {
      data = NO_VALUE
    } else {
      data = JSON.parse(args as string)
    }
    if (data !== undefined) {
      current.expectedData.push(data)
    }
  }

  function onRows(args: unknown) {
    // check for empty expected data and push null
    if (current.expectedData.length === 0) {
      if (args === "1") {
        current.expectedData.push(NO_VALUE)
      }
    }
    startNewTest()
  }

  return {
    onSet,
    onSelect,
    onContinue,
    onError,
    onData,
    onRows,
    tests
  }
}



