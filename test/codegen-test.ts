import {expect} from "chai"
import {generateFunctionSource} from "../src"


describe("Codegen tests", () => {

  describe("Modes", () => {

    it("default mode is lax", () => {
      const actual = generateFunctionSource("$")
      expect(actual).to.deep.include({lax: true})
    })

    it("explicit mode set to lax", () => {
      const actual = generateFunctionSource("lax$")
      expect(actual).to.deep.include({lax: true})
    })

    it("explicit mode set to strict", () => {
      const actual = generateFunctionSource("strict $")
      expect(actual).to.deep.include({lax: false})
    })
  })

  describe("ContextVariable", () => {
    it("parses standalone context", () => {
      const actual = generateFunctionSource("$")
      expect(actual.source).to.equal("return function* ($, $$) { yield $ }")
    })
  })
})