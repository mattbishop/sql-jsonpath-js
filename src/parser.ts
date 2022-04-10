import {CstParser} from "chevrotain"
import {
  allTokens,
  ArithmeticOperator,
  Comma,
  ComparisonOperator,
  Exists,
  FilterValue,
  Identifier,
  Integer,
  Mode,
  LeftSquareBracket,
  RightParen,
  LeftParen,
  NotOperator,
  ContextVariable,
  PathSeparator,
  RightSquareBracket,
  StartFilterExpression,
  StringLiteral,
  To,
  Last,
  Wildcard, LikeRegex, Flag, FlagValue
} from "./tokens"

export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  likeRegex = this.RULE("likeRegex", () => {
    this.CONSUME(LikeRegex)
    this.CONSUME(StringLiteral, { LABEL: "pattern" })
    this.OPTION(() => {
      this.CONSUME(Flag)
      this.CONSUME(FlagValue)
    })
  })

  jsonPathStatement = this.RULE("jsonPathStatement", () => {
    this.OPTION1(() => this.CONSUME(Mode))
    this.SUBRULE(this.contextQuery)
    this.OPTION2(() => this.SUBRULE(this.filterExpression, { LABEL: "filterExpression" }))
  })

  arguments = this.RULE("arguments", () => {
    this.CONSUME(LeftParen)
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => this.CONSUME(Identifier, { LABEL: "args" })
    })
    this.CONSUME(RightParen)
  })

  contextQuery = this.RULE("contextQuery", () => {
    this.CONSUME(ContextVariable)
    this.OPTION(() => {
      this.CONSUME(PathSeparator)
      this.SUBRULE(this.pathQuery, { LABEL: "path" })
    })
  })

  pathQuery = this.RULE("pathQuery", () => {
    this.MANY_SEP({
      SEP: PathSeparator,
      DEF: () => this.SUBRULE(this.pathPart, { LABEL: "pathParts" })
    })
  })

  filterExpression = this.RULE("filterExpression", () => {
    this.CONSUME(StartFilterExpression)
    this.CONSUME(LeftParen)
    this.OPTION(() => this.CONSUME(NotOperator))
    this.OR([
      { ALT: () => this.SUBRULE(this.existsQuery, { LABEL: "query" }) },
      { ALT: () => this.SUBRULE(this.filterQuery, { LABEL: "query" }) }
    ])
    this.CONSUME(RightParen)
  })

  filterQuery = this.RULE("filterQuery", () => {
    this.SUBRULE(this.existsPathQuery, { LABEL: "query" })
    this.OPTION(() => {
      this.SUBRULE(this.conditionalOperator, { LABEL: "operator" })
      this.OR([
        { ALT: () => this.CONSUME(StringLiteral, { LABEL: "stringLiteral" }) },
        { ALT: () => this.CONSUME(Integer, { LABEL: "number" }) }
      ])
    })
  })

  existsPathQuery = this.RULE("existsPathQuery", () => {
    this.CONSUME(FilterValue)
    this.OPTION(() => {
      this.CONSUME(PathSeparator)
      this.SUBRULE(this.pathQuery)
    })
  })

  existsQuery = this.RULE("existsQuery", () => {
    this.CONSUME(Exists)
    this.CONSUME(LeftParen)
    this.SUBRULE(this.existsPathQuery, { LABEL: "query" })
    this.CONSUME(RightParen)
  })

  conditionalOperator = this.RULE("conditionalOperator", () => {
    this.CONSUME(ComparisonOperator, { LABEL: "operator" })
  })

  pathPart = this.RULE("pathPart", () => {
    this.CONSUME(Identifier, { LABEL: "name" })
    this.OPTION(() =>
      this.OR([
        { ALT: () => this.SUBRULE(this.arrayAccessor) },
        { ALT: () => this.SUBRULE(this.arguments) }
      ]))
  })

  group = this.RULE("group", () => {
    this.CONSUME(LeftParen, { LABEL: "group" })
    this.SUBRULE(this.wff)
    this.CONSUME(RightParen, { LABEL: "group" })
  })

  op = this.RULE("op", () => {
    this.OR1([
      { ALT: () => this.CONSUME(ArithmeticOperator, { LABEL: "connector" }) },
      { ALT: () => this.CONSUME(To, { LABEL: "connector" }) }
    ])
    this.OR2([
      { ALT: () => this.SUBRULE1(this.group, { LABEL: "rhs_group" }) },
      { ALT: () => this.CONSUME1(Integer, { LABEL: "rhs_integer" }) },
      { ALT: () => this.CONSUME1(Last, { LABEL: "rhs_last" }) }
    ])
  })

  wff = this.RULE("wff", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.group, { LABEL: "lhs_group" }) },
      { ALT: () => this.CONSUME(Integer, { LABEL: "lhs_integer" }) },
      { ALT: () => this.CONSUME(Last, { LABEL: "lhs_last" }) }
    ])
    this.MANY(() => {
      this.SUBRULE(this.op, { LABEL: "ops" })
    })
  })

  arrayAccessor = this.RULE("arrayAccessor", () => {
    this.CONSUME(LeftSquareBracket)
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => {
        this.OR([
          { ALT: () => this.CONSUME(Wildcard, { LABEL: "wildcard" }) },
          { ALT: () => this.SUBRULE(this.wff) }
        ])
        this.OPTION(() => this.CONSUME(RightSquareBracket))
      }
    })
  })
}
