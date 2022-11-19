# SQL/JSONPath for JS

Javascript implementation of the SQL/JSONPath dialect, from SQL2016 which provides features to query data for elements that match an expression.

### Installation

This library supports both Common JS and EcmaScript module loading.

`npm install sql-jsonpath-js`

This library includes TypeScript definitions so TS developers do not need to install separate type definitions.

#### Usage

The UX is similar to Javascript’s RegExp class where one first compiles a SQL/JSONPath string into a `SqlJsonPathStatement` and then use that statement to examine data objects.

```typescript
import * as SJP from "sql-jsonpath-js"

// compile a statement
const statement = SJP.compile("$.name")

// data is an iterable of object values.
const data = [
  { name: "scripty" },
  { name: "readme" },
  { noName: true }
]

// exists() looks for matches and returns true or false for each data element.
const existsIterator = statement.exists(data)
console.log(Array.from(existsIterator))
// [ true, true, false ]

//query() looks for matches and returns the whole data element
const queryIterator = statement.query(data)
console.log(Array.from(queryIterator))
// [ { name: 'scripty' }, { name: 'readme' } ]

// values()
const valuesIterator = statement.values(data)
console.log(Array.from(valuesIterator))
// [ 'scripty', 'readme' ]
```

###### Iterators

 One important concept to note is that the SqlJsonPathStatement methods can consume single values, arrays, generators or other iterables. The statement’s methods all return an `Iterator`. These iterables are lazy, meaning they only advance through the data when `iterator.next()` is called.

This laziness means the statement can handle large, even limitless, amounts of data. The statement holds no accumulating state other than it’s position in the data. This design suits streaming data use cases and matches SQL’s result set and cursor concepts.

### About SQL/JSONPath

