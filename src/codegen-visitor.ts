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


/**
 * @internal
 */
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

function maybeParen(source: string): string {
  return source.startsWith("(")
    ? source
    : `(${source})`
}

function maybeNum(source: string): string {
  return Number.isNaN(Number.parseFloat(source))
    ? `ƒ.num(${source})`
    : source
}



/**
 * Construct a new Visitor that generates a JS function to execute the JsonPath query.
 *
 * @internal
 * @param ctor the value from <code>parser.getBaseCstVisitorConstructor()</code>
 */
export function newCodegenVisitor(ctor: { new(...args: any[]): ICstVisitor<CodegenContext, CodegenContext> }) {
  return new class CodegenVisitor extends ctor {
    constructor() {
      super()
      this.validateVisitor()
    }


    visit(cstNode: CstNode | CstNode[], ctx: CodegenContext): CodegenContext {
      if (ctx) {
        // make the context immutable so visitors don't edit it but send back new ones
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
      const leftCtx = this.visit(left, {...ctx, source: ""})
      if (right && opToken) {
        const {source: leftSource} = leftCtx
        const leftNum = maybeNum(leftSource)
        const source = right
          .reduce((acc, r, i) => {
              const {source: rightSource} = this.visit(r, {...ctx, source: ""})
              const rightNum = maybeNum(rightSource)
              const op = opToken[i].image
              return `${acc}${op}${rightNum}`
            }, leftNum)
        ctx = {...ctx, source}
      } else {
        ctx = leftCtx
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
        let right = maybeNum(ctx.source)
        // might be ƒ.num() because ---2 doesn't work in JS
        if (!right.startsWith("ƒ")) {
          right = `(${right})`
        }
        ctx = {...ctx, source: `${origSource}${op}${right}`}
      }
      return ctx
    }


    accessExp(node: AccessExpCstChildren, ctx: CodegenContext): CodegenContext {
      const {primary, accessor} = node
      const {source: origSource} = ctx
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
      } else if (NamedVariable) {
        const name = NamedVariable[0].image.substring(1)
        ctx = {...ctx, source: `$$("${name}")`}
      } else if (Last) {
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
      let source
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
            const attrs = maybeParen(primary)
            methodImpl = `ƒ.${methodName}${attrs}`
            break
          default :
            throw new Error(`Item methodName unrecognized: ${methodName}`)
        }
        source = methodImpl
      } else if (DatetimeMethod) {
        let template = DatetimeMethod[0].payload[0] || ""
        if (template) {
          template = `,${template}`
        }
        source = `ƒ.datetime(${primary}${template})`
      } else if (WildcardMember) {
        const attrs = maybeParen(primary)
        source = `ƒ.dotStar${attrs}`
      } else if (WildcardArray) {
        const attrs = maybeParen(primary)
        source = `ƒ.boxStar${attrs}`
      } else if (Member) {
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
      const {source: origSource} = ctx
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
      const {pred, delPred} = node
      ctx = this.maybeVisit(pred, ctx)
      if (delPred) {
        ctx = this.visit(delPred, ctx)
        const parenPred = maybeParen(ctx.source)
        ctx = {...ctx, source: `ƒ.not${parenPred}`}
      }
      return ctx
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
      const parenPred = maybeParen(ctx.source)
      return {...ctx, source: `${unknown}${parenPred}`}
    }


    likeRegex(node: LikeRegexCstChildren, ctx: CodegenContext): CodegenContext {
      const {Pattern, FlagValue} = node
      const regex = Pattern[0].image
        .slice(1, -1)
        .replace("\\\\", "\\")
      let fnSource = `${ctx.source},/${regex}/`
      if (FlagValue) {
        /*
          The spec states that SQL like_regex should be used. That states XQuery flags should be used:

          • 'i' makes the regex match case-insensitive.
          • 's' enables "single-line mode" or "dot-all" mode. In this mode, the dot matches every character, including
                newlines, so the string is treated as a single line.
          • 'm' enables "multi-line mode". In this mode, the anchors "^" and "$" match before and after newlines in the
                string as well in addition to applying to the string as a whole.
          • 'x' enables "free-spacing mode". In this mode, whitespace in regex pattern is ignored. This is mainly used
                when one has divided a complicated regex over several lines, but do not intend the newlines to be matched.

          i -> JS i
          s -> JS s
          m -> JS m
          x -> JS none, don't support.

          However, JS has more Javascript flags. Much more useful, so just pass them in. I could create a 'spec' mode
          that only accepts i, s, and m, but let's see if anyone asks for that.
         */
        const flags = FlagValue[0].image.slice(1, -1)
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
