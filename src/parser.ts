import {CstParser} from "chevrotain"
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
  LeftSquareBracket,
  LteOperator,
  LtOperator,
  MethodEnd,
  MethodStart,
  NotEqualsOperator,
  NotEqualsOperator2,
  NotOperator,
  ObjectRoot,
  OrOperator,
  PathSeparator,
  RightSquareBracket,
  StartFilterExpression,
  StringLiteral,
  Wildcard
} from "./tokens";

export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStatement", () => {
    this.OPTION(() => this.SUBRULE(this.operand, {LABEL: "lhs"}))
    this.OPTION2(() => {
      this.SUBRULE(this.arithmeticOperator, {LABEL: "operator"})
      this.SUBRULE2(this.operand, {LABEL: "rhs"})
    })
  })

  operand = this.RULE("operand", () => {
    this.OPTION(() => {
      this.OR([
        {ALT: () => this.SUBRULE(this.rootQuery, {LABEL: "path"})},
        {ALT: () => this.CONSUME(Integer, {LABEL: "number"})}
      ])
    })
  })

  arguments = this.RULE("arguments", () => {
    this.CONSUME(MethodStart)
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => this.CONSUME(Identifier, {LABEL: "args"})
    })
    this.CONSUME(MethodEnd)
  })

  rootQuery = this.RULE("rootQuery", () => {
    this.CONSUME(ObjectRoot)
    this.OPTION(() => {
      this.CONSUME(PathSeparator)
      this.SUBRULE(this.pathQuery, {LABEL: "path"})
    })
  })

  pathQuery = this.RULE("pathQuery", () => {
    this.MANY_SEP({
      SEP: PathSeparator,
      DEF: () => this.SUBRULE(this.pathPart, {LABEL: "pathParts"})
    })
  })

  filterChain = this.RULE("filterChain", () => {
    this.AT_LEAST_ONE(() => this.SUBRULE(this.filterExpression, {LABEL: "filterExpressions"}))
  })

  filterExpression = this.RULE("filterExpression", () => {
    this.CONSUME(StartFilterExpression)
    this.CONSUME(MethodStart)
    this.OPTION(() => this.CONSUME(NotOperator))
    this.OR([
      {ALT: () => this.SUBRULE(this.existsQuery, {LABEL: "query"})},
      {ALT: () => this.SUBRULE(this.filterQuery, {LABEL: "query"})}
    ])
    this.CONSUME(MethodEnd)
  })

  filterQuery = this.RULE("filterQuery", () => {
    this.SUBRULE(this.existsPathQuery, {LABEL: "query"})
    this.OPTION2(() => {
      this.SUBRULE(this.booleanOperator, {LABEL: "operator"})
      this.OR([
        {ALT: () => this.CONSUME(StringLiteral, {LABEL: "stringLiteral"})},
        {ALT: () => this.CONSUME(Integer, {LABEL: "number"})}
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
    this.CONSUME(MethodStart)
    this.SUBRULE(this.existsPathQuery, {LABEL: "query"})
    this.CONSUME(MethodEnd)
  })

  booleanOperator = this.RULE("booleanOperator", () => {
    this.OR([
      {ALT: () => this.CONSUME(AndOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(OrOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(EqualsOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(NotEqualsOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(NotEqualsOperator2, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(GtOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(LtOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(GteOperator, {LABEL: "operator"})},
      {ALT: () => this.CONSUME(LteOperator, {LABEL: "operator"})},
    ])
  })

  arithmeticOperator = this.RULE("arithmeticOperator", () => {
    this.CONSUME(ArithmeticOperator, {LABEL: "operator"})
  })

  pathPart = this.RULE("pathPart", () => {
    this.CONSUME(Identifier, {LABEL: "name"})
    this.OPTION(() =>
      this.OR2([
        {ALT: () => this.SUBRULE(this.arrayAccessor)},
        {ALT: () => this.SUBRULE(this.arguments)}
      ]))
    this.OPTION2(() => this.SUBRULE(this.filterChain))
  })

  arrayAccessor = this.RULE("arrayAccessor", () => {
    this.CONSUME(LeftSquareBracket)
    this.OR([
      {ALT: () => this.CONSUME(Wildcard, {LABEL: "wildcard"})},
      {ALT: () => this.CONSUME(Integer, {LABEL: "number"})}
    ])
    this.CONSUME(RightSquareBracket)
  })
}
