import {CustomPatternMatcherReturn, ITokenConfig} from "@chevrotain/types"
import {createToken, Lexer, TokenType} from "chevrotain"

/** @internal */
export const Mode                   = createToken({name: "Mode", pattern: /lax|strict/})
/** @internal */
export const ContextVariable        = createToken({name: "ContextVariable", pattern: "$"})
// Named Variables match SQL standard for alias names.
/** @internal */
export const NamedVariable          = createToken({name: "NamedVariable", pattern: /\$(?:[a-zA-Z][\w#@$]{0,255})+/})
/** @internal */
export const WildcardMember         = createToken({name: "WildcardMember", pattern: /\.\s*\*/})

/** @internal */
export const DatetimeMethod = createRegexToken({
  name:             "DatetimeMethod",
  pattern:          /\.\s*datetime\s*\(\s*("[^"]+")?\s*\)/y,
  start_chars_hint: ["."]
})

/** @internal */
export const ItemMethod = createRegexToken({
  name:             "ItemMethod",
  pattern:          /\.\s*(type|size|double|ceiling|floor|abs|keyvalue)\s*\(\s*\)/y,
  start_chars_hint: ["."]
})

/*
  <JSON member accessor> ::=
            <period> <JSON path key name>
          | <period> <JSON path string literal>
 */
/** @internal */
export const Member = createRegexToken({
  name:             "Member",
  // quoted string pattern identical to StringLiteral
  pattern:          /\.\s*(?:(\p{ID_Start}\p{ID_Continue}*)|"((?:[^"\\\p{Cc}]+|(?:\\(?:["\\/bfnrt]|u[a-fA-F\d]{4})))*)")/uy,
  start_chars_hint: ["."]
})


// arrays
/** @internal */
export const WildcardArray    = createToken({name: "WildcardArray", pattern: /\[\s*\*\s*]/})
/** @internal */
export const LeftBracket      = createToken({name: "LeftBracket", pattern: "["})
/** @internal */
export const RightBracket     = createToken({name: "RightBracket", pattern: "]"})
/** @internal */
export const Last             = createToken({name: "Last", pattern: "last"})
// Spec calls for whitespace
/** @internal */
export const To               = createToken({name: "To", pattern: /\sto\s/})


// filter expressions
/** @internal */
export const FilterStart      = createToken({name: "FilterStart", pattern: /\?\s?\(/})
/** @internal */
export const FilterValue      = createToken({name: "FilterValue", pattern: "@"})
// Spec calls for whitespace
/** @internal */
export const Exists           = createToken({name: "Exists", pattern: "exists"})
/** @internal */
export const LikeRegex        = createToken({name: "LikeRegex", pattern: /\slike_regex/})
/** @internal */
export const Flag             = createToken({name: "Flag", pattern: /\sflag/})
// Spec calls for whitespace
/** @internal */
export const StartsWith       = createToken({name: "StartsWith", pattern: /\sstarts\s+with/})
// Spec calls for whitespace
/** @internal */
export const IsUnknown        = createToken({name: "IsUnknown", pattern: /\sis\s+unknown/})



// lexical
/** @internal */
export const Comma            = createToken({name: "Comma", pattern: ","})
/** @internal */
export const NullLiteral      = createToken({name: "Null", pattern: "null"})
/** @internal */
export const BooleanLiteral   = createToken({name: "Boolean", pattern: /true|false/})
// SQL JSON Path has a stricter number pattern than JS. for instance, +10 is not legal, nor is '2.' without a trailing '0'.
/** @internal */
export const NumberLiteral    = createToken({name: "Number", pattern: /-?(?:0(?:\.\d+)?|[1-9]\d*(?:\.\d+)?)(?:[eE]-?[1-9]\d*)?/})
// JSON string pattern, using unicode; {Cc} character class defined: https://www.regular-expressions.info/unicode.html#category
/** @internal */
export const StringLiteral    = createRegexToken({
  name:             "String",
  pattern:          /"((?:[^"\\\p{Cc}]+|(?:\\(?:["\\/bfnrt]|u[a-fA-F\d]{4})))*)"/uy,
  start_chars_hint: ["\""]
})

/** @internal */
export const UnaryOperator          = createToken({name: "UnaryOp", pattern: /[+-]/})
/** @internal */
export const BinaryOperator         = createToken({name: "BinaryOp", pattern: /[*\/%]/})
/** @internal */
export const AndOperator            = createToken({name: "AndOp", pattern: "&&"})
/** @internal */
export const OrOperator             = createToken({name: "OrOp", pattern: "||"})
/** @internal */
export const NotOperator            = createToken({name: "NotOp", pattern: "!"})
/** @internal */
export const ComparisonOperator     = createToken({name: "CompOp", pattern: /==|!=|>=|<=|<>|<|>/})
/** @internal */
export const LeftParen              = createToken({name: "LeftParen", pattern: "("})
/** @internal */
export const RightParen             = createToken({name: "RightParen", pattern: ")"})

/** @internal */
export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
})


// order matters when tokens start with the same matching characters
/** @internal */
export const allTokens = [
  Mode,
  Exists,
  LikeRegex,
  Flag,
  IsUnknown,
  StartsWith,
  To,
  Last,
  NullLiteral,
  BooleanLiteral,
  NumberLiteral,
  StringLiteral,
  UnaryOperator,
  BinaryOperator,
  ItemMethod,
  DatetimeMethod,
  WildcardMember,
  Member,
  WildcardArray,
  LeftBracket,
  RightBracket,
  ComparisonOperator,
  NotOperator,
  NamedVariable,
  ContextVariable,
  Comma,
  AndOperator,
  OrOperator,
  LeftParen,
  RightParen,
  FilterStart,
  FilterValue,
  WhiteSpace // not used in any rules; ignored
]


// Used to create Tokens with Regex patterns that Chevrotain cannot handle, like unicode patterns.
function createRegexToken(configIn: ITokenConfig): TokenType {
  const {pattern: regex, ...config} = configIn
  if (!(regex instanceof RegExp)) {
    throw new Error(`pattern must be a regular expression: ${JSON.stringify(regex)}`)
  }
  if (!regex.flags.includes("y")) {
    throw new Error(`regex must be sticky ("y" flag): ${regex.source}`)
  }
  return createToken({
    ...config,
    pattern: (text, offset) => {
      regex.lastIndex = offset
      const m = regex.exec(text)
      if (m && m.length > 1) {
        (m as unknown as CustomPatternMatcherReturn).payload = m.slice(1)
      }
      return m
    },
    line_breaks: false
  })
}
