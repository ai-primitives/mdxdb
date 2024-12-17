import { type BuildOptions, type BuildResult } from 'esbuild'
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

export const compileMDX = async (
  content: string,
  options: CompileOptions = {}
): Promise<BuildResult> => {
  if (!initialized) {
    await initializeCompiler()
  }

  // Extract original exports before compilation
  const exportMatches = content.match(/export\s+const\s+[^;]+;/g) || []
  const originalExports = exportMatches.join('\n')

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
    'const _provideComponents = () => ({ useMDXComponents })',
    originalExports  // Add original exports back
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

  if (!esbuild) {
    throw new Error('Compiler not initialized')
  }

  // First pass: compile without minification to preserve export default
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

  if (!preTransform.outputFiles?.length) {
    throw new Error('Compilation failed: No output generated')
  }

  // Extract the default export name
  const exportMatch = preTransform.outputFiles[0].text.match(/export\s+default\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/m)
  const exportedName = exportMatch ? exportMatch[1] : '_createMdxContent'

  // Second pass: apply minification if needed
  const buildOptions: BuildOptions = {
    stdin: {
      contents: preTransform.outputFiles[0].text,
      loader: 'jsx',
      sourcefile: 'mdx.jsx'
    },
    format: 'esm',
    platform: 'neutral',
    minify: options.minify ?? false,
    minifyWhitespace: options.minify ?? false,
    minifyIdentifiers: false,  // Prevent mangling of identifiers
    minifySyntax: false,      // Preserve original syntax including exports
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

  let finalOutput = result.outputFiles[0].text

  // Ensure proper export default statement
  if (!finalOutput.includes('export default')) {
    // Handle both named exports and direct exports, including minified format
    const exportPattern = /export\s*{([^}]+)}/
    const match = finalOutput.match(exportPattern)

    if (match) {
      // For ultra-minified output, look for any identifier followed by "as default"
      const defaultExportMatch = match[1].match(/([a-zA-Z_$][0-9a-zA-Z_$]*)\s*as\s*default/)
      const nameToExport = defaultExportMatch ? defaultExportMatch[1] : exportedName

      // Replace the entire export statement, handling both named and default exports
      const exportStatements = match[1].split(',').filter(exp => !exp.includes('as default'))
      const namedExports = exportStatements.length > 0 ? `export{${exportStatements.join(',')}};` : ''

      finalOutput = finalOutput.replace(
        match[0],
        `${namedExports}\nexport default ${nameToExport}`
      )
    } else {
      finalOutput = `${finalOutput}\nexport default ${exportedName};`
    }
  }

  return {
    ...result,
    outputFiles: [
      {
        ...result.outputFiles[0],
        text: finalOutput
      }
    ]
  }
}

export const compileToESM = async (content: string, options: CompileOptions = {}): Promise<string> => {
  const result = await compileMDX(content, { ...options, format: 'esm' })
  if (!result.outputFiles?.length) {
    throw new Error('Compilation failed: No output generated')
  }
  return result.outputFiles[0].text
}
