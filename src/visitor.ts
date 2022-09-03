import {CstNode, ICstVisitor} from "@chevrotain/types"
import {
  ArrayElement,
  ConditionalOperator,
  Exists,
  FilterExpression,
  FilterQuery,
  Group,
  MethodName,
  Mode,
  OperaX,
  PathPart,
  PathQuery,
  SqlJsonPathStatement,
  WFF
} from "./json-path"


export function newJsonPathVisitor(constr: { new(...args: any[]): ICstVisitor<any, any> }) {
  return new class JsonPathVisitor extends constr {
    constructor() {
      super()
      // this.validateVisitor()
    }

    jsonPathStatement(ctx: any): SqlJsonPathStatement {
      const obj: SqlJsonPathStatement = {}

      if (ctx.mode) {
        obj.mode = this.visit(ctx.mode)
      } else {
        obj.mode = "lax"
      }

      if (ctx.lhs) {
        obj.lhs = this.visit(ctx.lhs)
      }

      if (ctx.filterExpression) {
        obj.filter = this.visit(ctx.filterExpression)
      }

      return obj
    }

    mode(ctx: any): Mode {
      return ctx.strict
        ? "strict"
        : "lax"
    }

    arguments(ctx: any): string[] {
      return ctx.args
        ? ctx.args.map((arg: any) => arg.image)
        : []
    }

    contextQuery(ctx: any): PathQuery {
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

    conditionalOperator(ctx: any): ConditionalOperator {
      const operator = ctx.operator[0].image

      return operator === "<>"
        ? ConditionalOperator.NE
        : operator
    }

    pathPart(ctx: any): PathPart {
      if (ctx.arguments) {
        return {
          method: this.methodNameToEnum(ctx.name[0].image),
          arguments: this.visit(ctx.arguments)
        }
      }

      if (ctx.arrayAccessor) {
        return this.visit(ctx.arrayAccessor, ctx.name[0].image)
      }

      return {
        property: ctx.name[0].image
      }
    }

    group(ctx: any): Group {
      return this.visit(ctx.wff)
    }

    op(ctx: any): OperaX {
      return {
        connector : ctx.connector[0].image,

        rhs : ctx.rhs_group? this.visit(ctx.rhs_group)
        : ctx.rhs_last ? ctx.rhs_last[0].image
          : parseInt(ctx.rhs_integer[0].image)
      }
    }


    wff(ctx: any): WFF {
      const o: any = {}

      o.lhs = ctx.lhs_group ? this.visit(ctx.lhs_group)
          : ctx.lhs_last ? ctx.lhs_last[0].image
          : parseInt(ctx.lhs_integer[0].image)

      if (ctx.ops) {
        o.ops = ctx.ops.map((op:any) => this.visit(op))
      }

      return o as WFF
    }

    arrayAccessor(ctx: any, name: string): ArrayElement {
      const o: Partial<ArrayElement> = { array: name }

      if (ctx.wildcard) {
        o.element = ctx.wildcard[0].image
      } else {
        o.element = ctx.wff.map((wff: any) => this.visit(wff))
      }

      return o as ArrayElement
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
