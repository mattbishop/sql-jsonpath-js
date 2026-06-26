import {CstParser} from "chevrotain"

import {
  allTokens,
  AndOperator,
  BinaryOperator,
  BooleanLiteral,
  Comma,
  ComparisonOperator,
  ContextVariable,
  DatetimeMethod,
  TimeStampTzMethod,
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
  Member,
  Mode,
  NamedVariable,
  NotOperator,
  NullLiteral,
  NumberLiteral,
  OrOperator,
  RightBracket,
  RightParen,
  StartsWith,
  StringLiteral,
  To,
  UnaryOperator,
  WildcardArray,
  WildcardMember
} from "./tokens.ts"


/** @internal */
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
    <JSON path primary> ::=
            <JSON path literal>
          | <JSON path variable>
          | <left paren> <JSON path wff> <right paren>

   */
  pathPrimary = this.RULE("primary", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.pathLiteral) },
      { ALT: () => this.SUBRULE(this.pathVariable) },
      { ALT: () => this.SUBRULE(this.scopedWff) }
    ])
  })


  /*
    scopedWff = <left paren> <JSON path wff> <right paren>
   */
  scopedWff = this.RULE("scopedWff", () => {
    this.CONSUME(LeftParen)
    this.SUBRULE(this.wff)
    this.CONSUME(RightParen)
  })


  /*
    Same as ECMAScript Literals; they are grouped together here for clarity
   */
  pathLiteral = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NullLiteral) },
    ])
  })


  /*
    <JSON path variable> ::=
            <JSON path context variable>
          | <JSON path named variable>
          | <at sign>
          | <JSON last subscript>
   */
  pathVariable = this.RULE("variable", () => {
    this.OR([
      { ALT: () => this.CONSUME(ContextVariable) },
      { ALT: () => this.CONSUME(NamedVariable) },
      { ALT: () => this.CONSUME(FilterValue) },
      { ALT: () => this.CONSUME(Last) }
    ])
  })


  /*
    <JSON accessor expression> ::=
            <JSON path primary>
          | <JSON accessor expression> <JSON accessor op>
   */
  accessorExpression = this.RULE("accessorExp", () => {
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
  accessor = this.RULE("accessor", () => {
    this.OR([
      { ALT: () => this.CONSUME(Member) },
      { ALT: () => this.CONSUME(WildcardMember) },
      { ALT: () => this.SUBRULE(this.arrayAccessor) },
      { ALT: () => this.CONSUME(WildcardArray) },
      { ALT: () => this.SUBRULE(this.filterExpression) },
      { ALT: () => this.SUBRULE(this.itemMethod) }
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
    this.SUBRULE(this.predicate)
    this.CONSUME(RightParen, { LABEL: "FilterEnd" })
  })


  /*
    <JSON item method> ::=
          <period> <JSON method>

    <JSON method> ::=
            type <left paren> <right paren>
          | size <left paren> <right paren>
          | double <left paren> <right paren>
          | ceiling <left paren> <right paren>
          | floor <left paren> <right paren>
          | abs <left paren> <right paren>
          | datetime <left paren> [ <JSON datetime template> ] <right paren>
          | keyvalue <left paren> <right paren>
          | bigint <left paren> <right paren>
          | boolean <left paren> <right paren>
          | date <left paren> <right paren>
          | decimal <left paren> [ <precision> [ <comma> <scale> ] ] <right paren>
          | integer <left paren> <right paren>
          | number <left paren> <right paren>
          | string <left paren> <right paren>
          | time <left paren> [ <time precision> ] <right paren>
          | time_tz <left paren> [ <time precision> ] <right paren>
          | timestamp <left paren> [ <timestamp precision> ] <right paren>
          | timestamp_tz <left paren> [ <timestamp precision> ] <right paren>
      // todo finish adding these, some are missing like decimal and bigint
   */
  itemMethod = this.RULE("method", () => {
    this.OR([
      { ALT: () => this.CONSUME(ItemMethod) },
      { ALT: () => this.CONSUME(DatetimeMethod) },
      { ALT: () => this.CONSUME(TimeStampTzMethod) }
    ])
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
  multiplicativeExpression = this.RULE("mult", () => {
    this.SUBRULE(this.unaryExpression, { LABEL: "left" })
    this.MANY(() => {
      this.CONSUME(BinaryOperator)
      this.SUBRULE(this.multiplicativeExpression, { LABEL: "right" })
    })
  })


  /*
    <JSON path wff> ::= <JSON additive expression>

    <JSON additive expression> ::=
            <JSON multiplicative expression>
          | <JSON additive expression> <plus sign> <JSON multiplicative expression>
          | <JSON additive expression> <minus sign> <JSON multiplicative expression>   */
  wff = this.RULE("wff", () => {
    this.SUBRULE(this.multiplicativeExpression, { LABEL: "left" })
    this.MANY(() => {
      this.CONSUME(UnaryOperator)
      this.SUBRULE1(this.multiplicativeExpression, { LABEL: "right" })
    })
  })


  /*
    <JSON predicate primary> ::=
            <JSON delimited predicate>
          | <JSON non-delimited predicate>
   */
  predicatePrimary = this.RULE("predPrimary", () => {
    this.OR([
      // IGNORE_AMBIGUITIES because we are in a filter expression, but might not be ok in the end.
      // consider GATE
      { ALT: () => this.SUBRULE(this.nonDelimitedPredicate), IGNORE_AMBIGUITIES: true },
      { ALT: () => this.SUBRULE(this.delimitedPredicate), IGNORE_AMBIGUITIES: true }
    ])
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
    scoped predicate = <left paren> <JSON path predicate> <right paren>
   */
  scopedPredicate = this.RULE("scopedPred", () => {
    this.CONSUME(LeftParen)
    this.SUBRULE(this.predicate)
    this.CONSUME(RightParen)
  })


  /*
    <JSON non-delimited predicate> ::=
            <JSON comparison predicate>
          | <JSON like_regex predicate>
          | <JSON starts with predicate>
          | <JSON unknown predicate>
   */
  nonDelimitedPredicate = this.RULE("nonDelPred", () => {
/*  this OR matches the BNF exactly, but breaks Chevrotain Ambiguous Alternatives rule of 3 deep.
    this.OR([
      { ALT: () => this.SUBRULE(this.comparison) },
      { ALT: () => this.SUBRULE(this.likeRegex) },
      { ALT: () => this.SUBRULE(this.startsWith) },
      { ALT: () => this.SUBRULE(this.isUnknown) }
    ])

    factored out shared wff SUBRULE from three of the matches
*/
    this.OR( {IGNORE_AMBIGUITIES: true, DEF: [
        // at this point, scopedPred is already identified, but it's actually a wff
        // The GATE should look ahead for IsUnknown?
      { ALT: () => this.SUBRULE(this.isUnknown) },
      { ALT: () => {
        this.SUBRULE(this.wff)
        this.OR1([
            { ALT: () => this.SUBRULE(this.comparison) },
            { ALT: () => this.SUBRULE(this.likeRegex) },
            { ALT: () => this.SUBRULE(this.startsWith) }
          ])
        }
      }
    ]})
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
  <JSON comparison predicate> ::=
          <JSON path wff> <JSON comp op> <JSON path wff>

  // todo what does this mean?
  NOTE 489 — Comparison operators are not left associative, unlike ECMAScript Language Specification 5.1 Edition.
 */
  comparison = this.RULE("comparison", () => {
    // wff handled in nonDelPred
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
    // wff handled in nonDelPred
    this.CONSUME(LikeRegex)
    this.CONSUME(StringLiteral, { LABEL: "Pattern" })
    this.OPTION(() => {
      this.CONSUME(Flag)
      this.CONSUME1(StringLiteral, { LABEL: "FlagValue" })
    })
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
    // wff handled in nonDelPred
    this.CONSUME(StartsWith)
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral, { LABEL: "Initial" }) },
      { ALT: () => this.CONSUME(NamedVariable) }
    ])
  })


  /*
    <JSON unknown predicate> ::=
          <left paren> <JSON path predicate> <right paren> is unknown
   */
  isUnknown = this.RULE("isUnknown", () => {
    this.SUBRULE(this.scopedPredicate)
    this.CONSUME(IsUnknown)
  })


  /*
    <JSON boolean negation> ::=
            <JSON predicate primary>
          | <exclamation mark> <JSON delimited predicate>
   */
  negation = this.RULE("neg", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.predicatePrimary) },
      { ALT: () => {
          this.CONSUME(NotOperator)
          this.SUBRULE(this.delimitedPredicate)
        }
      }
    ])
  })


/*
    <JSON boolean conjunction> ::=
            <JSON boolean negation>
          | <JSON boolean conjunction> <double ampersand> <JSON boolean negation>
*/
  conjunction = this.RULE("conj", () => {
    this.SUBRULE(this.negation, { LABEL: "left" })
    this.MANY(() => {
      this.CONSUME(AndOperator)
      this.SUBRULE1(this.negation, { LABEL: "right" })
    })
  })


  /*
      <JSON path predicate> ::=
            <JSON boolean disjunction>

       <JSON boolean disjunction> ::=
              <JSON boolean conjunction>
            | <JSON boolean disjunction> <double vertical bar> <JSON boolean conjunction>
   */
  predicate = this.RULE("predicate", () => {
    this.SUBRULE(this.conjunction, { LABEL: "left" })
    this.MANY(() => {
      this.CONSUME(OrOperator)
      this.SUBRULE1(this.conjunction, { LABEL: "right" })
    })
  })
}
