# SQL/JSONPath for JS

Javascript implementation of the SQL/JSONPath dialect, from SQL2016 which provides features to query data for elements that match an expression.

### Installation

This library supports EcmaScript module loading (ESM).

`npm install sql-jsonpath-js`

This library includes TypeScript definitions so TS developers do not need to install separate type definitions.

#### Usage

The UX is similar to Javascript’s RegExp class where one first compiles a SQL/JSONPath string into a `SqlJsonPathStatement` and then use that statement to examine data objects. The statement can be reused.

A SQL/JSONPath for JS (SJP) statement has two operations to work with JS values. One can use `statement.exists(value)` to test if the statement matches a value, while data can be extracted from a larger value using the `statement.values(value)` method.

#### The `exists()` Method

The method input is a single value, like a string, an object, or an array. The statement will test the value and return true if the statement matches the value. The input can also be an iterable or iterator. In that case the statement will emit an iterable that tests each element in the iterator and emits the result of the test.

```javascript
import * as sjp from "sql-jsonpath-js"

// compile a statement
const statement = sjp.compile('$.name')

const hasName = { name: "scripty" },
      noName = { noName: true }

// exists() looks for matches and returns true or false for each data element.
console.info(statement.exists(hasName))
// true

console.info(statement.exists(noName))
// false

// It can also consume iterators of values and return an iterator with the result of each exists test.
const existsIterator = [hasName, noName][Symbol.iterator]()
console.info(Array.from(statement.exists(existsIterator)))
// [true, false]
```

#### The `values()` Method

Inputs can be either iterators of data or single data elements, as the example below shows, but the result is an iterator. A utility function `one()` provides a simple way to extract a single result from this iterator.

```javascript
/// ... continuing with the statement and values declared in the exists() example
// values()
let valuesIterator = statement.values(hasName)
console.info(sjp.one(valuesIterator))
// 'scripty'

valuesIterator = statement.values(noName)
console.info(sjp.one(valuesIterator))
// null

// Can pass in an array of values too:

valuesIterator = statement.values([hasName, noName])
console.info(Array.from(valuesIterator))
// ['scripty']
```

#### Iterators

SqlJsonPathStatement methods can consume iterables, generators or other iterable input. The statement will return an iterator of results for iterable inputs. These returned iterators are lazy, meaning they only advance through the data when `iterator.next()` is called.

This laziness means the statement can handle large, even limitless, amounts of data. The statement holds no accumulating state other than it’s position in the data. This design suits streaming data use cases and matches SQL’s result set and cursor concepts.

Array input values are treated a single object to be examined. If one wants an array value to be treated as an iterable input, call it’s iterator symbol `[Symbol.iterator]()` to produce an iterator over the array:

```javascript
const statement = sjp.compile('$ ? (@.size() > 3)')

const data = [5, 65, 322, 78]

const singleResult = statement.exists(data)
console.info(Array.from(singleResult))
// input is a single value array, so statement examines 'data' as a single element
// [true]

const iteratedResult = statement.exists(data[Symbol.iterator]())
console.info(Array.from(iteratedResult))
// data is an interable, so statement iterates through the elements and applies the statement
// [false, false, false, false]
```

#### Default Values

A statement will return an empty iterator if no matches are found in the input data. In this case, one can tell the statement to return a default value on an empty match. The second parameter of all statement methods take a configuration object where these defaults are declared.

```javascript
const statement = sjp.compile('$ ? (@.startsWith("Z"))')
const resultIterator = statement.values("A value that does not match", {defaultOnEmpty: "MISSING"})
console.info(sjp.one(resultIterator))
// 'MISSING'
```

Similarly, if a statement match throws an error, as can happen in `strict` mode, the statement can return a default value:

```javascript
const statement = sjp.compile('strict $.name ? (@.startsWith("Z"))')
const resultIterator = statement.values({noName: true}, {defaultOnError: "NO NAME FOUND"})
console.info(sjp.one(resultIterator))
// 'NO NAME FOUND'
```

Default values can be of any type and do not have to match the input data types. Both `defaultOnEmpty` and `defaultOnError` can be specified in the same statement execution so that defaults will be provided when an Error occurs as well as when an empty match occurs.

#### Named Variables

SQL/JSONPath statements can include named variables that are supplied during execution. This makes statements reusable for different data values to match. In statements, named variables begin with `$` in the string, but the named variable configuration does not use the beginning `$`.

