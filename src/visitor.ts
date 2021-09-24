import {CstNode, ICstVisitor} from "@chevrotain/types";
import {
  ArrayElement,
  ConditionalOperator,
  Exists,
  FilterExpression,
  FilterQuery,
  MethodName,
  PathPart,
  PathQuery,
  SimpleProperty,
  SqlJsonPathArithmeticOperator,
  SqlJsonPathStatement
} from "./json-path";

export function newJsonPathVisitor(constr: { new(...args: any[]): ICstVisitor<any, any> }) {
  return new class JsonPathVisitor extends constr {
    constructor() {
      super()
      this.validateVisitor()
    }

    jsonPathStatement(ctx: any): SqlJsonPathStatement {
      const obj: SqlJsonPathStatement = {}

      if (ctx.lhs) {
        obj.lhs = this.visit(ctx.lhs)
      }

      if (ctx.rhs && ctx.operator) {
        obj.operation = {
          operator: this.visit(ctx.operator),
          operand: this.visit(ctx.rhs)
        }
      }

      return obj
    }

    operand(ctx: any): PathQuery | number {
      return (ctx.path)
        ? this.visit(ctx.path)
        : ctx.number
    }

    arguments(ctx: any): string[] {
      return ctx.args
        ? ctx.args.map((arg: any) => arg.image)
        : []
    }

    rootQuery(ctx: any): PathQuery {
      return this.visit(ctx.path)
    }

    pathQuery(ctx: any): PathQuery {
      return ctx.pathParts.map((pathPart: CstNode) => this.visit(pathPart))
    }

    filterExpression(ctx: any): FilterExpression {
      const filter: FilterExpression = {
        query: this.visit(ctx.query)
      }

      if (ctx.isNot) {
        filter.isNot = !!ctx.NotOperator
      }

      return filter
    }

    filterQuery(ctx: any): FilterQuery {
      let query = this.visit(ctx.query)
      if (ctx.operator) {
        query = {
          ...query,
          operator: this.visit(ctx.operator),
          compareTo: ctx.stringLiteral ? ctx.stringLiteral[0].image : parseInt(ctx.number[0].image)
        }
      }

      return query
    }

    existsPathQuery(ctx: any): FilterQuery {
      return {
        path: ctx.pathQuery ? this.visit(ctx.pathQuery) : [],
      }
    }

    existsQuery(ctx: any): Exists {
      return {
        method: "exists",
        ...this.visit(ctx.query)
      }
    }

    booleanOperator(ctx: any): ConditionalOperator {
      switch (ctx.operator[0].image) {
        case "&&":
          return ConditionalOperator.AND
        case "||":
          return ConditionalOperator.OR
        case ">":
          return ConditionalOperator.GT
        case "<":
          return ConditionalOperator.LT
        case ">=":
          return ConditionalOperator.GTE
        case "<=":
          return ConditionalOperator.LTE
        case "!=":
        case "<>":
          return ConditionalOperator.NE
        default:
          throw Error("Unknown conditional operator: " + ctx.operator[0].image)
      }
    }

    arithmeticOperator(ctx: any): SqlJsonPathArithmeticOperator {
      switch (ctx.operator) {
        case "+":
          return SqlJsonPathArithmeticOperator.ADD
        case "-":
          return SqlJsonPathArithmeticOperator.SUB
        case "*":
          return SqlJsonPathArithmeticOperator.MULT
        case "/":
          return SqlJsonPathArithmeticOperator.DIV
        case "%":
          return SqlJsonPathArithmeticOperator.MOD
        default:
          throw new Error("Unknown operator type: " + ctx.operator)
      }
    }

    pathPart(ctx: any): PathPart {
      if (ctx.arguments) {
        if (ctx.filterExpression) {
          throw new Error("Filter expressions cannot follow method calls")
        }
        return {
          method: this.methodNameToEnum(ctx.name[0].image),
          arguments: this.visit(ctx.arguments)
        }
      }

      let pathPart: PathPart

      if (ctx.arrayAccessor) {
        pathPart = this.visit(ctx.arrayAccessor, ctx.name[0].image)
      } else {
        pathPart = {
          property: ctx.name[0].image
        }
      }

      if (ctx.filterChain) {
        (pathPart as SimpleProperty).filterChain = this.visit(ctx.filterChain)
      }

      return pathPart
    }

    filterChain(ctx: any): FilterExpression[] {
      return ctx.filterExpressions.map((filterExpression: CstNode) => this.visit(filterExpression))
    }

    arrayAccessor(ctx: any, name: string): ArrayElement {
      return {
        array: name,
        element: (ctx.wildcard) ? ctx.wildcard[0].image : parseInt(ctx.number[0].image)
      }
    }


    methodNameToEnum(name: string): MethodName {
      switch (name) {
        case "type":
          return MethodName.TYPE
        case "size":
          return MethodName.SIZE
        case "double":
          return MethodName.DOUBLE
        case "ceiling":
          return MethodName.CEILING
        case "floor":
          return MethodName.FLOOR
        case "abs":
          return MethodName.ABS
        case "datetime":
          return MethodName.DATETIME
        case "keyvalue":
          return MethodName.KEYVALUE
        default:
          throw Error(`Unknown method: ${name}`)
      }
    }
  }
}