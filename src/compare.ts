import {isIterable, noValueFilter, ReplayableIterable, toSeq} from "./iterators.ts"
import {sqlType, toPred} from "./ƒ-utils.ts"
import {CompOp, NO_VALUE, Pred, TemporalTypes} from "./types.ts"
import {ZonedTime} from "./zoned-time.ts"


/**
 * Compares two values of unknown type and returns a Pred result.
 * @internal
 */
export function compareValues(lax: boolean, compOp: CompOp, left: unknown, right: unknown): Pred {
  const leftIterable = isIterable(left)
  const rightIterable = isIterable(right)

  // skip looping
  if (!leftIterable && !rightIterable) {
    return comparePair(compOp, left, sqlType(left), right, sqlType(right))
  }


  let typeLeft = sqlType(left)
  let typeRight = sqlType(right)

  if (!lax) {
    if (typeLeft === "array") {
      throw new Error("In 'strict' mode! left side of comparison cannot be an array.")
    }
    if (typeRight === "array") {
      throw new Error("In 'strict' mode! right side of comparison cannot be an array.")
    }
  }

  if (leftIterable && !rightIterable) {
    return compareLeftIterRight(lax, compOp, left as Iterable<unknown>, right, typeRight)
  }
  if (!leftIterable && rightIterable) {
    return compareLeftRightIter(lax, compOp, left, typeLeft, right as Iterable<unknown>)
  }

  return compareLeftIterRightIter(lax, compOp, left as Iterable<unknown>, right as Iterable<unknown>)
}

function comparePair(compOp: CompOp, left: any, typeLeft: string, right: any, typeRight: string): Pred {
  if (typeLeft === typeRight) {
    if (typeLeft === "number") {
      return compareNumbers(compOp, left, right)
    }
    if (typeLeft === "string" || typeLeft === "boolean") {
      return evalCompOp(compOp, left, right)
    }
  }
  return compareOtherPair(compOp, left, typeLeft, right, typeRight)
}


function compareOtherPair(compOp: CompOp, left: any, typeLeft: string, right: any, typeRight: string): Pred {
  // these are not comparable, even if both are NO_VALUE
  if (left === NO_VALUE || right === NO_VALUE) {
    return Pred.FALSE
  }

  // no object identity comparisons
  if (typeLeft === "object" || typeRight === "object") {
    return Pred.UNKNOWN
  }

  const nullComp = compareMaybeNull(compOp, typeLeft, typeRight)
  if (nullComp) {
    return nullComp
  }

  const sComp = compareMaybeNumerics(compOp, left, typeLeft, right, typeRight)
  if (sComp) {
    return sComp
  }

  const tempComp = compareMaybeTemporals(compOp, left, typeLeft, right, typeRight)
  if (tempComp) {
    return tempComp
  }
  return Pred.UNKNOWN
}


function compareMaybeNumerics(compOp:    CompOp,
                              left:      any,
                              typeLeft:  string,
                              right:     any,
                              typeRight: string): Pred | undefined {

  if (   (typeLeft === "number" && !Number.isFinite(left))
      || (typeRight === "number" && !Number.isFinite(right))) {
    return Pred.UNKNOWN
  }

  if (typeLeft === "bigint") {
    typeLeft = "number"
  }
  if (typeRight === "bigint") {
    typeRight = "number"
  }

  if (typeLeft === typeRight && typeLeft === "number") {
    return compareNumBigInt(compOp, left, right)
  }
}

// number-only so V8 can optimize
function compareNumbers(compOp: CompOp, left: number, right: number): Pred {
  // handle number / bigint comparison, which requires == vs ===
  let result
  switch (compOp) {
    case CompOp.EQ:
      result = left === right
      break
    case CompOp.NEQ:
      result = left !== right
      break
    case CompOp.GT:
      result = left > right
      break
    case CompOp.GTE:
      result = left >= right
      break
    case CompOp.LT:
      result = left < right
      break
    case CompOp.LTE:
      result = left <= right
      break
    default:
      throw new Error("unknown comp op")
  }
  return toPred(result)
}

function compareNumBigInt(compOp: CompOp, left: any, right: any): Pred {
  // handle number / bigint comparison, which requires == vs ===
  let result
  switch (compOp) {
    case CompOp.EQ:
      result = left == right
      break
    case CompOp.NEQ:
      result = left != right
      break
    default:
      return evalCompOp(compOp, left, right)
  }
  return toPred(result)
}


