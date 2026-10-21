import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Laster en legacy-fil (IIFE/CJS) i en isolert vm-kontekst.
 *
 * Legacy-filene er ikke ESM, så de kan ikke importeres direkte av Vite.
 * Denne hjelparen gjør at paritetstestene kan sammenligne den gamle
 * implementasjonen mot den nye, bit for bit.
 */
export function loadLegacy<T = any>(relativePath: string): T {
  const path = resolve(here, '../../src/legacy', relativePath)
  const code = readFileSync(path, 'utf8')

  const sandbox: Record<string, unknown> = {
    module: { exports: {} as Record<string, unknown> },
    exports: {},
    console,
    Math,
    JSON,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: path })

  const exported = (sandbox.module as { exports: Record<string, unknown> }).exports
  // Noen legacy-filer eksporterer via globalThis i stedet for module.exports.
  const globals = sandbox as Record<string, unknown>
  const fallback = Object.keys(globals).find(
    (k) => !['module', 'exports', 'console', 'Math', 'JSON', 'globalThis'].includes(k),
  )

  return (exported && Object.keys(exported).length ? exported : (fallback ? globals[fallback] : {})) as T
}
