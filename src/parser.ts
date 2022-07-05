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
  ContextVariable,
  NamedVariable,
  WildcardArray,
  WildcardMember,
  LeftBracket,
  RightBracket,
  Comma,
  To,
  Last,
  FilterValue,
  PredicateStart,
  StartsWith,
  ComparisonOperator,
  Exists,
  IsUnknown,
  NotOperator
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
      { ALT: () => this.CONSUME(NamedVariable) },
      { ALT: () => this.CONSUME(ContextVariable) },
      { ALT: () => this.CONSUME(FilterValue) },
      { ALT: () => this.CONSUME(Last) },
      { ALT: () => this.SUBRULE(this.pathLiteral) },
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
      { ALT: () => this.SUBRULE(this.arrayAccessor) },
      { ALT: () => this.SUBRULE(this.filterExpression) }
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


  filterExpression = this.RULE("filter", () => {
    this.CONSUME(PredicateStart)
    this.SUBRULE(this.predicate)
    this.CONSUME(RightParen)
  })



  negation = this.RULE("negation", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.predicate) },
      { ALT: () => {
          this.CONSUME(NotOperator)
          this.SUBRULE(this.delimitedPredicate)
        }
      }
    ])
  })


  delimitedPredicate = this.RULE("delimitedPredicate", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.exists) },
      { ALT: () => this.SUBRULE(this.scopedPredicate) }
    ])
  })


  predicate = this.RULE("predicate", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.likeRegex) },
      // IGNORE_AMBIGUITIES because we are in a filter expression.
      { ALT: () => this.SUBRULE(this.isUnknown), IGNORE_AMBIGUITIES: true },
      { ALT: () => this.SUBRULE(this.delimitedPredicate), IGNORE_AMBIGUITIES: true },
      { ALT: () => {
          this.SUBRULE(this.wff)
          this.OR1([
             { ALT: () => this.SUBRULE(this.startsWith) },
             { ALT: () => this.SUBRULE(this.comparison) },
          ])
        }
      }
    ])
  })


  scopedPredicate = this.RULE("scopedPredicate", () => {
    this.CONSUME(LeftParen)
    this.SUBRULE(this.predicate)
    this.CONSUME(RightParen)
  })


  isUnknown = this.RULE("isUnknown", () => {
    this.SUBRULE(this.scopedPredicate)
    this.CONSUME(IsUnknown)
  })


  exists = this.RULE("exists", () => {
    this.CONSUME(Exists)
    this.SUBRULE(this.wff)
    this.CONSUME(RightParen)
  })


  startsWith = this.RULE("startsWith", () => {
    this.CONSUME(StartsWith)
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NamedVariable) }
    ])
  })


  comparison = this.RULE("comparison", () => {
    this.CONSUME(ComparisonOperator)
    this.SUBRULE1(this.wff)
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