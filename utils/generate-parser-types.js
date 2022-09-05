const chevrotain = require('chevrotain')
const fs = require('fs')
const path = require('path')
const JsonPathParser = require('../dist/parser').JsonPathParser


const parser = new JsonPathParser()

const dtsString = chevrotain.generateCstDts(parser.getGAstProductions())

const dtsPath = path.resolve(__dirname, '../src/sql_jsonpath_cst.d.ts')
fs.writeFileSync(dtsPath, dtsString)