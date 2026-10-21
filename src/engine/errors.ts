export class GraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphError'
  }
}

export class NodeTypeError extends GraphError {
  constructor(message: string) {
    super(message)
    this.name = 'NodeTypeError'
  }
}
