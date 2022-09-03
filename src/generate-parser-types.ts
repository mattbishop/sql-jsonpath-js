import {generateCstDts} from "chevrotain"
import {writeFileSync} from "fs"
import {resolve} from "path"
import {JsonPathParser} from "./parser"


const parser = new JsonPathParser()
const dtsString = generateCstDts(parser.getGAstProductions())
const dtsPath = resolve(__dirname, "sql_jsonpath_cst.d.ts")
writeFileSync(dtsPath, dtsString)