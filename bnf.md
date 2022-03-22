# SQL/JSON Path BNF from “SQL/JSON part 2 - Querying JSON”

Found online at https://www.wiscorp.com/pub/DM32.2-2014-00025r1-sql-json-part-2.pdf

The BNF is broken into two parts–JSON Path expressions, and JSON Filter expressions.

### JSON Path Expressions

```
<JSON path expression> ::=
          <JSON path mode> <JSON path wff>
```


```
<JSON path mode> ::=
            strict 
          | lax 
```

```
<JSON path primary> ::=
            <JSON path literal>
          | <JSON path variable>
          | <left paren> <JSON path wff> <right paren>
```
Note: The atomic values in the SQL/JSON path language are written the same as in JSON, and are interpreted as if they were SQL values

```
<JSON path variable> ::=
            <JSON path context variable>
          | <JSON path named variable>
          | <at sign>
          | <JSON last subscript>
```

```
<JSON path context variable> ::= <dollar sign>
```

```
<JSON path named variable> ::=
            <dollar sign> <JSON path identifier>
```
Note: Identifiers are ECMAScript identifier names, but may not start with <dollar sign>


```
<JSON last subscript> ::=
          last
<JSON accessor expression> ::=
            <JSON path primary>
          | <JSON accessor expression> <JSON accessor op>
```

```
<JSON accessor op> ::=
            <JSON member accessor>
          | <JSON wildcard member accessor>
          | <JSON array accessor>
          | <JSON wildcard array accessor>
          | <JSON filter expression>
          | <JSON item method>
```

```
<JSON member accessor> ::=
            <period> <JSON path key name>
          | <period> <JSON path string literal>
```
NOTE: Unlike ECMAScript, SQL/JSON path language does not provide a member accessor using brackets that enclose a character string

```
<JSON wildcard member accessor> ::=
          <period> <asterisk>
```

```
<JSON array accessor> ::=
          <left bracket> <JSON subscript list> <right bracket>
```

```
<JSON subscript list> ::=
          <JSON subscript> [ { <comma> <JSON subscript> }... ]
```

```
<JSON subscript> ::=
            <JSON path wff>
          | <JSON path wff> to <JSON path wff>
```

```
<JSON wildcard array accessor> ::=
          <left bracket> <asterisk> <right bracket>
```

```
<JSON filter expression> ::=
          <question mark> <left paren> <JSON path predicate> <right paren>
```
NOTE: unlike ECMAScript, predicates are not expressions; instead they form a separate language that can only be invoked within a <JSON filter expression>.

```
<JSON item method> ::=
          <period> <JSON method>
```

```
<JSON method> ::=
            type <left paren> <right paren>
          | size <left paren> <right paren>
          | double <left paren> <right paren>
          | ceiling <left paren> <right paren>
          | floor <left paren> <right paren>
          | abs <left paren> <right paren>
          | datetime <left paren> <right paren>
          | keyvalue <left paren> <right paren>
```

```
<JSON unary expression> ::=
            <JSON accessor expression>
          | <plus sign> <JSON unary expression>
          | <minus sign> <JSON unary expression>
```

```
<JSON multiplicative expression> ::=
            <JSON unary expression>
          | <JSON multiplicative expression> <asterisk> <JSON unary expression>
          | <JSON multiplicative expression> <solidus> <JSON unary expression>
          | <JSON multiplicative expression> <percent> <JSON unary expression>
```

```
<JSON additive expression> ::=
            <JSON multiplicative expression>
          | <JSON additive expression> <plus sign> <JSON multiplicative expression>
          | <JSON additive expression> <minus sign> <JSON multiplicative expression>
```

```
<JSON path wff> ::= <JSON additive expression>
```
NOTE: this concludes the main language for JSON path expressions. Next comes the language for predicates, used only in <JSON filter expression>.



### JSON Filter Expressions

```
<JSON predicate primary> ::=
            <JSON delimited predicate>
          | <JSON non-delimited predicate>
```

```
<JSON delimited predicate> ::=
            <JSON exists path predicate>
          | <left paren> <JSON path predicate> <right paren>
```

```
<JSON non-delimited predicate> ::=
            <JSON comparison predicate>
          | <JSON like_regex predicate>
          | <JSON starts with predicate>
          | <JSON unknown predicate>
```

```
<JSON exists path predicate> ::=
          exists <left paren> <JSON path wff> <right paren>
```

```
<JSON comparison predicate> ::=
          <JSON path wff> <JSON comp op> <JSON path wff>
```
NOTE: comparison operators are not left associative, unlike ECMAScript.

```
<JSON comp op> ::=
            <double equals>
          | <not equals operator>
          | <less than operator>
          | <greater than operator>
          | <less than or equals operator>
          | <greater than or equals operator>
```
NOTE nnn: equality operators have the same precedence as inequality comparision operators, unlike ECMAScript.

```
<JSON like_regex predicate> ::=
          <JSON path wff> like_regex <JSON like_regex pattern> [ flag <JSON like_regex flags> ]
```

```
<JSON like_regex pattern> ::= <JSON path string literal>
```

```
<JSON like_regex flag> ::= <JSON path string literal>
```

```
<JSON starts with predicate> ::=
          <JSON starts with whole> starts with <JSON starts with initial>
```

