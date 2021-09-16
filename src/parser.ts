import {CstParser} from "chevrotain"
import {
  Wildcard,
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
  MethodName,
  MethodStart,
  NotEqualsOperator,
  NotEqualsOperator2,
  NotOperator,
  ObjectRoot,
  OrOperator,
  PathSeparator,
  RightSquareBracket,
  StartFilterExpression
} from "./tokens";

export class JsonPathParser extends CstParser {
  constructor() {
    super(allTokens)

    this.performSelfAnalysis()
  }

  jsonPathStatement = this.RULE("jsonPathStatement", () => {
    this.OPTION(() => this.SUBRULE(this.operand))
    this.OPTION2(() => {
        this.SUBRULE(this.arithmeticOperator)
        this.SUBRULE2(this.operand)
      })
  })

  operand = this.RULE("operand", () => {
    this.OPTION(() => {
      this.OR([
        {ALT: () => this.SUBRULE(this.rootQuery)},
        {ALT: () => this.CONSUME(Integer)}
      ])
    })
  })

  method = this.RULE("method", () => {
    this.CONSUME(MethodName)
    this.CONSUME(MethodStart)
    this.SUBRULE(this.arguments)
    this.CONSUME(MethodEnd)
  })

  arguments = this.RULE("arguments", () => {
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => this.SUBRULE(this.pathPart)
    })
  })

  rootQuery = this.RULE("rootQuery", () => {
    this.CONSUME(ObjectRoot)
    this.CONSUME(PathSeparator)
    this.SUBRULE(this.pathQuery)
  })

  pathQuery = this.RULE("pathQuery", () => {
    this.MANY_SEP({
      SEP: PathSeparator,
      DEF: () => {
        this.SUBRULE(this.pathPart)
        this.OPTION(() =>
          this.OR([
            {ALT: () => this.SUBRULE(this.filterExpression)},
            {ALT: () => this.SUBRULE(this.method)}
          ]))
      }
    })
  })

  filterExpression = this.RULE("filterExpression", () => {
    this.OPTION(() => this.CONSUME(NotOperator))
    this.CONSUME(StartFilterExpression)
    this.OR([
      {ALT: () => this.SUBRULE(this.existsQuery)},
      {ALT: () => this.SUBRULE(this.filterQuery)}
    ])
  })

  filterQuery = this.RULE("filterQuery", () => {
    this.CONSUME(FilterValue)
    this.CONSUME(PathSeparator)
    this.SUBRULE(this.pathQuery)
  })

  existsQuery = this.RULE("existsQuery", () => {
    this.CONSUME(Exists)
    this.SUBRULE(this.rootQuery)
    this.CONSUME(MethodEnd)
  })

  booleanOperator = this.RULE("booleanOperator", () => {
    this.OR([
      {ALT: () => this.CONSUME(AndOperator)},
      {ALT: () => this.CONSUME(OrOperator)},
      {ALT: () => this.CONSUME(EqualsOperator)},
      {ALT: () => this.CONSUME(NotEqualsOperator)},
      {ALT: () => this.CONSUME(NotEqualsOperator2)},
      {ALT: () => this.CONSUME(GtOperator)},
      {ALT: () => this.CONSUME(LtOperator)},
      {ALT: () => this.CONSUME(GteOperator)},
      {ALT: () => this.CONSUME(LteOperator)},
      {ALT: () => this.CONSUME(NotOperator)}
    ])
  })

  arithmeticOperator = this.RULE("arithmeticOperator", () => {
    this.CONSUME(ArithmeticOperator)
  })

  pathPart = this.RULE("pathPart", () => {
    this.OR([
      {ALT: () => this.CONSUME(Identifier)},
      {ALT: () => this.CONSUME(Wildcard)}
    ])
    this.OPTION(() => this.SUBRULE(this.arrayAccessor))
  })

  arrayAccessor = this.RULE("arrayAccessor", () => {
    this.CONSUME(LeftSquareBracket)
    this.OR([
      {ALT: () => this.CONSUME(Wildcard)},
      {ALT: () => this.CONSUME(Integer)}
    ])
    this.CONSUME(RightSquareBracket)
  })
}
