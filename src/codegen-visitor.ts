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
      if (accessor) {
        // This only works because the visitors mutate ctx.
        accessor.forEach((a) => this.visit(a, ctx))
      }
        /*
        I don't like this ctx.source route, too imprecise.

          $.phones.type    phones is an array member, type is a field.
          this.member($, "phones") -> seq(phone)
          this.member(phones, "type")

          accessors is a list of two items, so we know how many there are.
          Two choices:

          * this.member(this.member($, "phones"), "type")
          * this.member($, "phones").map(m=>this.member(m,"type")

          First one is probably more efficient as it doesn't map(), but will get harder to read with multiple
          items. Second one is clearer but may be harder to trigger the strict error?
         */
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
        ctx.source += `ƒ.last()`
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
          case "keyvalue" :
            methodImpl = `ƒ.${methodName}(${primary})`
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
        ctx.source = `ƒ.datetime(${primary}${template})`
      } else if (WildcardMember) {
        ctx.source = `ƒ.dotStar(${primary})`
      } else if (WildcardArray) {
        ctx.source = `ƒ.boxStar(${primary})`
      } else if (Member) {
        const payloads = Member[0].payload
        const member = payloads[0] || payloads[1]
        ctx.source = `ƒ.member(${primary},"${member}")`
      }
      ctx = this.maybeVisit(array, ctx)
      return ctx
    }

    array(node: ArrayCstChildren, ctx: CodegenContext): CodegenContext {
      const {subscript} = node
      const {source: primary} = ctx
      const subscripts = subscript
        .map((s) => this.visit(s, {...ctx, source: ""}).source)
      ctx.source = `ƒ.array(ƒ.pa(${primary}),[${subscripts}])`
      return ctx
    }

    subscript(node: SubscriptCstChildren, ctx: CodegenContext): CodegenContext {
      const {To, wff} = node
      const wff0 = this.visit(wff[0], {...ctx, source: ""})
      if (To) {
        const wff1 = this.visit(wff[1], {...ctx, source: ""})
        ctx.source = `ƒ.range(${wff0.source},${wff1.source})`
        return ctx
      }
      return wff0
    }
  }
}
