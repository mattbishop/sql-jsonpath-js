/**
 * Represents a Sql JSONPath 'time with time zone' object. Not something Temporal supports.
 */
export class ZonedTime extends Temporal.PlainTime {

  private readonly compareMinutes:  number
  private readonly plain:           Temporal.PlainTime
  private readonly offset:          string


  constructor(plain: Temporal.PlainTime, offset: string) {
    const {hour, minute, second, millisecond, microsecond, nanosecond} = plain
    const offsetMinutes = ZonedTime.parseOffsetMinutes(offset)
    const adjustedMinutes = (hour * 60 + minute - offsetMinutes + 1440) % 1440
    const adjustedHour = Math.floor(adjustedMinutes / 60)
    const adjustedMinute = adjustedMinutes % 60

    super(adjustedHour, adjustedMinute, second, millisecond, microsecond, nanosecond)

    this.plain = plain
    this.compareMinutes = adjustedMinutes
    this.offset = ZonedTime.normalizeOffsetString(offset)
  }


  static fromZDT(zdt: Temporal.ZonedDateTime): ZonedTime {
    const {hour, minute, second, millisecond, microsecond, nanosecond, offset} = zdt
    const plain = Temporal.PlainTime.from({hour, minute, second, millisecond, microsecond, nanosecond})
    return new ZonedTime(plain, offset)
  }

  static override from(input: string, options?:  Temporal.OverflowOptions): ZonedTime {
    const match = input.match(/^([^Z+-]+)([+-].+|Z)?$/)
    if (match) {
      const [_, timeStr, offset = "Z"] = match
      const plain = Temporal.PlainTime.from(timeStr, options)
      return new ZonedTime(plain, offset)
    }
    throw new Error(`invalid ZonedTime string: ${input}`)
  }

  private static normalizeOffsetString(offsetStr: string): string {
    if ("Z" === offsetStr) {
      return "+00:00"
    }
    const sign = offsetStr[0]
    const [hours, minutes] = offsetStr.slice(1).split(":")
    const paddedHours = hours.padStart(2, "0")
    const paddedMinutes = minutes ? minutes.padStart(2, "0") : "00"
    return `${sign}${paddedHours}:${paddedMinutes}`
  }

  private static parseOffsetMinutes(offset: string): number {
    if ("Z" === offset) {
      return 0
    }
    const match = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(offset)
    if (!match) {
      throw new Error(`invalid ZonedTime offset: ${offset}`)
    }
    const [_, s, h, m] = match
    const sign = s === "-" ? -1 : 1
    const hours = Number(h)
    const minutes = Number(m ?? 0)
    return sign * (hours * 60 + minutes)
  }

  compare(other: ZonedTime): number {
    if (this.compareMinutes < other.compareMinutes) {
      return -1
    }
    if (this.compareMinutes > other.compareMinutes) {
      return 1
    }
    if (this.second < other.second) {
      return -1
    }
    if (this.second > other.second) {
      return 1
    }
    if (this.millisecond < other.millisecond) {
      return -1
    }
    if (this.millisecond > other.millisecond) {
      return 1
    }
    if (this.microsecond < other.microsecond) {
      return -1
    }
    if (this.microsecond > other.microsecond) {
      return 1
    }
    if (this.nanosecond < other.nanosecond) {
      return -1
    }
    if (this.nanosecond > other.nanosecond) {
      return 1
    }

    return 0
  }


  // round() has a few different roundTo option types. I use any to get around the TS errors.
  override round(roundTo: any): ZonedTime {
    const rounded = this.plain.round(roundTo)
    return new ZonedTime(rounded, this.offset)
  }

  toString(options?: Temporal.PlainTimeToStringOptions): string {
    return `${this.plain.toString(options)}${this.offset}`
  }
}
