export class SingletonIterator<T> implements Iterator<T> {

  private readonly singleton: T
  private done: boolean = false

  constructor(value: T) {
    this.singleton = value
  }

  next(): IteratorResult<T, T> {
    const result = { value: this.singleton, done: this.done }
    if (!this.done) {
      this.done = true
    }
    return result
  }
}
