import {compile} from '../dist/index.js'

const stmt = compile('$.a')
const data = { a: "apple" }

let result = stmt.exists(data)
console.log(result.next().value)

result = stmt.query(data)
console.log(result.next().value)

result = stmt.values(data)
console.log(result.next().value)