```javascript
const statement = sjp.compile('strict $.name ? (@ == $inputName)')
const result = statement.exists({name: "Jeremy"}, {variables: {inputName: "Jeremy"}})
console.info(result)
// true

const anotherResult = statement.exists({name: "Mika"}, {variables: {inputName: "Lau"}})
console.info(anotherResult)
// false
```

### SqlJsonPathStatement API Reference

The `compile(sjpText)` method parses the SQL/JSONPath text and compiles it into a reusable `SqlJsonPathStatement` object. The `compile` step is fast, but reusing compiled statements is much faster. One can use named Variables to reuse statements across different data sets and use cases.

SJP has a `one(iterator)` convenience method to pull one value from the iterator. Useful for when code only expects a single value, or when the iterator is consumed outside a for..of loop.

#### Method Parameters

All statement methods share the same method parameters.

| Param    | Details                                                                                                                                                                                               |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `input`  | The data to examine. Can be a single value, an array of values, an iterable collection, a generator or anything that supplies an `Iterable` or `Iterator`. Cannot consume `Async` iterables, however. |
| `config` | Optional, configures the method call with named variables and default values.                                                                                                                         |

##### Config Object

All methods can accept a config object to fulfill the statement or change its behaviour. Each field in the config object is optional, except for `variables` when a statement contains references to named variables.

