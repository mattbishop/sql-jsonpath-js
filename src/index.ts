import {createStatement} from "./json-path-statement.js"
import {SqlJsonPathStatement} from "./json-path"

export {SqlJsonPathStatement}


export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}

