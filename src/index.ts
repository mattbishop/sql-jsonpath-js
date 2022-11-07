import {createStatement} from "./json-path-statement"
import {SqlJsonPathStatement} from "./json-path"


export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}