```
<JSON starts with whole> ::= <JSON path wff>
```

```
<JSON starts with initial> ::=
            <JSON path string literal>
          | <JSON path named variable>
```

```
<JSON unknown predicate> ::=
          <right paren> <JSON path predicte> <left paren> is unknown
```

```
<JSON boolean negation> ::=
            <JSON predicate primary>
          | <exclamation mark> <JSON delimited predicate>
```

```
<JSON boolean conjunction> ::=
            <JSON boolean negation>
          | <JSON boolean conjunction> <double ampersand> <JSON boolean negation>
```

```
<JSON boolean disjunction> ::=
            <JSON boolean conjunction>
          | <JSON boolean disjunction> <double vertical bar> <JSON boolean conjunction>
```

```
<JSON path predicate> ::=
          <JSON boolean disjunction>
```

### Lexical Elements

```
<SQL/JSON special symbol> ::=
            <asterisk>
          | <at sign>
          | <comma>
          | <dollar sign>
          | <double ampersand>
          | <double equals>
          | <double vertical bar>
          | <exclamation mark>
          | <greater than operator>
          | <greater than or equals operator>
          | <left bracket>
          | <left paren>
          | <less than operator>
          | <less than or equals operator>
          | <minus sign>
          | <not equals operator>
          | <percent>
          | <period>
          | <plus sign>
          | <question mark>
          | <right bracket>
          | <right paren>
          | <solidus>
```

```
<at sign> ::= @

<dollar sign> ::= $

<double ampersand> ::= &&

<double equals> ::= ==

<double vertical bar> ::= ||

<exclamation mark> ::= !
```

```
<SQL/JSON key word> ::=
            abs
          | ceiling
          | datetime
          | double
          | exists
          | false
          | flag
          | floor
          | is
          | keyvalue
          | last
          | lax
          | like_regex
          | null
          | size
          | starts
          | strict
          | to
          | true
          | type
          | unknown
          | with
```

```
<JSON path literal> ::= !! see Syntax Rules

<JSON path string literal> ::= !! see Syntax Rules

<JSON path numeric literal> ::= !! see Syntax Rules

<JSON path identifier> ::= !! See the Syntax Rules

<JSON path context variable> ::= !! See the Syntax Rules

<JSON path named variable> ::= !! See the Syntax Rules

<JSON path key name> ::= !! See the Syntax Rules
```

#### Syntax Rules
1) SQL/JSON path language adopts the conventions in ECMAScript section 6 “Source text” regarding the source text of an SQL/JSON path expression, and escape sequences used in that source text.
2) SQL/JSON path language adopts the lexical rules of ECMAScript section 5.1.2 “Lexical and RegExp grammars” and section 7 “Lexical conventions”, with the following modifications:
   1. The only goal symbol is InputElementDiv (modifies section 7 “Lexical conversions” paragraph 2).
   2. there are no comments (modifies section 7.4 “Comments”)
   3. there are no reserved words (modifies section 7.6.1 “Reserved words”)
   4. NOTE: lexcially, the only issue is whether a token that matches an <SQL/ JSON key word> is a <JSON path member name> or in fact a key word. This can be decided from the observation that a <JSON path member name> cannot be followed by a <left paren>.
   5. the following are additional punctuators: @ (modifies section 7.7 “Punctuators”)
   6. there are no HexIntegerLiteral (modifies 7.8.3 “Numeric literals”)
   7. there are no RegularExpressionLiteral. (modifies section 7.8.5 “Regular expression literals”) NOTE: SQL/JSON path language uses SQL regular expressions in the <JSON like_regex predicate>, not ECMAScript regular expressions.
   8. There is no automatic semicolon insertion (modifies section 7.9 “Automatic semicolon insertion”)
   9. NOTE: It follows that SQL/JSON path language is case-sensitive in both identifiers and key words. Unlike SQL, there are no “quoted” identifiers, and there is no automatic conversion of any identifiers to uppercase.
3) SQL/JSON grammar is stated with BNF non-terminals enclosed in angle brackets < >. The following corrrespondences between SQL/JSON BNF non-terminals and ECMAScript BNF non-terminals applies:

   | SQL/JSON Path | ECMAScript |
   | ------------- | ---------- |
   | <JSON path literal> | Literal |
   | <JSON path numeric literal> | NumericLiteral |
   | <JSON path string literal> | StringLiteral |
   | <JSON path identifier> | Identifier |

4) A <JSON path identifier> is classified as follows: Case:
   1. A <JSON path identifier> that is a <dollar sign> is a <JSON path context variable>.
   2. A <JSON path identifier> that begins with a <dollar sign> is a <JSON path named variable>.
   3. Otherwise, a <JSON path identifier> is a <JSON path key name>.
5) The value of a <JSON path literal> is determined as follows:
   4. The value of a <JSON path numeric literal> JPNL is the value of the <signed numeric literal> whose characters are identical to JPNL.
   5. The value of a <JSON path string literal> JPSL is an SQL character string whose character set is Unicode and whose characters are the ones enclosed by single or double quotation marks (but excluding these delimiters) in JPSL after replacing any escape sequences by their unescaped equivalents.
   6. The value of null is the SQL/JSON null.
   7. The value of true is True.
   8. The value of false is False.