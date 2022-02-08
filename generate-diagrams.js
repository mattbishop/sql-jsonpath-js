/**
 * A template for generating syntax diagrams html file.
 * See: https://github.com/chevrotain/chevrotain/tree/master/diagrams for more details
 *
 * usage:
 * - npm install in the parent directory (parser) to install dependencies
 * - Run this in file in node.js (node gen_diagrams.js)
 * - open the "generated_diagrams.html" that will be created in this folder using
 *   your favorite browser.
 */
const fs = require('fs')
const chevrotain = require('chevrotain')
const JsonPathParser = require('./dist/parser').JsonPathParser

// extract the serialized grammar.
const parserInstance = new JsonPathParser()
const serializedGrammar = parserInstance.getSerializedGastProductions()

// create the HTML Text
const htmlText = chevrotain.createSyntaxDiagramsCode(serializedGrammar)

// Write the HTML file to disk
const tmpDir = "./tmp"
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir)
}
fs.writeFileSync(`${tmpDir}/generated_diagrams.html`, htmlText)