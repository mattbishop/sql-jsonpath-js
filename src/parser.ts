import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator,
  BooleanLiteral,
  Flag,
  FlagValue,
  ItemMethod,
  LikeRegex,
  Mode,
  NullLiteral,
  NumberLiteral,
  StringLiteral,
  Member,
  LeftParen,
  RightParen,
  Variable,
  WildcardArray,
  WildcardMember,
  LeftBracket,
  RightBracket,
  Comma,
  To,
  Last
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
        this.SUBRULE1(this.accessorExpression, { LABEL: "right" })
      }
    )
  })


  pathPrimary = this.RULE("primary", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.pathLiteral) },
      // needs to be in "array" mode. Can't put it in subscript as it has to be handled as a wff part.
      { ALT: () => this.CONSUME(Last) },
      // Needs to be in "filter" mode
//      { ALT: () => this.CONSUME(FilterValue) },
      { ALT: () => this.CONSUME(Variable) },
      { ALT: () => {
          this.CONSUME(LeftParen)
          this.SUBRULE(this.wff)
          this.CONSUME(RightParen)
        }
      }
    ])
  })


  pathLiteral = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NullLiteral) },
    ])
  })


  accessorExpression = this.RULE("accessorExp", () => {
    this.SUBRULE(this.pathPrimary)
    this.OPTION(() => this.SUBRULE(this.accessor))
/*
    <JSON accessor expression> ::=
            <JSON path primary>
          | <JSON accessor expression> <JSON accessor op>

    This matches BNF, but has left recursion. I don't see any actual recursion, but keeping this around until I know for sure.
    this.OR([
      { ALT: () => this.SUBRULE(this.pathPrimary) },
      { ALT: () => {
          this.SUBRULE(this.accessorExpression)
          this.SUBRULE1(this.accessorOp)
        }}
    ])
*/
  })


  accessor = this.RULE("accessor", () => {
    this.OR([
      { ALT: () => this.CONSUME(Member) },
      { ALT: () => this.CONSUME(WildcardMember) },
      { ALT: () => this.CONSUME(WildcardArray) },
      { ALT: () => this.CONSUME(ItemMethod) },
      { ALT: () => this.SUBRULE(this.arrayAccessor) }
// filterExpression seems out of place here, but we'll see.
//      { ALT: () => this.SUBRULE(filterExpression) },
    ])
  })


  arrayAccessor = this.RULE("array", () => {
    this.CONSUME(LeftBracket)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => this.SUBRULE(this.subscript)
    })
    this.CONSUME(RightBracket)
  })


  subscript = this.RULE("subscript", () => {
    this.SUBRULE(this.wff)
    this.OPTION(() => {
      this.CONSUME(To)
      this.SUBRULE1(this.wff)
    })
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