import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator, ContextVariable,
  Flag,
  FlagValue,
  LikeRegex,
  Mode,
  PlusMinusOperator,
  StringLiteral
} from "./tokens"

export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStatement", () => {
    this.OPTION(() => this.CONSUME(Mode))
    this.SUBRULE(this.jsonPathWff)
  })


  /*
  I don't really understand why we can't just use "multiplicativeExpression". It seems like
  it has the same patterns.
   */
/*  jsonPathWff = this.RULE("jsonPathWff", () => {
    this.SUBRULE(this.multiplicativeExpression, { LABEL: "left" })
    this.MANY(() => {
        this.CONSUME(PlusMinusOperator)
        this.SUBRULE2(this.multiplicativeExpression, { LABEL: "right" })
      }
    )
  })
*/

  jsonPathWff = this.RULE("jsonPathWff", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "left" })
    this.MANY(() => {
      this.CONSUME(ArithmeticOperator)
      this.SUBRULE2(this.unaryExpression, { LABEL: "right" })
    })
  })

  unaryExpression = this.RULE("UnaryExpression", () => {
    this.SUBRULE(this.accessorExpression, {LABEL: "left"})
    this.MANY(() => {
      this.CONSUME(PlusMinusOperator)
      this.SUBRULE2(this.unaryExpression, { LABEL: "right" })
    })
  })

  // this will grow, need to terminate it here to write some tests
  accessorExpression = this.RULE("AccessorExpression", () => {
    this.CONSUME(ContextVariable)
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