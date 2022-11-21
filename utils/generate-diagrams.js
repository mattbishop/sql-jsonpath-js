import fs from 'fs'
import chevrotain from 'chevrotain'
import {JsonPathParser} from '../dist/parser.js'


const parserInstance = new JsonPathParser()

const serializedGrammar = parserInstance.getSerializedGastProductions()

const htmlText = chevrotain.createSyntaxDiagramsCode(serializedGrammar)

const diagramPath = new URL('../docs/railroad_diagram.html', import.meta.url)
fs.writeFileSync(diagramPath, htmlText)
