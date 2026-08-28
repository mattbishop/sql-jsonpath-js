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
  return Array.from({length: count}, (_, index) => createBook(index))
}

function createBook(index: number): Book {
  return {
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
  }
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
  for (let i = 1; i <= count; i++) {
    yield createBook(i)
  }
}


type Event = {
  id: number
  createdAt: string
  formattedCreatedAt: string
  createdAtTz: string
  formattedCreatedAtTz: string
}

function createEvents(count: number): Event[] {
  return Array.from({length: count}, (_, index) => createEvent(index))
}

function createEvent(index: number): Event {
  const day = String((index % 28) + 1).padStart(2, "0")
  const hour = String(index % 24).padStart(2, "0")
  const minute = String(index % 60).padStart(2, "0")
  const second = String((index * 7) % 60).padStart(2, "0")
  const fraction = String(index % 1_000_000_000).padStart(9, "0")

  return {
    id: index,
    createdAt: `2026-08-${day}T${hour}:${minute}:${second}.${fraction}`,
    formattedCreatedAt: `2026-08-${day} ${hour}:${minute}:${second}.${fraction}`,
    createdAtTz: `2026-08-${day}T${hour}:${minute}:${second}.${fraction}-03:30`,
    formattedCreatedAtTz: `2026-08-${day} ${hour}:${minute}:${second}.${fraction} -03:30`
  }
}

function createEventLog(eventCount: number) {
  return {
    events: createEvents(eventCount)
  }
}

function* createEventIterator(count: number): Generator<Event> {
  for (let i = 0; i < count; i++) {
    yield createEvent(i)
  }
}


const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 10_000)


const benchmarks: BenchmarkCase[] = [
  {
    name: "large array member projection",
    statement: "$.store.book[*].author",
    input: () => createStore(200),
    iterations: ITERATIONS
  },
  {
    name: "large array numeric filter",
    statement: "$.store.book ? (@.price > 25)",
    input: () => createStore(100),
    iterations: ITERATIONS
  },
  {
    name: "large array exists filter",
    statement: "$.store.book ? (exists(@.isbn))",
    input: () => createStore(100),
    iterations: ITERATIONS
  },
  {
    name: "large array nested wildcard projection",
    statement: "$.store.book[*].stock[*].count",
    input: () => createStore(1000),
    iterations: ITERATIONS
  },
  {
    name: "large array string predicate",
    statement: '$.store.book.title ? (@ starts with "SQL")',
    input: () => createStore(50),
    iterations: ITERATIONS
  },
  {
    name: "iterator input exists",
    statement: '$ ? (@.category == "technical")',
    operation: "exists",
    input: () => createBookIterator(1000),
    iterations: ITERATIONS
  },
  {
    name: "datetime ISO timestamp projection",
    statement: "$.events[*].createdAt.timestamp()",
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime ISO timestamp precision projection",
    statement: "$.events[*].createdAt.timestamp(6)",
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime formatted timestamp projection",
    statement: '$.events[*].formattedCreatedAt.datetime("YYYY-MM-DD HH24:MI:SS.FF9")',
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime ISO timestamp_tz projection",
    statement: "$.events[*].createdAtTz.timestamp_tz()",
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime ISO timestamp_tz precision projection",
    statement: "$.events[*].createdAtTz.timestamp_tz(6)",
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime formatted timestamp_tz projection",
    statement: '$.events[*].formattedCreatedAtTz.datetime("YYYY-MM-DD HH24:MI:SS.FF9 TZH:TZM")',
    input: () => createEventLog(100),
    iterations: ITERATIONS
  },
  {
    name: "datetime formatted timestamp filter",
    statement: '$.events[*].formattedCreatedAt ? (@.datetime("YYYY-MM-DD HH24:MI:SS.FF9") > "2026-08-15T00:00:00".timestamp())',
    input: () => createEventLog(100),
    iterations: ITERATIONS
  }
]

printResults(runBenchmarks(benchmarks))
