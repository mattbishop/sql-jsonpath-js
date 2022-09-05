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

export type KeyValue = {
  id:     number
  key:    string
  value:  unknown
}


export type Mode = "strict" | "lax"
export type PathPart = Property | ArrayElement | Method
export type PathQuery = PathPart[]

export interface SqlJsonPathStatement {
  mode?: Mode
  lhs?: PathQuery | number
  filter?: FilterExpression
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

export interface Property {
  property: string
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
