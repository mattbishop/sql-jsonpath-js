import {CstNode, ICstVisitor} from "@chevrotain/types"
import {IToken} from "chevrotain"
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
        source: "yield "
      }

      ctx = this.visit(node.wff, ctx)
      ctx.source = `return function* ($, $$) { ${ctx.source} }`
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

      ctx = this.visit(primary, ctx)
      return this.maybeVisit(accessor, ctx)
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
      // this is where mode starts mattering
      return ctx
    }
  }
}
