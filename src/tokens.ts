import {createToken, Lexer} from "chevrotain";

// Declaration order matters
export const Wildcard               = createToken({name: "Wildcard", pattern: /\*/})
export const ContextItem            = createToken({name: "ContextItem", pattern: /\$/})
export const Lax                    = createToken({name: "Lax", pattern: /lax/})
export const Strict                 = createToken({name: "Strict", pattern: /strict/})
export const Identifier             = createToken({name: "Identifier", pattern: /[a-zA-Z]\w*/})
export const FilterValue            = createToken({name: "FilterValue", pattern: /@/})
export const PathSeparator          = createToken({name: "PathSeparator", pattern: /\./})
export const Comma                  = createToken({name: "Comma", pattern: /,/ })
export const StartFilterExpression  = createToken({name: "StartFilterExpression", pattern: /\?/})
export const Integer                = createToken({name: "Integer", pattern: /0|[1-9]\d*/ })
export const StringLiteral          = createToken({name: "StringLiteral", pattern: /".*"/})
export const LeftSquareBracket      = createToken({name: "LeftSquareBracket", pattern: /\[/})
export const RightSquareBracket     = createToken({name: "RightSquareBracket", pattern: /]/})
export const ArithmeticOperator     = createToken({name: "ArithmeticOperator", pattern: /[+\-*\/%]/})
export const EqualsOperator         = createToken({name: "BooleanOperator", pattern: /==/})
export const NotEqualsOperator      = createToken({name: "NotEqualsOperator", pattern: /!=/})
export const NotEqualsOperator2     = createToken({name: "NotEqualsOperator2", pattern: /<>/})
export const AndOperator            = createToken({name: "AndOperator", pattern: /&&/})
export const OrOperator             = createToken({name: "OrOperator", pattern: /\|\|/})
export const GtOperator             = createToken({name: "GtOperator", pattern: />/})
export const LtOperator             = createToken({name: "LtOperator", pattern: /</})
export const GteOperator            = createToken({name: "GteOperator", pattern: />=/})
export const LteOperator            = createToken({name: "LteOperator", pattern: /<=/})
export const NotOperator            = createToken({name: "NotOperator", pattern: /!/})
export const True                   = createToken({name: "True", pattern: /true/})
export const False                  = createToken({name: "False", pattern: /false/})
export const LeftParen              = createToken({name: "LeftParen", pattern: /\(/})
export const RightParen             = createToken({name: "RightParen", pattern: /\)/})
export const Exists                 = createToken({name: "Exists", pattern: /exists/})
export const To                     = createToken({name: "To", pattern: /to/})
export const Last                   = createToken({name: "Last", pattern: /last/})

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

export const allTokens = [
  WhiteSpace,
  // "keywords" appear before the Identifier
  Exists,
  To,
  Last,
  True,
  False,
  Lax,
  Strict,
  // The Identifier must appear after the keywords because all keywords are valid identifiers.
  Identifier,
  Integer,
  StringLiteral,
  NotEqualsOperator,
  NotEqualsOperator2,
  GteOperator,
  GtOperator,
  LteOperator,
  LtOperator,
  AndOperator,
  OrOperator,
  NotOperator,
  LeftSquareBracket,
  RightSquareBracket,
  ContextItem,
  PathSeparator,
  Comma,
  Wildcard,
  ArithmeticOperator,
  LeftParen,
  RightParen,
  StartFilterExpression,
  FilterValue
]

