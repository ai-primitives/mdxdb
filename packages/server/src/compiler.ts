import { type BuildOptions, type BuildResult, initialize } from 'esbuild'
import { compile } from '@mdx-js/mdx'
import type { ImportDeclaration, ImportSpecifier, Identifier, ExportDefaultDeclaration, Node } from 'estree'
import type { VFile } from 'vfile'

interface Program {
  type: 'Program'
  body: Node[]
  sourceType: 'module' | 'script'
}

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

interface MDXOutput {
  text: string
  map?: VFile['data']['map']
}

export const compileMDX = async (
  content: string,
  options: CompileOptions = {}
): Promise<BuildResult | MDXOutput> => {
  if (!initialized) {
    await initializeCompiler()
  }

  const compiled = await compile(content, {
    jsx: true,
    jsxImportSource: options.jsxImportSource || 'react',
    development: options.development ?? process.env.NODE_ENV !== 'production',
    format: 'mdx',
    providerImportSource: '@mdx-js/react',
    recmaPlugins: [
      () => (tree: Program) => {
        const hasUseMDXComponents = tree.body.some(
          (node): node is ImportDeclaration =>
            node.type === 'ImportDeclaration' &&
            node.source.value === '@mdx-js/react' &&
            node.specifiers.some(
              (spec): spec is ImportSpecifier =>
                spec.type === 'ImportSpecifier' &&
                (spec.imported as Identifier).name === 'useMDXComponents'
            )
        )

        if (!hasUseMDXComponents) {
          tree.body.unshift({
            type: 'ImportDeclaration',
            source: { type: 'Literal', value: '@mdx-js/react' },
            specifiers: [
              {
                type: 'ImportSpecifier',
                imported: { type: 'Identifier', name: 'useMDXComponents' },
                local: { type: 'Identifier', name: 'useMDXComponents' }
              }
            ]
          } as ImportDeclaration)
        }

        const hasDefaultExport = tree.body.some(
          (node): node is ExportDefaultDeclaration =>
            node.type === 'ExportDefaultDeclaration'
        )

        if (!hasDefaultExport) {
          tree.body.push({
            type: 'ExportDefaultDeclaration',
            declaration: {
              type: 'Identifier',
              name: 'MDXContent'
            }
          } as ExportDefaultDeclaration)
        }
      }
    ]
  })

  const mdxOutput: MDXOutput = {
    text: String(compiled),
    map: compiled.map
  }

  if (options.format || options.minify || options.sourcemap) {
    if (!esbuild) {
      throw new Error('Compiler not initialized')
    }

    const buildOptions: BuildOptions = {
      stdin: {
        contents: mdxOutput.text,
        loader: 'jsx',
        sourcefile: 'mdx.jsx'
      },
      format: options.format === 'cjs' ? 'cjs' : 'esm',
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
      ],
      keepNames: true,
      metafile: true,
      treeShaking: false,
      legalComments: 'none'
    }

    const result = await esbuild.build(buildOptions)

    if (!result.outputFiles?.length) {
      throw new Error('Compilation failed: No output generated')
    }

    return result
  }

  return mdxOutput
}

export const compileToESM = async (content: string, options: CompileOptions = {}): Promise<string> => {
  const result = await compileMDX(content, { ...options, format: 'esm' })
  if ('outputFiles' in result) {
    if (!result.outputFiles?.length) {
      throw new Error('Compilation failed: No output generated')
    }
    return result.outputFiles[0].text
  }
  return result.text
}
