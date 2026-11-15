import {performance} from "node:perf_hooks"

import {compile, type SqlJsonPathStatement} from "../dist/index.js"

export type BenchmarkInputFactory = () => unknown

export type BenchmarkCase = {
  name: string
  statement: string
  input: BenchmarkInputFactory
  operation?: "query" | "exists"
  iterations?: number
  warmup?: number
}

type BenchmarkResult = {
  name: string
  statement: string
  operation: "query" | "exists"
  iterations: number
  totalMs: number
  averageMs: number
  opsPerSecond: number
  resultCount: number
}

export type BenchmarkStatement = Pick<SqlJsonPathStatement, "query" | "exists">
export type BenchmarkCompile = (statement: string) => BenchmarkStatement
export type BenchmarkComparison = {
  name: string
  operation: "query" | "exists"
  iterations: number
  baseline: BenchmarkResult
  current: BenchmarkResult
  speedup: number
  resultsMatch: boolean
}

const DEFAULT_ITERATIONS = 1000
const DEFAULT_WARMUP_ITERATIONS = 50

function consumeQuery(statement: BenchmarkStatement, input: unknown): number {
  let count = 0
  for (const _value of statement.query(input)) {
    count++
  }
  return count
}

function consumeExists(statement: BenchmarkStatement, input: unknown): number {
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

function runOperation(statement: BenchmarkStatement, benchmark: BenchmarkCase): number {
  const operation = benchmark.operation ?? "query"
  const input = benchmark.input()

  return operation === "exists"
    ? consumeExists(statement, input)
    : consumeQuery(statement, input)
}

export function runBenchmark(
  benchmark: BenchmarkCase,
  compileStatement: BenchmarkCompile = compile
): BenchmarkResult {
  const operation = benchmark.operation ?? "query"
  const iterations = benchmark.iterations ?? DEFAULT_ITERATIONS
  const warmup = benchmark.warmup ?? DEFAULT_WARMUP_ITERATIONS

  const statement = compileStatement(benchmark.statement)

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
    opsPerSecond: 1000 / averageMs,
    resultCount
  }
}

export function runBenchmarks(benchmarks: BenchmarkCase[]): BenchmarkResult[] {
  return benchmarks.map((benchmark) => runBenchmark(benchmark))
}

export function runComparisons(
  benchmarks: BenchmarkCase[],
  baselineCompile: BenchmarkCompile,
  currentCompile: BenchmarkCompile
): BenchmarkComparison[] {
  return benchmarks.map((benchmark) => {
    const current = runBenchmark(benchmark, currentCompile)
    const baseline = runBenchmark(benchmark, baselineCompile)

    return {
      name: benchmark.name,
      operation: benchmark.operation ?? "query",
      iterations: benchmark.iterations ?? DEFAULT_ITERATIONS,
      baseline,
      current,
      speedup: current.opsPerSecond / baseline.opsPerSecond,
      resultsMatch: baseline.resultCount === current.resultCount
    }
  })
}

export function printResults(results: BenchmarkResult[]): void {
  const rows = results.map((result) => ({
    name: result.name,
    operation: result.operation,
    iterations: result.iterations,
    "total ms": result.totalMs.toFixed(2),
    "avg ms": result.averageMs.toFixed(2),
    "ops/sec": result.opsPerSecond.toFixed(2),
    "result count": result.resultCount
  }))

  console.table(rows)
}

export function formatComparisonResults(results: BenchmarkComparison[]): Record<string, any> {
  return results.map((result) => ({
    name: result.name,
    operation: result.operation,
    iterations: result.iterations,
    "2.1.0 total ms": result.baseline.totalMs.toFixed(2),
    "current total ms": result.current.totalMs.toFixed(2),
    "2.1.0 ops/sec": result.baseline.opsPerSecond.toFixed(2),
    "current ops/sec": result.current.opsPerSecond.toFixed(2),
    speedup: `${result.speedup.toFixed(2)}x`,
    "2.1.0 results": result.baseline.resultCount,
    "current results": result.current.resultCount,
    "counts match": result.resultsMatch
  }))
}

export function printComparisonResults(results: BenchmarkComparison[]): void {
  console.table(formatComparisonResults(results))
}
