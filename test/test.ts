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
        statement: "$.foo.bar",
        expected: {
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
        statement: "$.foo.bar[*].location",
        expected: {
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
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: 1,
                  rhs: 3,
                  connector: "to"
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
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: "last",
                  connector: "-",
                  rhs: 1
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
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element:
                [{
                  lhs: 1,
                  connector: "+",
                  rhs: {
                    lhs: "last",
                    connector: "-",
                    rhs: 1
                  }
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
        statement: "$.foo.bar[*].zar ? (@ > 333)",
        expected: {
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: "*"
            },
            {

              property: "zar",
              filterChain: [{
                query: {
                  path: [],
                  operator: ConditionalOperator.GT,
                  compareTo: 333
                }
              }]
            },
          ]
        }
      },
      {
        statement: "$.foo.bar[*] ? (@.value != 22).zoo",
        expected: {
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: "*",
              filterChain: [{
                query: {
                  operator: ConditionalOperator.NE,
                  compareTo: 22,
                  path: [
                    {
                      property: "value"
                    }
                  ]
                }
              }]
            },
            {
              property: "zoo"
            }
          ]
        }
      },
      {
        // this one should break, only allow one '?'
        statement: "$.foo.bar[*] ? (@.zoo[1] < 13) ? (@.roo > 130).goo",
        expected: {
          lhs: [
            {
              property: "foo"
            },
            {
              array: "bar",
              element: "*",
              filterChain: [
                {
                  query: {
                    path: [
                      {
                        array: "zoo",
                        element: [{ lhs: 1 }]
                      }
                    ],
                    compareTo: 13,
                    operator: ConditionalOperator.LT
                  }
                },
                {
                  query: {
                    path: [
                      {
                        property: "roo"
                      }
                    ],
                    compareTo: 130,
                    operator: ConditionalOperator.GT
                  }
                }
              ]
            },
            {
              property: "goo"
            }
          ]
        }
      },
      {
        // also should break
        statement: "$.foo.bar[*] ? (@.zoo[1] < 13).roo ? (@ > 130)",
        expected: {
          lhs: [
            {
              property: "foo",
            },
            {
              array: "bar",
              element: "*",
              filterChain: [
                {
                  query: {
                    path: [
                      {
                        array: "zoo",
                        element: [{ lhs: 1 }]
                      }
                    ],
                    compareTo: 13,
                    operator: ConditionalOperator.LT
                  }
                }
              ]
            },
            {
              property: "roo",
              filterChain: [
                {
                  query: {
                    path: [],
                    operator: ConditionalOperator.GT,
                    compareTo: 130
                  }
                }
              ]
            }
          ]
        }
      },
      {
        statement: "$.foo ? (exists(@.bar[*] ? (@.zoo > 130))).bar.size()",
        expected: {
          lhs: [
            {
              property: "foo",
              filterChain: [
                {
                  query: {
                    method: "exists",
                    path: [
                      {
                        array: "bar",
                        element: "*",
                        filterChain: [
                          {
                            query: {
                              path: [
                                {
                                  property: "zoo"
                                }
                              ],
                              operator: ConditionalOperator.GT,
                              compareTo: 130
                            }
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            },
            {
              property: "bar"
            },
            {
              method: MethodName.SIZE,
              arguments: []
            }
          ]
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
