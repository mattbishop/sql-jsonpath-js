export class SingletonIterator<T> implements Iterator<T> {

  private done: boolean = false

  constructor(private readonly singleton: T) { }

  next(): IteratorResult<T> {
    const result = { value: this.singleton, done: this.done }
    if (!this.done) {
      this.done = true
    }
    return result
  }
}


export class DefaultOnEmptyIterator<T> implements Iterator<T> {

  private started: boolean = false

  constructor(private readonly  value:    T,
              private           iterator: Iterator<T>) { }

  next(): IteratorResult<T> {
    if (!this.started) {
      this.started = true
      const first = this.iterator.next()
      if (first.done) {
        this.iterator = new SingletonIterator(this.value)
      } else {
        return first
      }
    }
    return this.iterator.next()
  }
}


export class DefaultOnErrorIterator<T> implements Iterator<T> {

  constructor(private readonly value:     T,
              private readonly iterator:  Iterator<T>) { }

  next(): IteratorResult<T> {
    try {
      return this.iterator.next()
    } catch (e: any) {
      return {value: this.value, done: false}
    }
  }
}
