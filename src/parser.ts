import {CstParser} from "chevrotain"
import {
  allTokens,
  ContextVariable,
  Flag,
  FlagValue,
  LikeRegex,
  Mode,
  AdditiveOperator,
  StringLiteral,
  MultiplicativeOperator,
  Member
} from "./tokens"


export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStmt", () => {
    this.OPTION(() => this.CONSUME(Mode))
    // additive comes first to support order of precendence rules
    this.SUBRULE(this.additiveExpression)
  })



  additiveExpression = this.RULE("addExp", () => {
    this.SUBRULE(this.multiplicativeExpression, { LABEL: "wl" })
    this.MANY(() => {
        this.CONSUME(AdditiveOperator)
        this.SUBRULE2(this.multiplicativeExpression, { LABEL: "wr" })
      }
    )
  })


  multiplicativeExpression = this.RULE("multExp", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "ml" })
    this.MANY(() => {
      this.CONSUME(MultiplicativeOperator)
      this.SUBRULE2(this.unaryExpression, { LABEL: "mr" })
    })
  })


  unaryExpression = this.RULE("unExp", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.accessorExpression, {LABEL: "ul"}) },
      { ALT: () => {
          this.CONSUME(AdditiveOperator)
          this.SUBRULE2(this.unaryExpression, { LABEL: "ur" })
      }}
    ])
  })


  // this will grow, need to terminate it here to write some tests
  accessorExpression = this.RULE("accessExp", () => {
    this.CONSUME(ContextVariable)
  })

  memberRule = this.RULE("member", () => {
    this.CONSUME(Member)
  })


  likeRegex = this.RULE("likeRegex", () => {
    this.CONSUME(LikeRegex)
    this.CONSUME(StringLiteral, { LABEL: "pattern" })
    this.OPTION(() => {
      this.CONSUME(Flag)
      this.CONSUME(FlagValue)
    })
  })


}