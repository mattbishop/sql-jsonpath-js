import {CustomPatternMatcherReturn, ITokenConfig} from "@chevrotain/types"
import {createToken, Lexer, TokenType} from "chevrotain"

export const Mode                   = createToken({name: "Mode", pattern: /lax|strict/})
export const ContextVariable        = createToken({name: "ContextVariable", pattern: "$"})
// Named Variables match SQL standard for alias names.
export const NamedVariable          = createToken({name: "NamedVariable", pattern: /\$(?:[a-zA-Z][\w#@$]{0,255})+/})
export const WildcardMember         = createToken({name: "WildcardMember", pattern: /\.\s*\*/})

export const DatetimeMethod = createRegexToken({
  name:             "DatetimeMethod",
  pattern:          /\.\s*datetime\s*\(\s*("[^"]+")?\s*\)/y,
  start_chars_hint: ["."]
})

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
export const Member = createRegexToken({
  name:             "Member",
  // quoted string pattern identical to StringLiteral
  pattern:          /\.\s*(?:(\p{ID_Start}\p{ID_Continue}*)|"((?:[^"\\\p{Cc}]+|(?:\\(?:["\\/bfnrt]|u[a-fA-F\d]{4})))*)")/uy,
  start_chars_hint: ["."]
})


// arrays
export const WildcardArray    = createToken({name: "WildcardArray", pattern: /\[\s*\*\s*]/})
export const LeftBracket      = createToken({name: "LeftBracket", pattern: "["})
export const RightBracket     = createToken({name: "RightBracket", pattern: "]"})
export const Last             = createToken({name: "Last", pattern: "last"})
// Spec calls for whitespace
export const To               = createToken({name: "To", pattern: /\sto\s/})


// filter expressions
export const FilterStart      = createToken({name: "FilterStart", pattern: /\?\s?\(/})
export const FilterValue      = createToken({name: "FilterValue", pattern: "@"})
// Spec calls for whitespace
export const Exists           = createToken({name: "Exists", pattern: "exists"})
export const LikeRegex        = createToken({name: "LikeRegex", pattern: /\slike_regex\s/})
export const Flag             = createToken({name: "Flag", pattern: /\sflag\s/})
// Spec calls for whitespace
export const StartsWith       = createToken({name: "StartsWith", pattern: /\sstarts\s+with/})
// Spec calls for whitespace
export const IsUnknown        = createToken({name: "IsUnknown", pattern: /\sis\s+unknown/})



// lexical
export const Comma            = createToken({name: "Comma", pattern: ","})
export const NullLiteral      = createToken({name: "Null", pattern: "null"})
export const BooleanLiteral   = createToken({name: "Boolean", pattern: /true|false/})
// SQL JSON Path has a stricter number pattern than JS. for instance, +10 is not legal, nor is '2.' without a trailing '0'.
export const NumberLiteral    = createToken({name: "Number", pattern: /-?(?:0(?:\.\d+)?|[1-9]\d*(?:\.\d+)?)(?:[eE]-?[1-9]\d*)?/})
// JSON string pattern, using unicode; {Cc} character class defined: https://www.regular-expressions.info/unicode.html#category
export const StringLiteral    = createRegexToken({
  name:             "String",
  pattern:          /"((?:[^"\\\p{Cc}]+|(?:\\(?:["\\/bfnrt]|u[a-fA-F\d]{4})))*)"/uy,
  start_chars_hint: ["\""]
})

export const UnaryOperator          = createToken({name: "UnaryOp", pattern: /[+-]/})
export const BinaryOperator         = createToken({name: "BinaryOp", pattern: /[*\/%]/})
export const AndOperator            = createToken({name: "AndOp", pattern: "&&"})
export const OrOperator             = createToken({name: "OrOp", pattern: "||"})
export const NotOperator            = createToken({name: "NotOp", pattern: "!"})
export const ComparisonOperator     = createToken({name: "CompOp", pattern: /==|!=|>=|<=|<>|<|>/})
export const LeftParen              = createToken({name: "LeftParen", pattern: "("})
export const RightParen             = createToken({name: "RightParen", pattern: ")"})

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
})


// order matters when tokens start with the same matching characters
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
