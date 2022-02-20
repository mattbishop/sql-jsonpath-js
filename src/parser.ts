import { CstParser } from "chevrotain"
import {
  allTokens,
  AndOperator,
  ArithmeticOperator,
  Comma,
  EqualsOperator,
  Exists,
  FilterValue,
  GteOperator,
  GtOperator,
  Identifier,
  Integer,
  Lax,
  LeftSquareBracket,
  LteOperator,
  LtOperator,
  RightParen,
  LeftParen,
  NotEqualsOperator,
  NotEqualsOperator2,
  NotOperator,
  ContextItem,
  OrOperator,
  PathSeparator,
  RightSquareBracket,
  StartFilterExpression,
  StringLiteral,
  Strict,
  To,
  Last,
  Wildcard
} from "./tokens"

export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStatement", () => {
    this.OPTION(() => this.SUBRULE(this.mode, { LABEL: "mode" }))
    this.OPTION1(() => this.SUBRULE(this.contextQuery, { LABEL: "lhs" }))
  })

  mode = this.RULE("mode", () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Lax, { LABEL: "lax" }) },
        { ALT: () => this.CONSUME(Strict, { LABEL: "strict" }) }
      ])
    })
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
    this.CONSUME(ContextItem)
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

  filterChain = this.RULE("filterChain", () => {
    this.AT_LEAST_ONE(() => this.SUBRULE(this.filterExpression, { LABEL: "filterExpressions" }))
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
    this.OPTION2(() => {
      this.SUBRULE(this.booleanOperator, { LABEL: "operator" })
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

  booleanOperator = this.RULE("booleanOperator", () => {
    this.OR([
      { ALT: () => this.CONSUME(AndOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(OrOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(EqualsOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(NotEqualsOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(NotEqualsOperator2, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(GtOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(LtOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(GteOperator, { LABEL: "operator" }) },
      { ALT: () => this.CONSUME(LteOperator, { LABEL: "operator" }) },
    ])
  })

  pathPart = this.RULE("pathPart", () => {
    this.CONSUME(Identifier, { LABEL: "name" })
    this.OPTION(() =>
      this.OR2([
        { ALT: () => this.SUBRULE(this.arrayAccessor) },
        { ALT: () => this.SUBRULE(this.arguments) }
      ]))
    this.OPTION2(() => this.SUBRULE(this.filterChain))
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
