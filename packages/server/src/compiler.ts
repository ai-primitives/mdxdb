import { type BuildOptions, type BuildResult, initialize } from 'esbuild'
import { compile } from '@mdx-js/mdx'
import type { ImportDeclaration, ImportSpecifier, Identifier, ExportDefaultDeclaration, Node, FunctionDeclaration } from 'estree'
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
    jsxRuntime: 'automatic',
    jsxImportSource: options.jsxImportSource || 'react',
    development: options.development ?? true,
    format: 'mdx',
    providerImportSource: '@mdx-js/react'
  })

  let output = String(compiled)

  // Ensure required imports are present
  const imports = [
    'import { Fragment, jsx, jsxs } from "react/jsx-runtime"',
    'import { useMDXComponents } from "@mdx-js/react"',
    'const _provideComponents = () => ({ useMDXComponents })'
  ].join('\n') + '\n'

  // Remove any duplicate imports that might have been added by the compiler
  output = output.replace(/import\s*{[^}]*}\s*from\s*["']react\/jsx-runtime["'];?\n?/g, '')
  output = output.replace(/import\s*{[^}]*}\s*from\s*["']@mdx-js\/react["'];?\n?/g, '')

  output = imports + output

  if (!output.includes('export default')) {
    const mdxContentMatch = output.match(/function\s+(_createMdxContent\s*\([^)]*\)\s*{[\s\S]*?})/m)
    if (mdxContentMatch) {
      const mdxContent = mdxContentMatch[1]
      output = output.replace(mdxContent, mdxContent + '\nexport default _createMdxContent')
    }
  }

  if (options.minify || (options.format && options.format !== 'esm')) {
    if (!esbuild) {
      throw new Error('Compiler not initialized')
    }

    const preTransform = await esbuild.build({
      stdin: {
        contents: output,
        loader: 'jsx',
        sourcefile: 'mdx.jsx'
      },
      format: 'esm',
      minify: false,
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
      treeShaking: false,
      define: {
        'process.env.NODE_ENV': options.development ? '"development"' : '"production"'
      }
    })

    const exportMatch = preTransform.outputFiles[0].text.match(/export\s+default\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/m)
    const exportedName = exportMatch ? exportMatch[1] : '_createMdxContent'

    output = preTransform.outputFiles[0].text

    const buildOptions: BuildOptions = {
      stdin: {
        contents: output,
        loader: 'jsx',
        sourcefile: 'mdx.jsx'
      },
      format: 'esm',
      platform: 'neutral',
      minify: options.minify ?? false,
      minifyWhitespace: options.minify ?? false,
      minifyIdentifiers: false,
      minifySyntax: false,
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
      legalComments: 'none',
      mainFields: ['module', 'main'],
      outExtension: { '.js': '.mjs' },
      define: {
        'process.env.NODE_ENV': options.development ? '"development"' : '"production"'
      }
    }

    const result = await esbuild.build(buildOptions)

    if (!result.outputFiles?.length) {
      throw new Error('Compilation failed: No output generated')
    }

    let minified = result.outputFiles[0].text

    // Ensure proper export default statement
    if (!minified.includes('export default')) {
      const exportPattern = new RegExp(`export\\s*{[^}]*${exportedName}[^}]*}`)
      const match = minified.match(exportPattern)

      if (match) {
        minified = minified.replace(
          match[0],
          `export default ${exportedName}`
        )
      } else {
        minified = `${minified}\nexport default ${exportedName};`
      }
    }

    return {
      ...result,
      outputFiles: [
        {
          ...result.outputFiles[0],
          text: minified
        }
      ]
    }
  }

  return {
    text: output,
    map: compiled.map
  }
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
