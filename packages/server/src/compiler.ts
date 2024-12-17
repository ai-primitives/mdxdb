import * as esbuild from 'esbuild-wasm'
import { type BuildResult } from 'esbuild-wasm'

export interface CompileOptions {
  format?: 'esm' | 'cjs'
  minify?: boolean
  sourcemap?: boolean
  target?: string
}

let initialized = false

export const initializeCompiler = async (wasmURL?: string) => {
  if (!initialized) {
    await esbuild.initialize({
      wasmURL: wasmURL || 'https://unpkg.com/esbuild-wasm@0.19.0/esbuild.wasm'
    })
    initialized = true
  }
}

export const compileMDX = async (content: string, options: CompileOptions = {}): Promise<BuildResult> => {
  if (!initialized) {
    await initializeCompiler()
  }

  const result = await esbuild.build({
    stdin: {
      contents: content,
      loader: 'jsx'
    },
    format: options.format || 'esm',
    minify: options.minify,
    sourcemap: options.sourcemap,
    target: options.target || 'es2020',
    bundle: true,
    write: false
  })

  if (!result.outputFiles?.length) {
    throw new Error('Compilation failed: No output generated')
  }

  return result
}

export const compileToESM = async (content: string): Promise<string> => {
  const result = await compileMDX(content, { format: 'esm' })
  if (!result.outputFiles?.[0]) {
    throw new Error('Compilation failed: No output generated')
  }
  return result.outputFiles[0].text
}
