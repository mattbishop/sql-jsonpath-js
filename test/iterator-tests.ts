import {describe, it} from "node:test"
import {expect} from "chai"

import {
  DefaultOnEmptyIterator,
  DefaultOnErrorIterator,
  isIterableInput,
  one,
  ReplayableIterable,
  SingletonIterator
} from "../src/iterators.ts"

describe("iterators", () => {
  describe("isIterableInput", () => {
    it("treats non-string non-array iterables as iterable input", () => {
      expect(isIterableInput(new Set([1, 2]))).to.be.true
    })

    it("does not treat strings as iterable input", () => {
      expect(isIterableInput("abc")).to.be.false
    })

    it("does not treat arrays as iterable input", () => {
      expect(isIterableInput([1, 2, 3])).to.be.false
    })

    it("does not treat plain objects as iterable input", () => {
      expect(isIterableInput({a: 1})).to.be.false
    })
  })

  describe("ReplayableIterable", () => {
    it("replays values from a single-pass iterable", () => {
      const data = [1, 2, 3]
      const actual = new ReplayableIterable(data.values())

      expect(Array.from(actual)).to.deep.equal([1, 2, 3])
      expect(Array.from(actual)).to.deep.equal([1, 2, 3])
      expect(Array.from(actual)).to.deep.equal([1, 2, 3])
    })

    it("caches lazily while an iterator is partially consumed", () => {
      let reads = 0

      function* source(): Generator<number> {
        reads++
        yield 1
        reads++
        yield 2
        reads++
        yield 3
      }

      const iterable = new ReplayableIterable(source())
      const firstIterator = iterable[Symbol.iterator]()

      expect(firstIterator.next()).to.deep.equal({
        done: false,
        value: 1
      })
      expect(reads).to.equal(1)

      expect(Array.from(iterable)).to.deep.equal([1, 2, 3])
      expect(reads).to.equal(3)

      expect(Array.from(iterable)).to.deep.equal([1, 2, 3])
      expect(reads).to.equal(3)
    })

    it("allows overlapping iterators to share the same cache", () => {
      const data = ["a", "b", "c"]
      const iterable = new ReplayableIterable(data)
      const firstIterator = iterable[Symbol.iterator]()
      const secondIterator = iterable[Symbol.iterator]()

      expect(firstIterator.next()).to.deep.equal({
        done: false,
        value: "a"
      })

      expect(secondIterator.next()).to.deep.equal({
        done: false,
        value: "a"
      })

      expect(firstIterator.next()).to.deep.equal({
        done: false,
        value: "b"
      })

      expect(secondIterator.next()).to.deep.equal({
        done: false,
        value: "b"
      })

      expect(Array.from(firstIterator)).to.deep.equal(["c"])
      expect(Array.from(secondIterator)).to.deep.equal(["c"])
      expect(Array.from(iterable)).to.deep.equal(["a", "b", "c"])
    })
  })

  describe("SingletonIterator", () => {
    it("returns its value once, then completes", () => {
      const iterator = new SingletonIterator("value")

      expect(iterator.next()).to.deep.equal({
        done: false,
        value: "value"
      })

      expect(iterator.next()).to.deep.equal({
        done: true,
        value: undefined
      })
    })
  })

  describe("DefaultOnEmptyIterator", () => {
    it("returns the wrapped iterator's first value when not empty", () => {
      const iterator = new DefaultOnEmptyIterator(-1, [1, 2][Symbol.iterator]())

      expect(iterator.next()).to.deep.equal({
        done: false,
        value: 1
      })

      expect(iterator.next()).to.deep.equal({
        done: false,
        value: 2
      })

      expect(iterator.next()).to.deep.equal({
        done: true,
        value: undefined
      })
    })

    it("returns the default value when the wrapped iterator is empty", () => {
      const iterator = new DefaultOnEmptyIterator("default", [][Symbol.iterator]())

      expect(iterator.next()).to.deep.equal({
        done: true,
        value: "default"
      })
    })
  })

  describe("DefaultOnErrorIterator", () => {
    it("returns the wrapped iterator value when no error is thrown", () => {
      const iterator = new DefaultOnErrorIterator(-1, [1][Symbol.iterator]())

      expect(iterator.next()).to.deep.equal({
        done: false,
        value: 1
      })
    })

    it("returns the default value when the wrapped iterator throws", () => {
      const throwingIterator: Iterator<string> = {
        next() {
          throw new Error("boom")
        }
      }

      const iterator = new DefaultOnErrorIterator("default", throwingIterator)

      expect(iterator.next()).to.deep.equal({
        done: false,
        value: "default"
      })
    })
  })

  describe("one", () => {
    it("returns the next iterator value", () => {
      expect(one([1, 2][Symbol.iterator]())).to.equal(1)
    })

    it("returns undefined for an empty iterator", () => {
      expect(one([][Symbol.iterator]())).to.be.undefined
    })
  })
})
