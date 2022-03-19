import { expect } from "chai"
import { ConditionalOperator, MethodName, SqlJsonPathStatement } from "../src/json-path"
import { compile } from "../src"

interface SqlJsonPathTest {
  statement: string
  expected: SqlJsonPathStatement
}

describe("SQL JSONPath", () => {
  describe("parser test", () => {
    const tests: SqlJsonPathTest[] = [
      {
        statement: "strict $.foo.bar",
        expected: {
          mode: "strict",
          lhs: [
            {
              property: "foo"
            },
            {
              property: "bar"
            },
          ]
        }
      },
      {
        statement: "lax $.foo.bar[*].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: "*"
            },
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[1].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: [{ lhs: 1 }]
            },
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[1,2].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: [{ lhs: 1 }, { lhs: 2 }]
            },
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[1 to 3].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: 1,
                  ops: [{
                    rhs: 3,
                    connector: "to"
                  }]
                }],
            }
            ,
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[last].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: "last",
                }],
            }
            ,
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[last - 1].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: "last",
                  ops: [{
                    connector: "-",
                    rhs: 1
                  }
                  ]
                }],
            }
            ,
            {
              property: "location"
            },
          ]
        }
      }, {
        statement: "$.foo.bar[1 + (last - 1)].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: 1,
                  ops: [{
                    connector: "+",
                    rhs: {
                      lhs: "last",
                      ops: [{
                        connector: "-",
                        rhs: 1
                      }]
                    }
                  }]
                }],
            }
            ,
            {
              property: "location"
            },
          ]
        }
      },
    {
        statement: "$.foo.bar[1 + 2 + 3].location",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: 1,
                  ops: [{
                    connector: "+",
                    rhs: 2
                  },
                  {
                    connector: "+",
                    rhs: 3
                  }
                  ]
                }],
            },
            {
              property: "location"
            },
          ]
        }
      },
      {
        statement: "$.foo.zar.bar[*] ? (@ > 333)",
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              property: "zar"
            },
            {
              array: "bar",
              element: "*"
            }],
          filter: {
            query: {
              path: [],
              operator: ConditionalOperator.GT,
              compareTo: 333
            }
          }
        }
      }
    ]

    const methodNames = [
      "type", "size", "double", "ceiling", "floor", "abs", "datetime", "keyvalue"
    ]

    methodNames.forEach(methodName => {
      tests.push({
        statement: `$.foo.bar.${methodName}()`,
        expected: {
          mode: "lax",
          lhs: [
            {
              property: "foo"
            },
            {
              property: "bar",
            },
            {
              method: methodName as MethodName,
              arguments: []
            },
          ]
        }
      })
    })

    tests.forEach(test => {
      it(`should correctly parse ${test.statement}`, () => {
        const actual = compile(test.statement)
        expect(actual.statement).to.deep.equal(test.expected)
      })
    })
  })
})
