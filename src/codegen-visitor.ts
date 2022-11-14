import {CstNode, ICstVisitor} from "@chevrotain/types"
import {IToken} from "chevrotain"
import {
  AccessExpCstChildren,
  AccessorCstChildren,
  ArrayCstChildren,
  BinaryCstChildren,
  BoolConjCstChildren,
  ComparisonCstChildren,
  DelPredCstChildren,
  ExistsCstChildren,
  FilterCstChildren,
  LikeRegexCstChildren,
  LiteralCstChildren,
  NegCstChildren,
  PathPredCstChildren,
  PredCstChildren,
  PrimaryCstChildren,
  ScopedPredCstChildren,
  ScopedWffCstChildren,
  StartsWithCstChildren,
  StmtCstChildren,
  SubscriptCstChildren,
  UnaryCstChildren,
  WffCstChildren
} from "./sql_jsonpath_cst"


export type CodegenContext = {
  lax:    boolean
  source: string
}


function maybeAppend(token: IToken[] | undefined, ctx: CodegenContext): CodegenContext {
  if (token) {
    ctx = {...ctx, source: `${ctx.source}${token[0].image}`}
  }
  return ctx
}


function maybeImage(token: IToken[] | undefined, defaultValue = ""): string {
  return token
    ? token[0].image
    : defaultValue
}



/**
 * Construct a new Visitor that generates a JS function to execute the JsonPath query.
 *
 * @param ctor the value from <code>parser.getBaseCstVisitorConstructor()</code>
 */
