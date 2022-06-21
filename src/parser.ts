import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator,
  ContextVariable,
  Flag,
  FlagValue,
  LikeRegex,
  Mode,
  StringLiteral,
  Member,
  NamedVariable
} from "./tokens"


export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStmt", () => {
    this.OPTION(() => this.CONSUME(Mode))
    this.SUBRULE(this.wff)
  })


  wff = this.RULE("wff", () => {
    this.SUBRULE(this.accessorExpression, { LABEL: "left" })
    this.MANY(() => {
        this.CONSUME(ArithmeticOperator)
        this.SUBRULE2(this.accessorExpression, { LABEL: "right" })
      }
    )
  })


  // this will grow, need to stop it here to write some tests
  accessorExpression = this.RULE("accessorExp", () => {
    this.OR([
      { ALT: () => this.CONSUME(NamedVariable) },
      { ALT: () => this.CONSUME(ContextVariable) }
    ])
  })



  unaryExpression = this.RULE("unaryExpression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.accessorExpression, {LABEL: "ul"}) },
      { ALT: () => {
          this.CONSUME(ArithmeticOperator)
          this.SUBRULE2(this.unaryExpression, { LABEL: "ur" })
      }}
    ])
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