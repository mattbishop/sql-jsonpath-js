# sql-jsonpath-js
JS implementation of the SQL JSONPath dialect, from SQL2016. SQL JSONPath takes much of it’s design from JSONPath which was created by Stefan Goessner. Stefan’s goal was to create a JSON version of XPath, an XML processing tool. SQL JSONPath has a smaller set of requirements that are mostly focused on finding and extracting data from JSON data columns. To this end, the expression language has been simplified from JSONPath to take advantage of database indexes. Additionally, the expressions have been reorganized to provide a more query-oriented experience.

Many databases have implemented this specification in their products. This project implements a javascript-native SQL JSON Path and brings the same features and expressions from the database in application code. One can use this package to search for matching data in local javascript values, much like one uses the Regexp library to search for matching text in string values.

While many JSON Path libraries are available to perform similar search tasks, they often includevariations on the JSONPath expression language that can make them incompatible with each other. SQL JSONPath has a published specification, and multiple implementations in database products. An application can adopt SQL JSONPath knowing it is supported by a stable standard.

### Expressions

SQL JSONPath expressions can match any form of JSON, including scalars, arrays and objects. The top level of a JSON structure starts with `$` and expressions progress their way down object properties and across arrays to reference fields and apply filtering query expressions.

Expressions have two sections; the navigation section and an optional filter section. The mode and filter sections are optional, which is indicated with a trailing `?` character. 

#### `<mode?> <navigation> ? <filter?>`

Here is an example expression:

`strict $.store.book[*].author ? (@ == "Evelyn Waugh" || @ == "Herman Mellville")`

#### Mode

Expressions can be evaluated in two modes: `strict` and `lax`, the default mode if omitted. The two modes have different behaviors for navigating to data properties.

1. Missing properties. Strict mode expects the navigation statement to reference existing properties and will throw an error if they are not present in the data. Lax mode will ignore missing properties and treat the situation as an unmatched path.
2. Arrays. If an operation expects an array, but the data value is not an array, lax mode will thread the value as a single-element array. Conversely if the operation does not expect an array, but encounters an array data value, it will be unnested and each value will be tested. In strict mode, either of these conditions results in an error.

#### Navigation

Navigation can utilize dot notation, such as `$.store.book[0]`

Navigation can also use bracket notation, such as `$["store"]["book"][0]`

Bracket notation must use double quotes instead of single quotes.

| Navigation Operator       | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `$`                       | The root element reference. May be an object, an array, or a scalar value |
| `.<name>` or `["<name>"]` | Child reference                                              |
| `*`                       | Wildcard references any child or array element               |
| `[<pos>]`                 | Array element reference                                      |
| `[<pos>, <pos>]`          | Comma-separated list of array element references             |
| `[<pos> to <pos>]`        | Array element range reference                                |
| `[last]`, `[last-1]`      | Last variable refers to the last element in the array and can be used as `<pos>` in array and can be modified with the subtraction (`-`) operator. |

At the completion of navigation, the values are represented as the `@` character in the filter section.

#### Filter

Filtering expressions come after the navigation expression. The two are separated by the `?` character. Filtering expressions look like javascript value tests, and one can use the `@` symbol as a reference to the navigation value, or values if the navigation lands on an array. In the case of an array, each value of the array is tested against the filter statement.

Predicates can be wrapped in parentheses `()` and internally combined with `&&` and `||` symbols. Their predicate result can be reversed with the `!` symbol. They utilize the `@` to reference the navigation value. For example:

`(@.name == "Marc Wu")`

| Predicate Operator | Description           |
| ------------------ | --------------------- |
| `==`               | Equal                 |
| `!=`               | Not Equal             |
| `>`                | Greater than          |
| `<`                | Less than             |
| `>=`               | Equal or greater than |
| `<=`               | Equal or less than    |

A predicate can transform the navigation data with arithmetic operators. These do not change the data directly, but can be used to modify the data to test in a filter expression.

- Unary: `+` and `-` change the sign of numeric values.
- Binary: `+`, `-`, `*`, `/` and `%` for addition, subtraction, multiplication, division and modulus.

Value functions offer ways to extract type information and apply mathematical functions before testing the value with predicate operators.

| Function                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `.type()`                | Returns `null`, `boolean`, `number`, `string`, `array`, `object` or `date` |
| `.size()`                | If `@` references an array, then it returns the number of elements in the array |
| `.double()`              | Converts a string to a numeric value                         |
| `.ceiling()`             | Round a numeric value up to the next largest integer         |
| `.floor()`               | Round a numeric value down to the next smallest integer      |
| `.abs()`                 | The absolute value of a numeric value                        |
| `.datetime("template"?)` | Converts a string into a Date object. The optional `template` is a quoted string. If omitted, the ISO-8601 pattern (built-in to Javascript) will be used to evaluate the string. The JSONPath spec does not specify this template format. Postgres formatting rules: https://www.postgresql.org/docs/14/functions-formatting.html#FUNCTIONS-FORMATTING-TABLE but other databases have different template formats. JS Joda time has a very capable parser using templates: https://js-joda.github.io/js-joda/  so we could specify a cross-platform simplification template dictionary. https://js-joda.github.io/js-joda/manual/formatting.html Use this and convert to Postgres variant at runtime? `h` is `HH12` and `H` is `HH24` in Postgres. |
| `.keyvalue()`            | Converts an object into an array of name/value objects: `[{name, value}, ...]` which allows a predicate to extract the key name and value |

Datetime template formatting symbols:





#### Predicate functions

A value can be tested for existence, and string values can be tested for prefixes and regular expression matches.

| Expression                                      | Description                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `exists ()`                                     | A value exists                                               |
| `is unknown`                                    | No value exists                                              |
| `starts with "<text>"`                          | Value starts with specified text                             |
| `like regex "regex-expression" flag? "<flags>"` | [XQuery](https://www.regular-expressions.info/xpath.html) regular expression. Have a look at [XRegexp](https://xregexp.com) |

Regex flags are optional, and change the pattern matching behavior.

* `i` case-insensitive mode.
* `s` single-line mode, or dot-all mode. Content, including newlines, is treated as a single line.
* `m` multi-line mode. `$` and `^` match newlines in the content in addition to the string as a whole.
* `x` free spaceing mode. Whitespace in the regex pattern is ignored, so if your regex is declared across multiple lines, the whitespace is removed before evaluation. One would use whitespace to improve the readability of larger regex patterns in source code. Without this mode, whitespace in the regex would be matched in the content.

### Examples

This example is taken from Stefan Goessner’s original JSONPath documentation. SQL JSONPath expressions have many similarities to Goessner’s JSONPath statements.

```json
{ "store": {
    "book": [ 
      { "category": "reference",
        "author": "Nigel Rees",
        "title": "Sayings of the Century",
        "price": 8.95
      },
      { "category": "fiction",
        "author": "Evelyn Waugh",
        "title": "Sword of Honour",
        "price": 12.99
      },
      { "category": "fiction",
        "author": "Herman Melville",
        "title": "Moby Dick",
        "isbn": "0-553-21311-3",
        "price": 8.99
      },
      { "category": "fiction",
        "author": "J. R. R. Tolkien",
        "title": "The Lord of the Rings",
        "isbn": "0-395-19395-8",
        "price": 22.99
      }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95
    }
  }
}
```

| JSONPath Expression      | Result                                |
| ------------------------ | ------------------------------------- |
| `$.store.book[*].author` | The authors of all books in the store |
|                          |                                       |
|                          |                                       |
|                          |                                       |
|                          |                                       |
|                          |                                       |
|                          |                                       |

