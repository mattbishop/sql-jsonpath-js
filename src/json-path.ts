export interface SqlJsonPath {
  statement: SqlJsonPathStatement

  exists: () => boolean
  match: () => boolean
  query: () => any[]
  first: () => any
}

export type PathPart = SimpleProperty | ArrayElement | Method
export type PathQuery = PathPart[]

export interface SqlJsonPathStatement {
  lhs?: PathQuery | number
  operation?: Operation
}

export interface Operation {
  operator: SqlJsonPathArithmeticOperator
  operand: PathQuery | number
}

export interface Method {
    method: MethodName
    arguments: string[]
}

export enum MethodName {
  TYPE = "type", SIZE = "size", DOUBLE = "double", CEILING = "ceiling", FLOOR = "floor", ABS = "abs", DATETIME = "datetime", KEYVALUE = "keyvalue"
}

export interface ArrayElement {
  array: string
  element: "*" | number
  filterChain?: FilterExpression[]
}

export interface SimpleProperty {
  property: string
  filterChain?: FilterExpression[]
}

export interface FilterExpression {
  isNot?: boolean
  query: Exists | FilterQuery
}

export interface FilterQuery {
  path: PathQuery
  operator?: ConditionalOperator
  compareTo?: number | string
}

export interface Exists {
  method: "exists",
  path: PathQuery
}

export enum SqlJsonPathArithmeticOperator {
  ADD= "+", SUB = "-", DIV = "/", MULT = "*", MOD = "*"
}

export enum ConditionalOperator {
  EQ = "==", NE = "!=", GT = ">", LT = "<", AND = "&&", OR = "||", GTE = ">=", LTE = "<="
}
