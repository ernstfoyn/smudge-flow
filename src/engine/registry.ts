import type { NodeDefinition } from './types'
import { NodeTypeError } from './errors'

/**
 * Register over alle nodetyper.
 *
 * Ett register gir UI-en én sann kilde til sann: nodekort, inspector,
 * keyframe-spor og eksport-panelet leser alle fra samme schema.
 */
export class NodeRegistry {
  private definitions = new Map<string, NodeDefinition<any>>()

  register<P>(def: NodeDefinition<P>): this {
    if (this.definitions.has(def.type)) {
      throw new Error(`Nodetype "${def.type}" er allerede registrert.`)
    }
    this.definitions.set(def.type, def as NodeDefinition<any>)
    return this
  }

  registerAll(defs: Array<NodeDefinition<any>>): this {
    for (const def of defs) this.register(def)
    return this
  }

  get(type: string): NodeDefinition {
    const def = this.definitions.get(type)
    if (!def) throw new NodeTypeError(`Ukjent nodetype: "${type}".`)
    return def
  }

  has(type: string): boolean {
    return this.definitions.has(type)
  }

  all(): NodeDefinition[] {
    return [...this.definitions.values()]
  }

  /** Nodene som vises i paletten og søk (uten skjulte, eldre typer). */
  listed(): NodeDefinition[] {
    return this.all().filter((d) => !d.hidden)
  }

  byCategory(category: NodeDefinition['category']): NodeDefinition[] {
    return this.listed().filter((d) => d.category === category)
  }
}
