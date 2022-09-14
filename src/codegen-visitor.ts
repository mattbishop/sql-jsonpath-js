import {CstNode, ICstVisitor} from "@chevrotain/types"
import {IToken} from "chevrotain"
import {
  AccessExpCstChildren,
  AccessorCstChildren,
  ArrayCstChildren,
  BinaryCstChildren,
  LiteralCstChildren,
  PrimaryCstChildren,
  ScopedWffCstChildren,
  StmtCstChildren,
  SubscriptCstChildren,
  UnaryCstChildren,
  WffCstChildren
} from "./sql_jsonpath_cst"


export type CodegenContext = {
  lax:    boolean
  source: string
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
      const {Mode, wff} = node
      const mode = Mode ? Mode[0].image : "lax"
      let ctx: CodegenContext = {
        lax:    mode === "lax",
        source: ""
      }

      ctx = this.visit(wff, ctx)
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
      ctx = this.maybeAppend(NamedVariable, ctx)
      if (Last) {
        ctx.source += `this.last()`
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
      const {source: primary} = ctx
      if (ItemMethod) {
        const methodName = ItemMethod[0].payload[0]
        let methodImpl = ""
        switch (methodName) {
          case "size" :
          case "type" :
          case "double" :
          case "ceiling" :
          case "floor" :
          case "abs" :
            methodImpl = `this.${methodName}(${primary})`
            break
          case "keyvalue" :
            methodImpl = `this.keyvalue(${primary})`
            break
          default :
            throw new Error(`Item methodName unrecognized: ${methodName}`)
        }
        ctx.source = methodImpl
      } else if (DatetimeMethod) {
        let template = DatetimeMethod[0].payload[0] || ""
        if (template) {
          template = `,${template}`
        }
        ctx.source = `this.datetime(${primary}${template})`
      } else if (WildcardMember) {
        ctx.source = `this.dotStar(${primary})`
      } else if (WildcardArray) {
        ctx.source = `this.boxStar(${primary})`
      } else if (Member) {
        const member = Member[0].payload.find((m: any) => m !== undefined)
        ctx.source = `this.member(${primary},"${member}")`
      }
      ctx = this.maybeVisit(array, ctx)
      return ctx
    }

    array(node: ArrayCstChildren, ctx: CodegenContext): CodegenContext {
      const {subscript} = node
      const {source: primary} = ctx
      const subscripts = subscript
        .map((s) => this.visit(s, {...ctx, source: ""}).source)
      ctx.source = `this.array(this.push$$a(${primary}),[${subscripts}])`
      return ctx
    }

    subscript(node: SubscriptCstChildren, ctx: CodegenContext): CodegenContext {
      const {To, wff} = node
      const wff0 = this.visit(wff[0], {...ctx, source: ""})
      if (To) {
        const wff1 = this.visit(wff[1], {...ctx, source: ""})
        ctx.source = `this.range(${wff0.source},${wff1.source})`
        return ctx
      }
      return wff0
    }
  }
}
