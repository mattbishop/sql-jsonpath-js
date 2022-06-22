import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator,
  Flag,
  FlagValue,
  LikeRegex,
  Mode,
  StringLiteral,
  Member,
  LeftParen,
  RightParen,
  Variable
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


  accessorExpression = this.RULE("accessorExp", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.pathPrimary) },
/* Can't refer to yourself, I have to move this into a separate rule and call SUBRULE
      { ALT: () => {
          this.SUBRULE(this.accessorExpression)
          this.CONSUME(this.accessorOp)
        }
      }
*/
    ])
  })

  pathPrimary = this.RULE("primary", () => {
    this.OR([
//      { ALT: () => this.SUBRULE(this.pathLiteral) },
      { ALT: () => this.CONSUME(Variable) },
      { ALT: () => {
          this.CONSUME(LeftParen)
          this.SUBRULE(this.wff)
          this.CONSUME(RightParen)
        }
      }
    ])
  })



  unaryExpression = this.RULE("unaryExp", () => {
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