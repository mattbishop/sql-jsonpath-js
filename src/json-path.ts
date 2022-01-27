export interface QueryConfig {
  arrayWrapper: "always" | "onlyScalars"
  defaultIfUndefined: "object" | "array"
}

export interface SqlJsonPath {
  statement: SqlJsonPathStatement

  exists: () => boolean | undefined
  value: (defaultValue?: any) => any | undefined
  query: (config?: QueryConfig) => any
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
  ABS       = "abs",
  CEILING   = "ceiling",
  DATETIME  = "datetime",
  DOUBLE    = "double",
  FLOOR     = "floor",
  KEYVALUE  = "keyvalue",
  SIZE      = "size",
  TYPE      = "type",
}

export enum SqlJsonPathArithmeticOperator {
  ADD = "+",
  SUB = "-",
  MUL = "*",
  DIV = "/",
  MOD = "%"
}

export enum ConditionalOperator {
  EQ  = "==",
  NE  = "!=",
  GT  = ">",
  LT  = "<",
  AND = "&&",
  OR  = "||",
  GTE = ">=",
  LTE = "<="
}

export interface ArrayElement {
  array: string
  element: "*" | WFF[]
  filterChain?: FilterExpression[]
}

export interface OperaX {
  connector: SqlJsonPathArithmeticOperator | string
  rhs: Group | number | "last"
}

export interface WFF {
  lhs: Group | number | "last"
  ops?: OperaX[]

}

export type Group = WFF

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
