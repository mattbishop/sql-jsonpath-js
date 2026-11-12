import {isIterable, noValueFilter, ReplayableIterable, toSeq} from "./iterators.ts"
import {sqlType, toPred} from "./ƒ-utils.ts"
import {CompOp, NO_VALUE, Pred, TemporalTypes} from "./types.ts"


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

  const numComp = compareNumerics(compOp, left, typeLeft, right, typeRight)
  if (numComp) {
    return numComp
  }

  const tempComp = compareTemporalPair(compOp, left, typeLeft, right, typeRight)
  if (tempComp) {
    return tempComp
  }

  // check that left and right can be compared
  if (typeLeft === typeRight) {
    return evalCompOp(compOp, left, right)
  }
  return Pred.UNKNOWN
}

function compareNumerics(compOp:    CompOp,
                         left:      unknown,
                         typeLeft:  string,
                         right:     unknown,
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

  if (typeLeft === typeRight) {
    switch (typeLeft) {
      case "number":
      case "string":
      case "boolean":
        break
      default:
        return undefined
    }
    return evalCompOp(compOp, left, right)
  }
}

function compareTemporalPair(compOp: CompOp,
                             left: any,
                             typeLeft: string,
                             right: any,
                             typeRight: string): Pred | undefined {
  if (areTemporalComparable(typeLeft, typeRight)) {
    return evalCompOp(compOp, toTemporalComparable(left), toTemporalComparable(right))
  }
}

function evalCompOp(compOp: CompOp, left: any, right: any): Pred {
  switch (compOp) {
    case CompOp.EQ:
      return toPred(left === right)
    case CompOp.NEQ:
      return toPred(left != right)
    case CompOp.GT:
      return toPred(left > right)
    case CompOp.GTE:
      return toPred(left >= right)
    case CompOp.LT:
      return toPred(left < right)
    case CompOp.LTE:
      return toPred(left <= right)
    default:
      throw new Error(`unknwon comp op: ${compOp}`)
  }
}

/*
  null / not_null comparison rules
  null == not_null  -> FALSE
  null != not_null  -> TRUE
  null <> not_null  -> TRUE
 */
function compareMaybeNull(compOp: CompOp, typeLeft: string, typeRight: string): Pred | undefined {
  if (typeLeft === "null" || typeRight === "null") {
    switch (compOp) {
      case CompOp.EQ :
        return toPred(typeLeft === typeRight)
      case CompOp.NEQ :
        return toPred(typeLeft !== typeRight)
      default:
        return Pred.UNKNOWN
    }
  }
}


/*
    COMPARABLE:
    * date and timestamp
    * date and datetime
    * datetime and timestamp

    NOT COMPARABLE:
    * date and timestamp_tz
    * date and time
    * date and time_tz
    * time and time_tz
*/
function areTemporalComparable(typeLeft: string, typeRight: string): boolean {
  if (   typeLeft === typeRight
      && (typeLeft === TemporalTypes.DATE || typeLeft.startsWith("time"))) {
    return true
  }
  // types are different but possibly comparable
  const leftIsComparable =
       typeLeft === TemporalTypes.DATE
    || typeLeft === TemporalTypes.TIMESTAMP

  const rightIsComparable =
       typeRight === TemporalTypes.DATE
    || typeRight === TemporalTypes.TIMESTAMP

  return leftIsComparable && rightIsComparable
}

function toTemporalComparable(temporal: Temporal.PlainDate | Temporal.PlainDateTime): string {
  // todo it would be good to cache this conversion
  if (temporal instanceof Temporal.PlainDate) {
    temporal = Temporal.PlainDateTime.from(temporal)
  }
  return temporal.toString()
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
