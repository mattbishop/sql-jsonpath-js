import {one} from "./iterators.ts"
import type {SqlJsonPathStatement} from "./json-path.ts"
import {createStatement} from "./json-path-statement.ts"


export {type SqlJsonPathStatement, one}


/**
 * Parses a SQL/JsonPath string into a SqlJsonPathStatement instance for examining JSON data.
 *
 * @param text the SQL/JsonPath string statement to parse.
 */
export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}
