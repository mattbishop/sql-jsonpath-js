import fs from 'fs'
import chevrotain from 'chevrotain'
import {JsonPathParser} from '../dist/parser.js'


const parser = new JsonPathParser()

const dtsString = chevrotain.generateCstDts(parser.getGAstProductions())

const dtsPath = new URL('../src/sql_jsonpath_cst.d.ts', import.meta.url)
fs.writeFileSync(dtsPath, dtsString)
