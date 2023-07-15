import {SqlJsonPathStatement} from "./json-path"
import {createStatement} from "./json-path-statement.js"
import {one} from "./iterators.js"


export {SqlJsonPathStatement, one}


export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}
