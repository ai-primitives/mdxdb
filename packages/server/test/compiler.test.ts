import { describe, it, expect, beforeAll } from 'vitest'
import { initializeCompiler, compileMDX, compileToESM } from '../src/compiler'

describe('MDX Compiler', () => {
  beforeAll(async () => {
    await initializeCompiler()
  })

  it('should compile MDX to ESM format', async () => {
    const mdx = `
export const meta = {
  title: 'Test'
}

# Hello World

This is a test MDX file.
    `

    const result = await compileToESM(mdx)
    expect(result).toContain('import { Fragment, jsx')
    expect(result).toContain('from "react/jsx-runtime"')
    expect(result).toContain('useMDXComponents')
    expect(result).toContain('from "@mdx-js/react"')
    expect(result).toContain('MDXContent')
    expect(result).toContain('meta')
    expect(result).toContain('title')
    expect(result).toContain('Test')
  })

  it('should support custom compilation options', async () => {
    const mdx = `
export const x = 1 + 2

# Math Example

The value of x is {x}.
    `
    // Test minified output
    const minifiedResult = await compileMDX(mdx, { minify: true, development: false })
    if (!('outputFiles' in minifiedResult)) {
      throw new Error('Expected BuildResult with outputFiles')
    }
    if (!minifiedResult.outputFiles?.length) {
      throw new Error('Expected at least one output file')
    }
    const minified = minifiedResult.outputFiles[0]
    expect(minified).toBeDefined()
    expect(minified.text).toMatch(/[a-zA-Z_$][0-9a-zA-Z_$]*=3/)
    expect(minified.text).toContain('jsx-runtime')
    expect(minified.text).toContain('Fragment')
    expect(minified.text).toMatch(/function\s+[a-zA-Z_$][0-9a-zA-Z_$]*\s*\([^)]*\)/)
    expect(minified.text).toMatch(/export\s+default/)
    expect(minified.text).toContain('useMDXComponents')
    expect(minified.text).toContain('@mdx-js/react')

    // Test non-minified output
    const result = await compileMDX(mdx, { minify: false, development: true })
    if (!('outputFiles' in result)) {
      throw new Error('Expected BuildResult with outputFiles')
    }
    if (!result.outputFiles?.length) {
      throw new Error('Expected at least one output file')
    }
    const output = result.outputFiles[0]
    expect(output).toBeDefined()

    // Verify the export and value computation is preserved
    const hasOriginalExport = output.text.includes('export const x = 1 + 2')
    const hasSplitExport = output.text.includes('var x = 1 + 2') && /export\s*{\s*x\s*}/.test(output.text)
    const hasValueComputation = /(?:var|const)\s+x\s*=\s*1\s*\+\s*2/.test(output.text)

    expect(hasOriginalExport || (hasSplitExport && hasValueComputation)).toBe(true)
    expect(output.text).toContain('jsx-runtime')
    expect(output.text).toContain('Fragment')
    expect(output.text).toContain('function MDXContent')
    expect(output.text).toContain('export default MDXContent')
    expect(output.text).toContain('useMDXComponents')
    expect(output.text).toContain('@mdx-js/react')
  })

  it('should handle JSX syntax', async () => {
    const mdx = `
# Button Example

<button className="primary">Click me</button>
    `
    const result = await compileToESM(mdx)
    expect(result).toContain('import { Fragment, jsx')
    expect(result).toContain('from "react/jsx-runtime"')
    expect(result).toContain('useMDXComponents')
    expect(result).toContain('from "@mdx-js/react"')
    expect(result).toContain('MDXContent')
    expect(result).toContain('button')
    expect(result).toContain('className')
    expect(result).toContain('primary')
    expect(result).toContain('Click me')
  })

  it('should throw error when compilation fails', async () => {
    await expect(compileToESM('{')).rejects.toThrow()
  })

  it('should support both Node.js and Cloudflare Workers environments', async () => {
    const mdx = '# Test'
    const result = await compileMDX(mdx)

    interface BuildResult {
      outputFiles: { text: string }[]
    }

    if (!('outputFiles' in result)) {
      const output = result as { text: string }
      expect(output.text).toContain('useMDXComponents')
      expect(output.text).toContain('from "@mdx-js/react"')
      expect(output.text).toContain('MDXContent')
    } else {
      const buildResult = result as BuildResult
      if (!buildResult.outputFiles?.length) {
        throw new Error('Expected compilation output')
      }
      const output = buildResult.outputFiles[0]
      expect(output.text).toContain('useMDXComponents')
      expect(output.text).toContain('@mdx-js/react')
      expect(output.text).toMatch(/function\s+[a-zA-Z_$][0-9a-zA-Z_$]*\s*\([^)]*\)/)
    }
  })
})
