import type { BuildOptions } from 'esbuild'
import { compile } from '@mdx-js/mdx'

export interface CompileOptions {
  format?: 'esm' | 'cjs'
  minify?: boolean
  sourcemap?: boolean
  target?: string
  jsxImportSource?: string
  development?: boolean
}

let initialized = false
let esbuild: typeof import('esbuild') | typeof import('esbuild-wasm')

export const initializeCompiler = async (wasmURL?: string) => {
  if (!initialized) {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      esbuild = await import('esbuild')
      initialized = true
    } else {
      esbuild = await import('esbuild-wasm')
      await (esbuild as typeof import('esbuild-wasm')).initialize({
        wasmURL: wasmURL || 'https://unpkg.com/esbuild-wasm@0.19.0/esbuild.wasm'
      })
      initialized = true
    }
  }
}

export const compileMDX = async (content: string, options: CompileOptions = {}) => {
  if (!initialized) {
    await initializeCompiler()
  }

  const compiled = await compile(content, {
    jsx: true,
    jsxImportSource: options.jsxImportSource || 'react',
    development: options.development ?? process.env.NODE_ENV !== 'production'
  })

  if (!esbuild) {
    throw new Error('Compiler not initialized')
  }

  const buildOptions: BuildOptions = {
    stdin: {
      contents: String(compiled),
      loader: 'jsx'
    },
    format: options.format || 'esm',
    minify: options.minify,
    sourcemap: options.sourcemap,
    target: options.target || 'es2020',
    bundle: true,
    write: false,
    jsx: 'automatic',
    jsxImportSource: options.jsxImportSource || 'react',
    external: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@mdx-js/react'
    ]
  }

  const result = await esbuild.build(buildOptions)

  if (!result.outputFiles?.length) {
    throw new Error('Compilation failed: No output generated')
  }

  return result
}

export const compileToESM = async (content: string, options: CompileOptions = {}) => {
  const result = await compileMDX(content, { ...options, format: 'esm' })
  if (!result.outputFiles?.length) {
    throw new Error('Compilation failed: No output generated')
  }
  return result.outputFiles[0].text
}
