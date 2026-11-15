import {compile as compilePublished} from "sql-jsonpath-js-2.1.0"

import {compile as compileCurrent} from "../dist/index.js"
import {printComparisonResults, runComparisons} from "./bench.ts"
import {benchmarks} from "./cases.ts"

printComparisonResults(runComparisons(benchmarks, compilePublished, compileCurrent))
