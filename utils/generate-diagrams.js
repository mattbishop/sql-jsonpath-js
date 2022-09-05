const fs = require('fs')
const path = require('path')
const chevrotain = require('chevrotain')
const JsonPathParser = require('../dist/parser').JsonPathParser


const parserInstance = new JsonPathParser()

const serializedGrammar = parserInstance.getSerializedGastProductions()

const htmlText = chevrotain.createSyntaxDiagramsCode(serializedGrammar)

const diagramPath = path.resolve(__dirname, '../docs/railroad_diagram.html')
fs.writeFileSync(diagramPath, htmlText)