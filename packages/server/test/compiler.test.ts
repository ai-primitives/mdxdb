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
    const result = await compileMDX(mdx, { minify: true, development: false })
    const output = result.outputFiles?.[0]
    expect(output).toBeDefined()
    expect(output?.text).toContain('var u=3')
    expect(output?.text).toContain('MDXContent')
    expect(output?.text).toContain('jsx-runtime')
  })

  it('should handle JSX syntax', async () => {
    const mdx = `
# Button Example

<button className="primary">Click me</button>
    `
    const result = await compileToESM(mdx)
    expect(result).toContain('import { Fragment, jsx')
    expect(result).toContain('from "react/jsx-runtime"')
    expect(result).toContain('MDXContent')
    expect(result).toContain('button')
    expect(result).toContain('className')
    expect(result).toContain('primary')
    expect(result).toContain('Click me')
  })

  it('should throw error when compilation fails', async () => {
    await expect(compileToESM('{')).rejects.toThrow()
  })
})
