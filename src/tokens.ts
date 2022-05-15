import {createToken, Lexer} from "chevrotain";

export const Mode                   = createToken({name: "Mode", pattern: /lax|strict/})
export const ContextVariable        = createToken({name: "ContextVariable", pattern: "$"})
export const NamedVariable          = createToken({name: "NamedVariable", pattern: /\$[a-zA-Z]\w*/})

export const ItemMethod             = createToken({name: "ItemMethod", pattern: /\.(?:type|size|double|ceiling|floor|abs|datetime|keyvalue)\(\)/})
export const WildcardMember         = createToken({name: "WildcardMember", pattern: ".*"})
// first char is '.' so the rest can be the unicode ID character set
export const Member                 = createToken({name: "Member", pattern: /\.\p{ID_Start}\p{ID_Continue}*/u})


// arrays
export const WildcardArray          = createToken({name: "WildcardArray", pattern: /\[\*]/})
export const LeftSquareBracket      = createToken({name: "LeftSquareBracket", pattern: "["})
export const RightSquareBracket     = createToken({name: "RightSquareBracket", pattern: "]"})
export const Last                   = createToken({name: "Last", pattern: "last"})
export const To                     = createToken({name: "To", pattern: "to"})


// predicate
export const StartFilterExpression  = createToken({name: "StartFilterExpression", pattern: "?"})
export const FilterValue            = createToken({name: "FilterValue", pattern: "@"})
export const Exists                 = createToken({name: "Exists", pattern: "exists"})
export const LikeRegex              = createToken({name: "LikeRegex", pattern: "like_regex"})
export const Flag                   = createToken({name: "Flag", pattern: "flag"})
export const FlagValue              = createToken({name: "FlagValue", pattern: /"[imsq]{1,4}"/})
export const StartsWith             = createToken({name: "StartsWith", pattern: "starts with"})
export const IsUnknown              = createToken({name: "IsUnknown", pattern: "is unknown"})



// lexical
export const Comma                  = createToken({name: "Comma", pattern: ","})
// SQL JSON Path has stricter number declarations than JS. for instance, +10 is not legal, nor is 2. without a trailing 0.
export const Integer                = createToken({name: "Integer", pattern: /-?[1-9]\d*|0/})
export const Number                 = createToken({name: "Number", pattern: /(?:-?(?:0\.\d+|[1-9]\d*\.\d+|[1-9]\d*|0))(?:[eE]-?[1-9]\d*)?/})
export const StringLiteral          = createToken({name: "StringLiteral", pattern: /"(?:""|[^"])*"/})
export const PlusMinusOperator      = createToken({name: "PlusMinusOperator", pattern: /[+|-]/})
export const ArithmeticOperator     = createToken({name: "ArithmeticOperator", pattern: /[+\-*\/%]/})
export const DoubleVerticalBar      = createToken({name: "DoubleVerticalBar", pattern: "||"})
export const DoubleAmpersand        = createToken({name: "DoubleAmpersand", pattern: "&&"})
export const NotOperator            = createToken({name: "NotOperator", pattern: "!"})
export const ComparisonOperator     = createToken({name: "ComparisonOperator", pattern: /==|!=|<>|>=|<=|<|>/})
export const Null                   = createToken({name: "Null", pattern: "null"})
export const True                   = createToken({name: "True", pattern: "true"})
export const False                  = createToken({name: "False", pattern: "false"})
export const LeftParen              = createToken({name: "LeftParen", pattern: "("})
export const RightParen             = createToken({name: "RightParen", pattern: ")"})
export const Identifier             = createToken({name: "Identifier", pattern: /[_a-zA-Z]\w*/})

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  // may not be needed, but better to be explicit
  line_breaks: true,
  group: Lexer.SKIPPED
})

// not sure yet about identifier. Doesn't support unicode properly.
// I don't think these are needed any more
export const PathSeparator          = createToken({name: "PathSeparator", pattern: /\./})
export const Wildcard               = createToken({name: "Wildcard", pattern: /\*/})



// order matters when tokens start with the same matching characters
export const allTokens = [
  WhiteSpace,
  // "keywords" appear before the Identifier
  Mode,
  PlusMinusOperator,
  Exists,
  LikeRegex,
  Flag,
  FlagValue,
  // how is this going to work, with the whitespace?
  IsUnknown,
  StartsWith,
  To,
  Last,
  Null,
  True,
  False,
  ItemMethod,
  WildcardMember,
  // this one is after the other tokens that start with '.'
  Member,
  WildcardArray,
  // after wildcard array
  LeftSquareBracket,
  RightSquareBracket,
  // The Identifier must appear after the keywords because all keywords are valid identifiers.
  Identifier,
  Integer,
  Number,
  StringLiteral,
  ComparisonOperator,
  NotOperator,
  ContextVariable,
  NamedVariable,
  PathSeparator,
  Comma,
  Wildcard,
  ArithmeticOperator,
//  DoubleVerticalBar,
  DoubleAmpersand,
  LeftParen,
  RightParen,
  StartFilterExpression,
  FilterValue
]

