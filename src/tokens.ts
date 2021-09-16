import {createToken, Lexer} from "chevrotain";

export const Wildcard = createToken({name: "Wildcard", pattern: /\*/})

export const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z]\w*/ })

export const ObjectRoot = createToken({name: "Root", pattern: /\$/})

export const FilterValue = createToken({name: "FilterValue", pattern: /@/})

export const PathSeparator = createToken({name: "PathSeparator", pattern: /\./})

export const Comma = createToken({ name: "Comma", pattern: /,/ })

export const StartFilterExpression = createToken({ name: "StartFilterExpression", pattern: /\?\(/ })

export const Integer = createToken({ name: "Integer", pattern: /0|[1-9]\d*/ })

export const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ })

export const LessThan = createToken({ name: "LessThan", pattern: /</ })

export const LeftSquareBracket = createToken({name: "LeftSquareBracket", pattern: /\[/})

export const RightSquareBracket = createToken({name: "RightSquareBracket", pattern: /]/})

export const ArithmeticOperator = createToken({name: "ArithmeticOperator", pattern: /[+\-*\/%]/})

export const EqualsOperator = createToken({name: "BooleanOperator", pattern: /==/})

export const NotEqualsOperator = createToken({name: "NotEqualsOperator", pattern: /!=/})

export const NotEqualsOperator2 = createToken({name: "NotEqualsOperator2", pattern: /<>/})

export const AndOperator = createToken({name: "AndOperator", pattern: /&&/})

export const OrOperator = createToken({name: "OrOperator", pattern: /\|\|/})

export const GtOperator = createToken({name: "GtOperator", pattern: />/})

export const LtOperator = createToken({name: "LtOperator", pattern: /</})

export const GteOperator = createToken({name: "GteOperator", pattern: />=/})

export const LteOperator = createToken({name: "LteOperator", pattern: /<=/})

export const NotOperator = createToken({name: "NotOperator", pattern: /!/})

export const True = createToken({name: "True", pattern: /true/})

export const False = createToken({name: "False", pattern: /false/})

export const MethodStart = createToken({name: "MethodStart", pattern: /\(/})

export const MethodEnd = createToken({name: "MethodEnd", pattern: /\)/})

export const Exists = createToken({name: "Exists", pattern: /exists/})

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

export const allTokens = [
  WhiteSpace,
  // "keywords" appear before the Identifier
  Exists,
  True,
  False,
  // The Identifier must appear after the keywords because all keywords are valid identifiers.
  Identifier,
  Integer,
  GreaterThan,
  LessThan,
  LeftSquareBracket,
  RightSquareBracket,
  ObjectRoot,
  PathSeparator,
  Comma,
  Wildcard,
  ArithmeticOperator,
  MethodStart,
  MethodEnd,
  StartFilterExpression,
  FilterValue
]

