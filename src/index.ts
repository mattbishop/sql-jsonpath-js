import { SqlJsonPathStatement } from "./json-path.ts"
import { createStatement } from "./json-path-statement.ts"
import { one } from "./iterators.ts"


export {SqlJsonPathStatement, one}


export function compile(text: string): SqlJsonPathStatement {
  return createStatement(text)
}