SQL/JSONPath takes much of its design from Stefan Goessner’s [ JSONPath](https://goessner.net/articles/JsonPath/index.html). Stefan’s goal was to create a JSON version of [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath), an XML processing tool. SQL/JSONPath has a smaller set of requirements that focus on finding and extracting data from JSON data columns. To this end, the expression language has been simplified from JSONPath to take advantage of database indexes. Additionally, the expressions have been reorganized to provide a more query-oriented experience.

Many databases have implemented this specification in their products. This project implements a javascript-native SQL/JSONPath and brings the same features and expressions from the database in application code. One can use this package to search for matching data in local javascript values, much like one uses the Regexp library to search for matching text in string values.

While many JSONPath libraries perform similar search tasks, they often include variations on the JSONPath expression language that make them incompatible with each other. SQL/JSONPath has a published specification, and multiple implementations in database products. An application can adopt SQL/JSONPath and gain the stability privided by a long-term standard.

### Expressions

SQL/JSONPath expressions can match any form of JSON, including scalars, arrays and objects. The top level of a JSON structure starts with `$` and expressions progress their way down object properties and across arrays to reference fields and apply filtering query expressions.

Expressions have three sections; the mode, the navigation statement and a filter expression. The mode and filter sections are optional. 

#### `<mode?> <navigation> ? <filter?>`

Here is an example expression:

`strict $.store.book[*].author ? (@ == "Evelyn Waugh" || @ == "Herman Mellville")`

#### Mode

Expressions can be evaluated in two modes: `strict` and `lax`, the default mode if omitted. The two modes have different behaviors for navigating to data properties.

1. **Missing properties:** Strict mode expects the navigation statement to reference existing properties and will throw an error if they are not present in the data. Lax mode will ignore missing properties and treat the situation as an unmatched path.
2. **Arrays:** If an operation expects an array, but the data value is not an array, lax mode treats the value as a single-element array. Conversely if the operation does not expect an array, but encounters an array, each array value will be tested. In strict mode, either of these conditions results in an error.

#### Navigation

Navigation can utilize dot notation, such as `$.store.book[0]`

Navigation can also use bracket notation, such as `$["store"]["book"][0]`

Bracket notation must use double quotes instead of single quotes.

| Navigation Operator | Description                                                                                                                                      |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `$`                 | The input element reference. May be an object, an array, or a scalar value.                                                                      |
| `.<name>`           | Member reference. Can be quoted for white space and other special characters, like `$."first name"`                                              |
| `*`                 | Wildcard references any member or array element. `[*]` selects all elements in an array, while `.*`selects all properties in an object.          |
| `[<pos>]`           | Array element reference. Can be a positive number, a member reference, or an arithmetic expression. The value of `pos` must resolve to a number. |
| `[<pos>, <pos>]`    | Comma-separated list of array element references. A reference list can contain any number of elements.                                           |
| `[<pos> to <pos>]`  | Array element range reference. Can be used as `<pos>` in list of element references.                                                             |
| `[last]`            | Variable that refers to the position of the last element in the array. Used as a `<pos>` element reference.                                      |

At the completion of navigation, the values are represented as the `@` character in the filter section. The @ reference may be a singleton value or a sequenceof values, like an array.

#### Filter

Filtering expressions come after the navigation expression. The two are separated by the `?` character. Filtering expressions look like javascript value tests, and one can use the `@` symbol as a reference to the navigation value, or sequence of values if the navigation lands on an array or a list of members (`.*`). In the case of a sequence, each value of the array is tested against the filter statement.

Predicates must be wrapped in parentheses `()` and can be internally combined with `&&` and `||` symbols. Their predicate result can be reversed with the `!` symbol. They utilize the `@` to reference the navigation value. For example:

`(@.name == "Marc Wu")`

| Predicate Operator | Description           |
|--------------------|-----------------------|
| `==`               | Equal                 |
| `!=`, `<>`         | Not Equal             |
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
| `.size()`                | If `@` references an array, then it returns the number of elements in the array. Otherwise returns 1. |
| `.double()`              | Converts a string to a numeric value                         |
| `.ceiling()`             | Round a numeric value up to the next largest integer         |
| `.floor()`               | Round a numeric value down to the next smallest integer      |
| `.abs()`                 | The absolute value of a numeric value                        |
| `.datetime("template"?)` | Converts a string into a Date object. The optional `template` is a quoted template string. If omitted, the ISO-8601 pattern (built into Javascript) will be used to evaluate the string. |
| `.keyvalue()`            | Converts an object into an array of name/value objects: `[[name, value], ...]` which allows a predicate to extract the key name and value. |

##### Datetime Template

Datetime template formatting uses the Luxon library internally. One can use the symbols as described in the docs:

https://moment.github.io/luxon/#/parsing?id=table-of-tokens

#### Predicate functions

A value can be tested for existence, and string values can be tested for prefixes and regular expression matches.

| Expression                                      | Description                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `exists ()`                                     | A value exists for the given predicate                       |
| `() is unknown`                                 | No value exists                                              |
| `starts with "<text>"`                          | Value starts with specified text                             |
| `like_regex "regex-expression" flag? "<flags>"` | Uses Javascript’s [Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) |

Regex flags are optional, and change the pattern matching behavior. See the [RegExp docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#advanced_searching_with_flags) for more information.

### Examples

This example is taken from Stefan Goessner’s original JSONPath documentation.

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
      "colour": "red",
      "price": 19.95
    }
  }
}
```

| JSONPath Expression                                        | Result                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `$.store.book[*].author`                                   | The authors of all books in the store                        |
| `$.store`                                                  | All the things in the store, which includes books and a bicycle |
| `$.store.book[2]`                                          | The third book in the store.                                 |
| `$.store.book[last]`                                       | The last book in the store                                   |
| `$.store.book[0,1,2]` or `$.store.book[0 to 2]`            | The first three books in the store                           |
| `$.store.book ? (exists(@.isbn))`                          | All books with an isbn                                       |
| `$.store.book ? (!exists(@.isbn))`                         | All books without an isbn                                    |
| `$.store.book.title ? (@ starts with "S")`                 | All books whose title starts with the letter “S”             |
| `$.store.bicycle ? (@.colour like_regex "^RED$" flag "i")` | All bicycles whose colour is “red”, case insensitive         |
| `$.store.book.price ? (@ > 10)`                            | All books whose price is > 10                                |
| `$.* ? (exists(@.book) || exists(@.bicycle)).*[*] ? (@.price > 10)` | All books and bicycles whose price > 10 |