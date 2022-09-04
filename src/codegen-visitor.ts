import {CstNode, ICstVisitor} from "@chevrotain/types"
import {IToken} from "chevrotain"
import {DateTime, FixedOffsetZone} from "luxon"
import {
  AccessExpCstChildren,
  AccessorCstChildren,
  BinaryCstChildren,
  LiteralCstChildren,
  PrimaryCstChildren,
  ScopedWffCstChildren,
  StmtCstChildren,
  UnaryCstChildren,
  WffCstChildren
} from "./sql_jsonpath_cst"


export type CodegenContext = {
  lax:    boolean
  source: string
}

type KeyValue = {
  id:     number
  key:    string
  value:  unknown
}

export const itemMethodFns = {
  type(primary: any): string {
    return Array.isArray(primary) ? "array" : typeof primary
  },

  size(primary: any): number {
    return Array.isArray(primary) ? primary.length : 1
  },

  double(primary: any): number {
    if (typeof primary !== "number" && typeof primary !== "string") {
      throw new Error(`double() value must be a number or string, found ${JSON.stringify(primary)}.`)
    }
    const n = Number(primary)
    if (Number.isNaN(n)) {
      throw new Error(`double() param ${primary} is not a representation of a number.`)
    }
    return n
  },

  ceiling(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`$ceiling() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.ceil(primary)
  },

  floor(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`floor() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.floor(primary)
  },

  abs(primary: any): number {
    if (typeof primary !== "number") {
      throw new Error(`abs() param must be a number, found ${JSON.stringify(primary)}.`)
    }
    return Math.abs(primary)
  },

  keyvalue(primary: any, lax: boolean): KeyValue[] {
    if (typeof primary !== "object") {
      throw new Error(`keyvalue() param must be an object or array of objects (only in lax mode), found ${JSON.stringify(primary)}.`)
    }
    if (Array.isArray(primary)) {
      if (!lax) {
        throw new Error(`keyvalue() param must be an object but is an array (in strict mode), found ${JSON.stringify(primary)}.`)
      }
      return primary.reduce((acc, row, id) => {
        acc.push(...this._toKV(row, id))
        return acc
      }, [] as KeyValue[])
    }
    return this._toKV(primary, 0)
  },

  _toKV(primary: object, id: number): KeyValue[] {
    return Object.entries(primary).map(([key, value]) => ({id, key, value}))
  },

  datetime(primary: any, template?: string): Date {
    if (typeof primary !== "string") {
      throw new Error(`datetime() param must be a string, found ${JSON.stringify(primary)}.`)
    }
    return template
      ? DateTime.fromFormat(primary, template, {zone: FixedOffsetZone.utcInstance}).toJSDate()
      : new Date(primary)
  }
}


/**
 * Construct a new Visitor that generates a JS function to execute the JsonPath query.
 *
 * @param constr the value from <code>parser.getBaseCstVisitorConstructor()</code>
 */
export function newCodegenVisitor(constr: { new(...args: any[]): ICstVisitor<any, CodegenContext> }) {
  return new class CodegenVisitor extends constr {
    constructor() {
      super()
      // this.validateVisitor()
    }

    maybeVisit(node: CstNode | CstNode[] | undefined, ctx: CodegenContext): CodegenContext {
      return node ? this.visit(node, ctx) : ctx
    }

    maybeAppend(token: IToken[] | undefined, ctx: CodegenContext): CodegenContext {
      if (token) {
        ctx.source += token[0].image
      }
      return ctx
    }


    stmt(node: StmtCstChildren): CodegenContext {
      console.info(`stmt: ${JSON.stringify(node)}`)
      const {Mode} = node
      const mode = Mode ? Mode[0].image : "lax"
      let ctx: CodegenContext = {
        lax:    mode === "lax",
        source: ""
      }

      ctx = this.visit(node.wff, ctx)
      ctx.source = `return ${ctx.source}`
      return ctx
    }

    wff(node: WffCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, UnaryOp, right} = node

      ctx = this.visit(left, ctx)
      ctx = this.maybeAppend(UnaryOp, ctx)
      return this.maybeVisit(right, ctx)
    }

    binary(node: BinaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, BinaryOp, right} = node

      ctx = this.visit(left, ctx)
      ctx = this.maybeAppend(BinaryOp, ctx)
      return this.maybeVisit(right, ctx)
    }

    unary(node: UnaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {unary, UnaryOp, accessExp} = node

      ctx = this.maybeVisit(unary, ctx)
      ctx = this.maybeAppend(UnaryOp, ctx)
      return this.maybeVisit(accessExp, ctx)
    }

    accessExp(node: AccessExpCstChildren, ctx: CodegenContext): CodegenContext {
      const {primary, accessor} = node

      const origSource = ctx.source
      ctx.source = ""
      ctx = this.visit(primary, ctx)
      ctx = this.maybeVisit(accessor, ctx)
      ctx.source = origSource + ctx.source
      return ctx
    }

    primary(node: PrimaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {scopedWff, literal, ContextVariable, FilterValue, Last, NamedVariable} = node
      // will be just one of these so the order doesn't really matter
      ctx = this.maybeVisit(scopedWff, ctx)
      ctx = this.maybeVisit(literal, ctx)
      ctx = this.maybeAppend(ContextVariable, ctx)
      ctx = this.maybeAppend(Last, ctx)
      ctx = this.maybeAppend(NamedVariable, ctx)
      if (FilterValue) {
        ctx.source += "$$"
      }
      return ctx
    }

    scopedWff(node: ScopedWffCstChildren, ctx: CodegenContext): CodegenContext {
      const {wff} = node

      ctx.source += "("
      ctx = this.visit(wff, ctx)
      ctx.source += ")"
      return ctx
    }

    literal(node: LiteralCstChildren, ctx: CodegenContext): CodegenContext {
      const {Boolean, Null, Number, String} = node
      // will be just one of these so the order doesn't really matter
      ctx = this.maybeAppend(Boolean, ctx)
      ctx = this.maybeAppend(Null, ctx)
      ctx = this.maybeAppend(Number, ctx)
      return this.maybeAppend(String, ctx)
    }

    accessor(node: AccessorCstChildren, ctx: CodegenContext): CodegenContext {
      const {array, filter, DatetimeMethod, ItemMethod, Member, WildcardArray, WildcardMember} = node
      const primary = ctx.source
      if (ItemMethod) {
        const methodName = ItemMethod[0].payload
        let methodImpl = ""
        switch (methodName) {
          case "size" :
            methodImpl = `this.size(${primary})`
            break
          case "type" :
            methodImpl = `this.type(${primary})`
            break
          case "double" :
            methodImpl = `this.double(${primary})`
            break
          case "ceiling" :
            methodImpl = `this.ceiling(${primary})`
            break
          case "floor" :
            methodImpl = `this.floor(${primary})`
            break
          case "abs" :
            methodImpl = `this.abs(${primary})`
            break
          case "keyvalue" :
            methodImpl = `this.keyvalue(${primary},${ctx.lax})`
            break
          default :
            throw new Error(`Item methodName unrecognized: ${methodName}`)
        }
        ctx.source = methodImpl
      } else if (DatetimeMethod) {
        let template = DatetimeMethod[0].payload || ""
        if (template) {
          template = "," + template
        }
        ctx.source = `this.datetime(${primary}${template})`
      }
      return ctx
    }
  }
}
