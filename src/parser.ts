import {CstParser} from "chevrotain"
import {
  allTokens,
  BooleanLiteral,
  Flag,
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
  NotOperator,
  BinaryOperator,
  UnaryOperator
} from "./tokens"


export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)
    this.performSelfAnalysis()
  }


  jsonPathStatement = this.RULE("statement", () => {
    this.OPTION(() => this.CONSUME(Mode))
    this.SUBRULE(this.wff)
  })


/*
<JSON path wff> ::= <JSON additive expression>

<JSON additive expression> ::=
            <JSON multiplicative expression>
          | <JSON additive expression> <plus sign> <JSON multiplicative expression>
          | <JSON additive expression> <minus sign> <JSON multiplicative expression>
 */
  wff = this.RULE("wff", () => {
    this.SUBRULE(this.binaryExpression, { LABEL: "left" })
    this.MANY(() => {
        this.CONSUME(UnaryOperator)
        this.SUBRULE1(this.binaryExpression, { LABEL: "right" })
      }
    )
  })


  scopedWff = this.RULE("scopedWff", () => {
    this.CONSUME(LeftParen)
    this.SUBRULE(this.wff)
    this.CONSUME(RightParen)
  })


  /*
<JSON unary expression> ::=
            <JSON accessor expression>
          | <plus sign> <JSON unary expression>
          | <minus sign> <JSON unary expression>
 */
  unaryExpression = this.RULE("unary", () => {
    // this supports expressions like '-$.count' where the operator comes first.
    this.OR([
      { ALT: () => this.SUBRULE(this.accessorExpression) },
      { ALT: () => {
          this.CONSUME(UnaryOperator)
          this.SUBRULE(this.unaryExpression)
        }
      }
    ])
  })


  /*
  <JSON multiplicative expression> ::=
            <JSON unary expression>
          | <JSON multiplicative expression> <asterisk> <JSON unary expression>
          | <JSON multiplicative expression> <solidus> <JSON unary expression>
          | <JSON multiplicative expression> <percent> <JSON unary expression>
   */
  binaryExpression = this.RULE("binary", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "left" })
    this.MANY( () => {
      this.CONSUME(BinaryOperator)
      this.SUBRULE(this.binaryExpression, { LABEL: "right" })
    })
  })


  pathPrimary = this.RULE("primary", () => {
    // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
    this.OR([
      { ALT: () => this.CONSUME(NamedVariable) },
      { ALT: () => this.CONSUME(ContextVariable) },
      { ALT: () => this.CONSUME(FilterValue) },
      { ALT: () => this.CONSUME(Last) },
      { ALT: () => this.SUBRULE(this.pathLiteral) },
      { ALT: () => this.SUBRULE(this.scopedWff) }
    ])
  })


  // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
  pathLiteral = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NullLiteral) },
    ])
  })


  accessorExpression = this.RULE("accessExp", () => {
    this.SUBRULE(this.pathPrimary)
    this.MANY(() => {
        this.SUBRULE(this.accessor)
      })
    })


  // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
  accessor = this.RULE("accessor", () => {
    this.OR([
      { ALT: () => this.CONSUME(Member) },
      { ALT: () => this.CONSUME(WildcardMember) },
      { ALT: () => this.SUBRULE(this.arrayAccessor) },
      { ALT: () => this.CONSUME(WildcardArray) },
      { ALT: () => this.SUBRULE(this.filterExpression) },
      { ALT: () => this.CONSUME(ItemMethod) }
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


  // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
  predicate = this.RULE("predicate", () => {
    this.OR([
      // IGNORE_AMBIGUITIES because we are in a filter expression.
      { ALT: () => this.SUBRULE(this.isUnknown), IGNORE_AMBIGUITIES: true },
      { ALT: () => this.SUBRULE(this.delimitedPredicate), IGNORE_AMBIGUITIES: true },
      { ALT: () => {
          this.SUBRULE(this.wff)
          this.OR1([
            { ALT: () => this.SUBRULE(this.likeRegex) },
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
    this.CONSUME(StringLiteral, { LABEL: "Pattern" })
    this.OPTION(() => {
      this.CONSUME(Flag)
      // /"[imsq]{1,4}"/
      this.CONSUME1(StringLiteral, {LABEL: "FlagValue"})
    })
  })
}