export function newCodegenVisitor(ctor: { new(...args: any[]): ICstVisitor<CodegenContext, CodegenContext> }) {
  return new class CodegenVisitor extends ctor {
    constructor() {
      super()
      this.validateVisitor()
    }


    // make the context immutable so visitors don't edit it but send back new ones
    visit(cstNode: CstNode | CstNode[], ctx: CodegenContext): CodegenContext {
      if (ctx) {
        ctx = Object.freeze(ctx)
      }
      const result = super.visit(cstNode, ctx)
      return Object.freeze(result)
    }


    maybeVisit(node: CstNode | CstNode[] | undefined, ctx: CodegenContext): CodegenContext {
      return node
        ? this.visit(node, ctx)
        : ctx
    }


    stmt(node: StmtCstChildren): CodegenContext {
      const {Mode, wff} = node
      const mode = maybeImage(Mode, "lax")
      let ctx: CodegenContext = {
        lax:    mode === "lax",
        source: ""
      }

      ctx = this.visit(wff, ctx)
      return {...ctx, source: `return ${ctx.source}`}
    }


    handleArithmeticOps(left:     CstNode[],
                        opToken:  IToken[] | undefined,
                        right:    CstNode[] | undefined,
                        ctx:      CodegenContext): CodegenContext {
      const {source: origSource} = ctx
      ctx = this.visit(left, {...ctx, source: ""})
      if (right) {
        const {source: leftSource} = ctx
        const {source: rightSource} = this.visit(right, {...ctx, source: ""})
        const op = maybeImage(opToken)
        ctx = {...ctx, source: `ƒ.num(${leftSource})${op}ƒ.num(${rightSource})`}
      }
      return {...ctx, source: `${origSource}${ctx.source}`}
    }


    wff(node: WffCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, UnaryOp, right} = node
      return this.handleArithmeticOps(left, UnaryOp, right, ctx)
    }


    binary(node: BinaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, BinaryOp, right} = node
      return this.handleArithmeticOps(left, BinaryOp, right, ctx)
    }


    unary(node: UnaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {accessExp, UnaryOp, unary} = node
      ctx = this.maybeVisit(accessExp, ctx)
      if (unary) {
        const {source: origSource} = ctx
        const op = maybeImage(UnaryOp)
        ctx = this.visit(unary, {...ctx, source: ""})
        ctx = {...ctx, source: `${origSource}${op}ƒ.num(${ctx.source})`}
      }
      return ctx
    }


    accessExp(node: AccessExpCstChildren, ctx: CodegenContext): CodegenContext {
      const {primary, accessor} = node
      const origSource = ctx.source
      ctx = this.visit(primary, {...ctx, source: ""})
      if (accessor) {
        ctx = accessor.reduce((acc, a) => this.visit(a, acc), ctx)
      }
      return {...ctx, source: `${origSource}${ctx.source}`}
    }


    primary(node: PrimaryCstChildren, ctx: CodegenContext): CodegenContext {
      const {scopedWff, literal, ContextVariable, FilterValue, Last, NamedVariable} = node
      // will be just one of these so the order doesn't really matter
      ctx = this.maybeVisit(scopedWff, ctx)
      ctx = this.maybeVisit(literal, ctx)
      ctx = maybeAppend(ContextVariable, ctx)
      if (FilterValue) {
        ctx = {...ctx, source: `${ctx.source}v`}
      }
      if (NamedVariable) {
        const name = NamedVariable[0].image.substring(1)
        ctx = {...ctx, source: `$$("${name}")`}
      }
      if (Last) {
        ctx = {...ctx, source: `${ctx.source}ƒ.last`}
      }
      return ctx
    }


    scopedWff(node: ScopedWffCstChildren, ctx: CodegenContext): CodegenContext {
      const {wff} = node
      ctx = this.visit(wff, ctx)
      return {...ctx, source: `(${ctx.source})`}
    }


    literal(node: LiteralCstChildren, ctx: CodegenContext): CodegenContext {
      const {Boolean, Null, Number, String} = node
      ctx = maybeAppend(Boolean, ctx)
      ctx = maybeAppend(Null, ctx)
      ctx = maybeAppend(Number, ctx)
      return maybeAppend(String, ctx)
    }


    accessor(node: AccessorCstChildren, ctx: CodegenContext): CodegenContext {
      const {array, filter, DatetimeMethod, ItemMethod, Member, WildcardArray, WildcardMember} = node
      ctx = this.maybeVisit(array, ctx)
      ctx = this.maybeVisit(filter, ctx)
      const {source: primary} = ctx
      let source = ""
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
        source = methodImpl
      }
      if (DatetimeMethod) {
        let template = DatetimeMethod[0].payload[0] || ""
        if (template) {
          template = `,${template}`
        }
        source = `ƒ.datetime(${primary}${template})`
      }
      if (WildcardMember) {
        source = `ƒ.dotStar(${primary})`
      }
      if (WildcardArray) {
        source = `ƒ.boxStar(${primary})`
      }
      if (Member) {
        const payloads = Member[0].payload
        const member = payloads[0] || payloads[1]
        source = `ƒ.member(${primary},"${member}")`
      }
      if (source) {
        ctx = {...ctx, source}
      }
      return ctx
    }


    array(node: ArrayCstChildren, ctx: CodegenContext): CodegenContext {
      const {subscript} = node
      const {source: primary} = ctx
      const subscripts = subscript
        .map((s) => this.visit(s, {...ctx, source: ""}).source)
      return {...ctx, source: `ƒ.array(${primary},[${subscripts}])`}
    }


    subscript(node: SubscriptCstChildren, ctx: CodegenContext): CodegenContext {
      const {To, wff} = node
      const wff0 = this.visit(wff[0], {...ctx, source: ""})
      if (To) {
        const wff1 = this.visit(wff[1], {...ctx, source: ""})
        return {...ctx, source: `ƒ.range(${wff0.source},${wff1.source})`}
      }
      return wff0
    }


    filter(node: FilterCstChildren, ctx: CodegenContext): CodegenContext {
      const {pathPred} = node
      const origSource = ctx.source
      ctx = this.visit(pathPred, {...ctx, source: ""})
      return {...ctx, source: `ƒ.filter(${origSource},v=>${ctx.source})`}
    }


    handleLogicOp(left:     CstNode[],
                  opƒ:      string,
                  right:    CstNode[] | undefined,
                  ctx:      CodegenContext): CodegenContext {
      const {source: origSource} = ctx
      const leftCtx = this.visit(left, {...ctx, source: ""})
      if (right) {
        const rights = right
          .map((r) => this.visit(r, {...ctx, source: ""}).source)
        ctx = {...ctx, source: `ƒ.${opƒ}([${leftCtx.source},${[rights]}])`}
      } else {
        ctx = leftCtx
      }
      return {...ctx, source: `${origSource}${ctx.source}`}
    }


    pathPred(node: PathPredCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, right} = node
      return this.handleLogicOp(left, "or", right, ctx)
    }


    boolConj(node: BoolConjCstChildren, ctx: CodegenContext): CodegenContext {
      const {left, right} = node
      return this.handleLogicOp(left, "and", right, ctx)
    }


    neg(node: NegCstChildren, ctx: CodegenContext): CodegenContext {
      const {pred, NotOp, delPred} = node
      ctx = this.maybeVisit(pred, ctx)
      ctx = maybeAppend(NotOp, ctx)
      return this.maybeVisit(delPred, ctx)
    }


    pred(node: PredCstChildren, ctx: CodegenContext): CodegenContext {
      const {delPred, wff, likeRegex, startsWith, comparison} = node
      ctx = this.maybeVisit(delPred, ctx)
      ctx = this.maybeVisit(wff, ctx)
      ctx = this.maybeVisit(likeRegex, ctx)
      ctx = this.maybeVisit(startsWith, ctx)
      return this.maybeVisit(comparison, ctx)
    }


    delPred(node: DelPredCstChildren, ctx: CodegenContext): CodegenContext {
      const {scopedPred, exists} = node
      ctx = this.maybeVisit(scopedPred, ctx)
      return this.maybeVisit(exists, ctx)
    }


    scopedPred(node: ScopedPredCstChildren, ctx: CodegenContext): CodegenContext {
      const {pathPred, IsUnknown} = node
      ctx = this.visit(pathPred, ctx)
      const unknown = IsUnknown ? "ƒ.isUnknown" : ""
      return {...ctx, source: `${unknown}(${ctx.source})`}
    }


    private validFlags = /[ims]{1,3}/

    likeRegex(node: LikeRegexCstChildren, ctx: CodegenContext): CodegenContext {
      const {Pattern, FlagValue} = node
      const regex = Pattern[0].image
        .slice(1, -1)
        .replace("\\\\", "\\")
      let fnSource = `${ctx.source},/${regex}/`
      if (FlagValue) {
        const flags = FlagValue[0].image.slice(1, -1)
        /*
          The spec states that SQL like_regex should be used. That states XQuery flags should be used:

          • i makes the regex match case-insensitive.
          • s enables "single-line mode" or "dot-all" mode. In this mode, the dot matches every character, including newlines, so the string is treated as a single line.
          • m enables "multi-line mode". In this mode, the anchors "^" and "$" match before and after newlines in the string as well in addition to applying to the string as a whole.
          • x enables "free-spacing mode". In this mode, whitespace in regex pattern is ignored. This is mainly used when one has divided a complicated regex over several lines, but do not intend the newlines to be matched.

          i -> JS i
          s -> JS s
          m -> JS m
          x -> JS none, don't support.

          I'd like to add a JS mode that uses Javascript flags. Much more useful.
         */
        if (!this.validFlags.test(flags)) {
          throw new Error(`Invalid like_regex flag. Expected i, m, s but found '${flags}'. Please use XQuery regex flags ('x' not supported though).`)
        }
        fnSource += flags
      }
      return {...ctx, source: `ƒ.match(${fnSource})`}
    }


    startsWith(node: StartsWithCstChildren, ctx: CodegenContext): CodegenContext {
      const {wff} = node
      const {source: origSource} = ctx
      ctx = this.visit(wff, {...ctx, source: ""})
      return {...ctx, source: `ƒ.startsWith(${origSource},${ctx.source})`}
    }


    exists(node: ExistsCstChildren, ctx: CodegenContext): CodegenContext {
      const {scopedWff} = node
      ctx = this.visit(scopedWff, ctx)
      return {...ctx, source: `ƒ.exists(()=>${ctx.source})`}
    }


    comparison(node: ComparisonCstChildren, ctx: CodegenContext): CodegenContext {
      const {CompOp: [{image: compOp}], wff} = node
      const rightCtx = this.visit(wff, {...ctx, source: ""})
      return {...ctx, source: `ƒ.compare("${compOp}",${ctx.source},${rightCtx.source})`}
    }
  }
}