function compareMaybeTemporals(compOp: CompOp,
                               left:      any,
                               typeLeft:  string,
                               right:     any,
                               typeRight: string): Pred | undefined {
  if (typeLeft === typeRight) {
    switch (typeLeft) {
      case TemporalTypes.DATE:
        return evalCmpResult(compOp, Temporal.PlainDate.compare(left, right))
      case TemporalTypes.TIMESTAMP:
        return evalCmpResult(compOp, Temporal.PlainDateTime.compare(left, right))
      case TemporalTypes.TIME:
        return evalCmpResult(compOp, Temporal.PlainTime.compare(left, right))
      case TemporalTypes.TIME_TZ:
        return evalCmpResult(compOp, left.compare(right))
      case TemporalTypes.TIMESTAMP_TZ:
        return evalCmpResult(compOp, Temporal.ZonedDateTime.compare(left, right))
      default:
        return undefined
    }
  }

  // Cross-type comparisons (e.g., PlainDate vs PlainDateTime)
  if (   (typeLeft === TemporalTypes.DATE && typeRight === TemporalTypes.TIMESTAMP)
      || (typeLeft === TemporalTypes.TIMESTAMP && typeRight === TemporalTypes.DATE)) {
    const l = typeLeft === TemporalTypes.DATE ? left.toPlainDateTime() : left
    const r = typeRight === TemporalTypes.DATE ? right.toPlainDateTime() : right
    return evalCmpResult(compOp, Temporal.PlainDateTime.compare(l, r))
  }

  return undefined
}

function evalCmpResult(compOp: CompOp, cmp: number): Pred {
  let result
  switch (compOp) {
    case CompOp.EQ:
      result = cmp === 0
      break
    case CompOp.NEQ:
      result = cmp !== 0
      break
    case CompOp.GT:
      result = cmp > 0
      break
    case CompOp.GTE:
      result = cmp >= 0
      break
    case CompOp.LT:
      result = cmp < 0
      break
    case CompOp.LTE:
      result = cmp <= 0
      break
    default: throw new Error("unknown comp op")
  }
  return toPred(result)
}


function evalCompOp(compOp: CompOp, left: any, right: any): Pred {
  let result
  switch (compOp) {
    case CompOp.EQ:
      result = left === right
      break
    case CompOp.NEQ:
      result = left !== right
      break
    case CompOp.GT:
      result = left > right
      break
    case CompOp.GTE:
      result = left >= right
      break
    case CompOp.LT:
      result = left < right
      break
    case CompOp.LTE:
      result = left <= right
      break
    default:
      throw new Error("unknown comp op")
  }
  return toPred(result)
}

/*
  null / not_null comparison rules
  null == not_null  -> FALSE
  null != not_null  -> TRUE
  null <> not_null  -> TRUE
 */
function compareMaybeNull(compOp: CompOp, typeLeft: string, typeRight: string): Pred | undefined {
  if (typeLeft === "null" || typeRight === "null") {
    let result
    switch (compOp) {
      case CompOp.EQ :
        result = typeLeft === typeRight
        break
      case CompOp.NEQ :
        result = typeLeft !== typeRight
        break
      default:
        return Pred.UNKNOWN
    }
    return toPred(result)
  }
}


/*
  These next three functions look very similar, and while they could be boiled into a single
  function by wrapping the scalar value in a Singleton Iterator, performance benchmarking found
  that approach to be slower than separate loop functions.
 */

function compareLeftIterRightIter(lax:      boolean,
                                  compOp:   CompOp,
                                  leftIn:   Iterable<unknown>,
                                  rightIn:  Iterable<unknown>) {
  const leftValues = toSeq(leftIn).filter(noValueFilter)
  const rightValues = new ReplayableIterable(toSeq(rightIn).filter(noValueFilter))

  let hasUnknown = false
  for (const left of leftValues) {
    const typeLeft = sqlType(left)
    for (const right of rightValues) {
      const typeRight = sqlType(right)
      const result = comparePair(compOp, left, typeLeft, right, typeRight)
      if (result === Pred.TRUE) {
        return Pred.TRUE
      }
      if (result === Pred.UNKNOWN) {
        if (!lax) {
          return Pred.UNKNOWN
        }
        hasUnknown = true
      }
    }
  }
  return hasUnknown
    ? Pred.UNKNOWN
    : Pred.FALSE
}

function compareLeftIterRight(lax:        boolean,
                              compOp:     CompOp,
                              leftIn:     Iterable<unknown>,
                              right:      unknown,
                              rightType:  string) {
  const leftValues = toSeq(leftIn).filter(noValueFilter)

  let hasUnknown = false
  for (const left of leftValues) {
    const leftType = sqlType(left)
    const result = comparePair(compOp, left, leftType, right, rightType)
    if (result === Pred.TRUE) {
      return Pred.TRUE
    }
    if (result === Pred.UNKNOWN) {
      if (!lax) {
        return Pred.UNKNOWN
      }
      hasUnknown = true
    }
  }
  return hasUnknown
    ? Pred.UNKNOWN
    : Pred.FALSE
}

function compareLeftRightIter(lax:      boolean,
                              compOp:   CompOp,
                              left:     unknown,
                              typeLeft: string,
                              rightIn:  Iterable<unknown>) {
  const rightValues = toSeq(rightIn).filter(noValueFilter)

  let hasUnknown = false
  for (const right of rightValues) {
    const typeRight = sqlType(right)
    const result = comparePair(compOp, left, typeLeft, right, typeRight)
    if (result === Pred.TRUE) {
      return Pred.TRUE
    }
    if (result === Pred.UNKNOWN) {
      if (!lax) {
        return Pred.UNKNOWN
      }
      hasUnknown = true
    }
  }
  return hasUnknown
    ? Pred.UNKNOWN
    : Pred.FALSE
}
