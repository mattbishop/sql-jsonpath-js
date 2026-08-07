import {printResults, runBenchmarks, type BenchmarkCase} from "./bench.ts"

type Book = {
  id: number
  category: "reference" | "fiction" | "technical"
  author: string
  title: string
  price: number
  isbn?: string
  tags: string[]
  stock: {
    warehouse: string
    count: number
  }[]
}

function createBooks(count: number): Book[] {
  return Array.from({length: count}, (_, index) => ({
    id: index,
    category: index % 10 === 0
      ? "reference"
      : index % 3 === 0
        ? "technical"
        : "fiction",
    author: `Author ${index}`,
    title: index % 2 === 0
      ? `SQL Path Book ${index}`
      : `JSON Data Book ${index}`,
    price: (index % 50) + 0.99,
    isbn: index % 4 === 0
      ? `isbn-${index}`
      : undefined,
    tags: [
      index % 2 === 0 ? "sql" : "json",
      index % 5 === 0 ? "database" : "general",
      `tag-${index % 20}`
    ],
    stock: [
      {
        warehouse: "west",
        count: index % 100
      },
      {
        warehouse: "east",
        count: (index * 3) % 100
      }
    ]
  }))
}

function createStore(bookCount: number) {
  return {
    store: {
      book: createBooks(bookCount),
      bicycle: {
        colour: "red",
        price: 19.95
      }
    }
  }
}

function* createBookIterator(count: number): Generator<Book> {
  for (let i = 0; i < count; i++) {
    yield createBooks(1)[0]!
  }
}

const BOOK_COUNT = Number(process.env.BENCH_SIZE ?? 50_000)
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 20)

const benchmarks: BenchmarkCase[] = [
  {
    name: "large array member projection",
    statement: "$.store.book[*].author",
    input: () => createStore(BOOK_COUNT),
    iterations: ITERATIONS
  },
  {
    name: "large array numeric filter",
    statement: "$.store.book ? (@.price > 25)",
    input: () => createStore(BOOK_COUNT),
    iterations: ITERATIONS
  },
  {
    name: "large array exists filter",
    statement: "$.store.book ? (exists(@.isbn))",
    input: () => createStore(BOOK_COUNT),
    iterations: ITERATIONS
  },
  {
    name: "large array nested wildcard projection",
    statement: "$.store.book[*].stock[*].count",
    input: () => createStore(BOOK_COUNT),
    iterations: ITERATIONS
  },
  {
    name: "large array string predicate",
    statement: '$.store.book.title ? (@ starts with "SQL")',
    input: () => createStore(BOOK_COUNT),
    iterations: ITERATIONS
  },
  {
    name: "iterator input exists",
    statement: '$ ? (@.category == "technical")',
    operation: "exists",
    input: () => createBookIterator(BOOK_COUNT),
    iterations: ITERATIONS
  }
]

printResults(runBenchmarks(benchmarks))
