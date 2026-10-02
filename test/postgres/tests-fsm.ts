import {t, StateMachine, type ITransition, type Callback, SyncStateMachine} from "typescript-fsm"

/*
First rows: the test case (can be multiline)
    select
        jsonb ...
        jsonb_path_query(...)
        jsonb_path_exists(...)
        jsonb_path_match(...)
        jsonb_path_query_array(...)
        jsonb_path_query_tz(...)
        jsonb_path_query_first(...)

then:
    ERROR: ...
    HINT: (optional) ...

or:
    WARNING: (optional) ...
      ?column? or method name (like jsonb_path_query)
    ----------------------------- (more than 2 dashes ;P )
    values... (or none for empty)
    (x rows)
    _empty row_

 Any row:
   -- comment text, ignore
 */



export enum States {
  start = "start",
  set = "set",
  selected = "selected",
  continued = "continued",
  errored = "errored",
//  errorInfoed = "errorInfoed",
  //warned,
  //columned,
  //dashed,
  dataRead = "dataRead",
  rowed = "rowed",
}

export enum Events {
  set = "set",
  select = "select",
  continue = "continue",
  error = "error",
//  errorInfo = "errorInfo",
//  warning,
//  column,
//  dashes,
  data = "data",
  rows = "rows"
}


const commentPattern = /^-- .+/
const setPattern = /^set (.+);/i
const selectPattern = /^select (?:\* from )?(.+)(;)?( -- (.+))?/i
const continueSelectPattern = /^\t(.+)(;)?( -- (.+))?/
const errorPattern = /^((ERROR|HINT|DETAIL|LINE \d): (.+)| +\^)/
const warningPattern = /^WARNING: (.+)/
const columnPattern = /^ +(\?column\?|jsonb_(.+))/
const dataPattern = /^ (.+)|^$/
const dashesPattern = /^---+/
const rowsPattern = /^\((\d+) rows?\)/


/*
  Need a generated test interface to execute. Thinking it generates test functions and expectations,
  then runs them in a list.
 */

export function createTester(actions: TransitionActions): (line: string) => void {

  const testMachine: SyncStateMachine<States, Events> = new SyncStateMachine(States.start)
  testMachine.addTransitions(buildTransitions(actions))
  console.info(testMachine.toMermaid("tests"))

  return (line) => lineToTransition(testMachine, line)
}

function lineToTransition(machine: SyncStateMachine<States, Events>, line: string) {
  if (line === "") {
    return
  }

  let match = commentPattern.exec(line)
  if (match) {
    return
  }

  if (match = setPattern.exec(line)) {
    return machine.syncDispatch(Events.set, match[1])
  }

  if (match = selectPattern.exec(line)) {
    return machine.syncDispatch(Events.select, match[1])
  }

  if (match = continueSelectPattern.exec(line)) {
    return machine.syncDispatch(Events.continue, match[1])
  }
  if (match = errorPattern.exec(line)) {
    return machine.syncDispatch(Events.error, match[0])
  }
  if (warningPattern.exec(line)) {
    return
  }
  if (columnPattern.exec(line)) {
    return
  }
  if (dashesPattern.exec(line)) {
    return
  }
  if (match = rowsPattern.exec(line)) {
    return machine.syncDispatch(Events.rows, match[1])
  }
  if (match = dataPattern.exec(line)) {
    return machine.syncDispatch(Events.data, match[1])
  }

  throw new Error(`No match for line: ${line}`)
}

export interface TransitionActions {
  onSet: Callback
  onSelect: Callback
  onContinue: Callback
  onError: Callback
  onData: Callback
  onRows: Callback
}


function buildTransitions(actions: TransitionActions): ITransition<States, Events, Callback>[] {
  return [
    /* fromState            event             toState               callback */
    t(States.start,         Events.set,       States.set,           actions.onSet),
    t(States.start,         Events.select,    States.selected,      actions.onSelect),
    t(States.set,           Events.select,    States.selected,      actions.onSelect),
    t(States.selected,      Events.continue,  States.continued,     actions.onContinue),
    t(States.continued,     Events.continue,  States.continued,     actions.onContinue),
    // error transitions
    t(States.continued,     Events.error,     States.errored,       actions.onError),
    t(States.selected,      Events.error,     States.errored,       actions.onError),
    t(States.errored,       Events.error,     States.errored,       actions.onError),
    t(States.errored,       Events.set,       States.set,           actions.onSet),
    t(States.errored,       Events.select,    States.selected,      actions.onSelect),
    // result transitions
    t(States.selected,      Events.data,      States.dataRead,      actions.onData),
    t(States.continued,     Events.data,      States.dataRead,      actions.onData),
    t(States.selected,      Events.rows,      States.rowed,         actions.onRows),
    t(States.continued,     Events.rows,      States.rowed,         actions.onRows),
    t(States.dataRead,      Events.data,      States.dataRead,      actions.onData),
    t(States.dataRead,      Events.rows,      States.rowed,         actions.onRows),
    t(States.rowed,         Events.set,       States.set,           actions.onSet),
    t(States.rowed,         Events.select,    States.selected,      actions.onSelect),
  ]
}

/*
  Ask the machine for the current state.

  switch machine.curentState:

    case start:
      look at like and determine is it setTimezone, select, or comment? That's your event
    case selected:
      parse select statement
      what about multiline?



  Initial state fed line from input and switches to next state.
  The actions process the line data
 */
