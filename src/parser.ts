import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator,
  BooleanLiteral,
  Flag,
  FlagValue,
  LikeRegex,
  Mode,
  NullLiteral,
  NumberLiteral,
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
      { ALT: () => this.SUBRULE(this.pathLiteral) },
      { ALT: () => this.CONSUME(Variable) },
      { ALT: () => {
          this.CONSUME(LeftParen)
          this.SUBRULE(this.wff)
          this.CONSUME(RightParen)
        }
      }
    ])
  })

  /*
    The value of a <JSON path literal> is determined as follows:

    1. The value of a <JSON path numeric literal> JPNL is the value of the <signed numeric literal> whose characters are identical to JPNL.
    2. The value of a <JSON path string literal> JPSL is an SQL character string whose character set is Unicode and whose characters are the ones enclosed by single or double quotation marks (but excluding these delimiters) in JPSL after replacing any escape sequences by their unescaped equivalents.
    3. The value of null is the SQL/JSON null.
    4. The value of true is True.
    5. The value of false is False.
   */
  pathLiteral = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NullLiteral) },
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