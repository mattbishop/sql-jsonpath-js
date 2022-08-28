import {CstParser} from "chevrotain"
import {
  allTokens,
  BinaryOperator,
  BooleanLiteral,
  Comma,
  ComparisonOperator,
  ContextVariable,
  DatetimeMethod,
  Exists,
  FilterStart,
  FilterValue,
  Flag,
  ItemMethod,
  IsUnknown,
  Last,
  LeftBracket,
  LeftParen,
  LikeRegex,
  LogicOperator,
  Member,
  Mode,
  NamedVariable,
  NotOperator,
  NullLiteral,
  NumberLiteral,
  RightBracket,
  RightParen,
  StartsWith,
  StringLiteral,
  To,
  UnaryOperator,
  WildcardArray,
  WildcardMember
} from "./tokens"


export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)
    this.performSelfAnalysis()
  }


  /*
    <JSON path expression> ::=
          <JSON path mode> <JSON path wff>

    <JSON path mode> ::=
            strict
          | lax
   */
  jsonPathStatement = this.RULE("stmt", () => {
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


  /*
    <JSON path primary> ::=
            <JSON path literal>
          | <JSON path variable>
          | <left paren> <JSON path wff> <right paren>

    <JSON path variable> ::=
            <JSON path context variable>
          | <JSON path named variable>
          | <at sign>
          | <JSON last subscript>
   */
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


  /*
    <JSON accessor expression> ::=
            <JSON path primary>
          | <JSON accessor expression> <JSON accessor op>
   */
  accessorExpression = this.RULE("accessExp", () => {
    this.SUBRULE(this.pathPrimary)
    this.MANY(() => {
        this.SUBRULE(this.accessor)
      })
    })


  /*
    <JSON accessor op> ::=
            <JSON member accessor>
          | <JSON wildcard member accessor>
          | <JSON array accessor>
          | <JSON wildcard array accessor>
          | <JSON filter expression>
          | <JSON item method>
   */
  // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
  accessor = this.RULE("accessor", () => {
    this.OR([
      { ALT: () => this.CONSUME(Member) },
      { ALT: () => this.CONSUME(WildcardMember) },
      { ALT: () => this.SUBRULE(this.arrayAccessor) },
      { ALT: () => this.CONSUME(WildcardArray) },
      { ALT: () => this.SUBRULE(this.filterExpression) },
      { ALT: () => this.CONSUME(ItemMethod) },
      { ALT: () => this.CONSUME(DatetimeMethod) }
    ])
  })


  /*
    <JSON array accessor> ::=
          <left bracket> <JSON subscript list> <right bracket>

    <JSON subscript list> ::=
          <JSON subscript> [ { <comma> <JSON subscript> }... ]
   */
  arrayAccessor = this.RULE("array", () => {
    this.CONSUME(LeftBracket)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => this.SUBRULE(this.subscript)
    })
    this.CONSUME(RightBracket)
  })


  /*
    <JSON subscript> ::=
            <JSON path wff>
          | <JSON path wff> to <JSON path wff>
   */
  subscript = this.RULE("subscript", () => {
    this.SUBRULE(this.wff)
    this.OPTION(() => {
      this.CONSUME(To)
      this.SUBRULE1(this.wff)
    })
  })


  /*
    <JSON filter expression> ::=
          <question mark> <left paren> <JSON path predicate> <right paren>
 */
  filterExpression = this.RULE("filter", () => {
    this.CONSUME(FilterStart)
    this.SUBRULE(this.pathPredicate)
    this.CONSUME(RightParen, {LABEL: "FilterEnd"})
  })


  /*
    <JSON delimited predicate> ::=
            <JSON exists path predicate>
          | <left paren> <JSON path predicate> <right paren>
   */
  delimitedPredicate = this.RULE("delPred", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.exists) },
      { ALT: () => this.SUBRULE(this.scopedPredicate) }
    ])
  })


  /*
    <JSON predicate primary> ::=
            <JSON delimited predicate>
          | <JSON non-delimited predicate>

    <JSON non-delimited predicate> ::=
            <JSON comparison predicate>
          | <JSON like_regex predicate>
          | <JSON starts with predicate>
          | <JSON unknown predicate>
   */
  // todo more than 3 alts so cache them: https://chevrotain.io/docs/guide/performance.html#caching-arrays-of-alternatives
  predicate = this.RULE("pred", () => {
    this.OR([
      // IGNORE_AMBIGUITIES because we are in a filter expression, but might not be ok in the end.
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


  /*
    <JSON unknown predicate> ::=
          <right paren> <JSON path predicate> <left paren> is unknown
   */
  scopedPredicate = this.RULE("scopedPred", () => {
    this.CONSUME(LeftParen)
    this.SUBRULE(this.pathPredicate)
    this.CONSUME(RightParen)
    // parsing here eliminates an ambiguity
    this.OPTION(() => this.CONSUME(IsUnknown))
  })


  /*
    <JSON boolean negation> ::=
            <JSON predicate primary>
          | <exclamation mark> <JSON delimited predicate>
   */
  negation = this.RULE("neg", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.predicate) },
      { ALT: () => {
          this.CONSUME(NotOperator)
          this.SUBRULE(this.delimitedPredicate)
        }
      }
    ])
  })


  // No BNF, but examples use this pattern
  pathPredicate = this.RULE("pathPred", () => {
    this.SUBRULE(this.negation)
    this.MANY(() => {
      this.CONSUME(LogicOperator)
      this.SUBRULE1(this.negation)
    })
  })


  /*
    <JSON exists path predicate> ::=
          exists <left paren> <JSON path wff> <right paren>
   */
  exists = this.RULE("exists", () => {
    this.CONSUME(Exists)
    this.SUBRULE(this.scopedWff)
  })


  /*
    <JSON starts with predicate> ::=
          <JSON starts with whole> starts with <JSON starts with initial>

    <JSON starts with whole> ::=
          <JSON path wff>

    <JSON starts with initial> ::=
          <JSON path wff>
   */
  startsWith = this.RULE("startsWith", () => {
    this.CONSUME(StartsWith)
    this.SUBRULE(this.wff)
  })


  // No BNF available for this rule
  comparison = this.RULE("comparison", () => {
    this.CONSUME(ComparisonOperator)
    this.SUBRULE(this.wff)
  })


  /*
    <JSON like_regex predicate> ::=
          <JSON path wff> like_regex <JSON like_regex pattern> [ flag <JSON like_regex flags> ]

    <JSON like_regex pattern> ::=
          <JSON path string literal>

    <JSON like_regex flags> ::=
          <JSON path string literal>
   */
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
