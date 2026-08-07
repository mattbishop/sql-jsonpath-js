import {performance} from "node:perf_hooks"

import {compile, type SqlJsonPathStatement} from "../src/index.ts"

export type BenchmarkInputFactory = () => unknown

export type BenchmarkCase = {
  name: string
  statement: string
  input: BenchmarkInputFactory
  operation?: "values" | "exists"
  iterations?: number
  warmupIterations?: number
}

type BenchmarkResult = {
  name: string
  statement: string
  operation: "values" | "exists"
  iterations: number
  totalMs: number
  averageMs: number
  operationsPerSecond: number
  resultCount: number
}

const DEFAULT_ITERATIONS = 25
const DEFAULT_WARMUP_ITERATIONS = 5

function consumeValues(statement: SqlJsonPathStatement, input: unknown): number {
  let count = 0
  for (const _value of statement.values(input)) {
    count++
  }
  return count
}

function consumeExists(statement: SqlJsonPathStatement, input: unknown): number {
  const result = statement.exists(input)

  if (typeof result === "boolean") {
    return result ? 1 : 0
  }

  let count = 0
  for (const exists of result) {
    if (exists) {
      count++
    }
  }
  return count
}

function runOperation(statement: SqlJsonPathStatement, benchmark: BenchmarkCase): number {
  const operation = benchmark.operation ?? "values"
  const input = benchmark.input()

  return operation === "exists"
    ? consumeExists(statement, input)
    : consumeValues(statement, input)
}

export function runBenchmark(benchmark: BenchmarkCase): BenchmarkResult {
  const operation = benchmark.operation ?? "values"
  const iterations = benchmark.iterations ?? DEFAULT_ITERATIONS
  const warmup = benchmark.warmupIterations ?? DEFAULT_WARMUP_ITERATIONS

  const statement = compile(benchmark.statement)

  for (let i = 0; i < warmup; i++) {
    runOperation(statement, benchmark)
  }

  let resultCount = 0
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    resultCount += runOperation(statement, benchmark)
  }

  const totalMs = performance.now() - start
  const averageMs = totalMs / iterations

  return {
    name: benchmark.name,
    statement: benchmark.statement,
    operation,
    iterations,
    totalMs,
    averageMs,
    operationsPerSecond: 1000 / averageMs,
    resultCount
  }
}

export function runBenchmarks(benchmarks: BenchmarkCase[]): BenchmarkResult[] {
  return benchmarks.map(runBenchmark)
}

export function printResults(results: BenchmarkResult[]) {
  const rows = results.map((result) => ({
    name: result.name,
    operation: result.operation,
    iterations: result.iterations,
    "total ms": result.totalMs.toFixed(2),
    "avg ms": result.averageMs.toFixed(2),
    "ops/sec": result.operationsPerSecond.toFixed(2),
    "result count": result.resultCount
  }))

  console.table(rows)
}