| Field            | Details                                                                                                                                                                                                                                                                                                                                                                                                                              |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `variables`      | An object containing the named variable values for this method call. Object keys match the named variables in the statement, which uses the associated value in evaluation. **Note:** Key names should not start with `$` as they do in the SQL/JSONPath text. For instance, `$ ? (@ == $thing)` has a named variable `$thing`. Pass `{thing: 2}` as `variables` to the statement to substitute `2` for `$thing` in the method call. |
| `defaultOnEmpty` | An input element may not match the statement, which is considered an “empty” match. Normally, empty matches are filtered out of the result iterator. Use this field to emit a default value for these empty matches so that it will be seen in the iterator. Default values can be of any type, such as `"N/A"`,  `{}` or `0`.                                                                                                       |
| `defaultOnError` | In strict mode, an input element may trigger a structural Error ([see Mode](#mode)). This property will change the method’s behaviour to return this default value instead of throwing an error. Default values can be of any type, such as `"MISSING"`,  `{}` or `false`.                                                                                                                                                           |

#### Statement Methods

##### `exists(input, config?) => boolean | IterableIterator<boolean>` 

Tests the statement against the input and emits `true` if the statement finds a match and `false` otherwise.

##### `values(input, config?) => IterableIterator` 

Scans the input elements and emits matched values from within the elements. This method extracts matches across all elements in the input into a single iterator result.

### SQL/JSONPath Language

SQL/JSONPath takes much of its design from Stefan Goessner’s [ JSONPath](https://goessner.net/articles/JsonPath/index.html). Stefan’s goal was to create a JSON version of [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath), an XML processing tool. SQL/JSONPath has a smaller set of requirements that focus on finding and extracting data from JSON data columns. To this end, the expression language has been simplified from JSONPath to take advantage of database indexes. Additionally, the expressions have been reorganized to provide a more query-oriented experience.

Many databases have implemented this specification in their products. This project implements a javascript-native SQL/JSONPath and brings the same features and expressions from the database in application code. One can use this package to search for matching data in local javascript values, much like one uses the Regexp library to search for matching text in string values.

While many JSONPath libraries perform similar search tasks, they often include variations on the JSONPath expression language that make them incompatible with each other. SQL/JSONPath has a published specification, and multiple implementations in database products. An application can adopt SQL/JSONPath and gain the stability provided by a long-term standard.

#### Statements

SQL/JSONPath statements can match any form of JSON, including scalars, arrays and objects. The top level of a JSON structure starts with `$` and navigate their way down object properties and across arrays to reference fields and apply filtering predicates.

Statements have three sections; the mode, the navigation expression and filter predicates. The mode and filter sections are optional. 

#### `<mode?> <expression> ? <filter?>...`

Here is an example statement:

`strict $.store.book[*].author ? (@ == "Evelyn Waugh" || @ == "Herman Mellville")`

#### Mode

Statements can be evaluated in two modes: `strict` and `lax`, the default mode if omitted. The two modes have different behaviors for navigating to data properties.

1. **Missing properties:** Strict mode expects the navigation statement to reference existing properties and will throw an error if they are not present in the data. Lax mode will ignore missing properties and treat the situation as an unmatched path.
2. **Arrays:** If an operation expects an array, but the data value is not an array, lax mode treats the value as a single-element array. Conversely, if the operation does not expect an array, but encounters an array, each array value will be tested. In strict mode, either of these conditions results in an error.

#### Expressions

Expressions can utilize dot notation, such as `$.store.book[0]`. They can also use bracket notation, such as `$["store"]["book"][0]`. Bracket notation must use double quotes instead of single quotes.

| Navigation Operator | Description                                                                                                                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `$`                 | The input element reference. May be an object, an array, or a scalar value.                                                                                        |
| `$<name>`           | A named variable reference. May be an object, an array or a scalar value. The name can be any legal JS variable name, except it cannot start with a `$` character. |
| `.<name>`           | Member reference. Can be quoted for white space and other special characters, like `$."first name"`                                                                |
| `*`                 | Wildcard references any member or array element. `[*]` selects all elements in an array, while `.*`selects all properties in an object.                            |
| `[<pos>]`           | Array element reference. Can be a positive number, a member reference, or an arithmetic expression. The value of `pos` must resolve to a number.                   |
| `[<pos>, <pos>]`    | Comma-separated list of array element references. A reference list can contain any number of elements.                                                             |
| `[<pos> to <pos>]`  | Array element range reference. Can be used as `<pos>` in list of element references.                                                                               |
| `[last]`            | Variable that refers to the position of the last element in the array. Used as a `<pos>` element reference.                                                        |

At the completion of navigation, the values are represented as the `@` character in the filter section. The @ reference may be a singleton value or a sequenceof values, like an array.

#### Filters

Filtering predicates come after the navigation expression. The two are separated by the `?` character. Filtering expressions look like javascript value tests, and one can use the `@` symbol as a reference to the navigation value, or sequence of values if the navigation lands on an array or a list of members (`.*`). In the case of a sequence, each value of the array is tested against the filter statement.

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

| Function                 | Description                                                                                                                                                                              |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `.type()`                | Returns `null`, `boolean`, `number`, `string`, `array`, `object` or `date`                                                                                                               |
| `.size()`                | If `@` references an array, then it returns the number of elements in the array. Otherwise returns 1.                                                                                    |
| `.double()`              | Converts a string to a numeric value                                                                                                                                                     |
| `.ceiling()`             | Round a numeric value up to the next largest integer                                                                                                                                     |
| `.floor()`               | Round a numeric value down to the next smallest integer                                                                                                                                  |
| `.abs()`                 | The absolute value of a numeric value                                                                                                                                                    |
| `.datetime("template"?)` | Converts a string into a Date object. The optional `template` is a quoted template string. If omitted, the ISO-8601 pattern (built into Javascript) will be used to evaluate the string. |
| `.keyvalue()`            | Converts an object into an array of name/value objects: `[[name, value], ...]` which allows a predicate to extract the key name and value.                                               |

##### Datetime Template

Datetime template formatting uses the Luxon library internally. One can use the symbols as described in the docs:

https://moment.github.io/luxon/#/parsing?id=table-of-tokens

#### Predicate Functions

A value can be tested for existence, and string values can be tested for prefixes and regular expression matches.

| Expression                                      | Description                                                                                                                |
|-------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `exists ()`                                     | A value exists for the given predicate                                                                                     |
| `() is unknown`                                 | No value exists                                                                                                            |
| `starts with "<text>"`                          | Value starts with specified text                                                                                           |
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

| JSONPath Expression                                                   | Result                                                          |
|-----------------------------------------------------------------------|-----------------------------------------------------------------|
| `$.store.book[*].author`                                              | The authors of all books in the store                           |
| `$.store`                                                             | All the things in the store, which includes books and a bicycle |
| `$.store.book[2]`                                                     | The third book in the store.                                    |
| `$.store.book[last]`                                                  | The last book in the store                                      |
| `$.store.book[0,1,2]` or `$.store.book[0 to 2]`                       | The first three books in the store                              |
| `$.store.book ? (exists(@.isbn))`                                     | All books with an isbn                                          |
| `$.store.book ? (!exists(@.isbn))`                                    | All books without an isbn                                       |
| `$.store.book.title ? (@ starts with "S")`                            | All books whose title starts with the letter “S”                |
| `$.store.bicycle ? (@.colour like_regex "^RED$" flag "i")`            | All bicycles whose colour is “red”, case insensitive            |
| `$.store.book.price ? (@ > 10)`                                       | All books whose price is > 10                                   |
| `$.* ? (exists(@.book) \|\| exists(@.bicycle)).*[*] ? (@.price > 10)` | All books and bicycles whose price > 10                         |
