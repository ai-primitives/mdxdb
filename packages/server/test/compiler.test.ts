import { describe, it, expect, beforeAll } from 'vitest'
import { initializeCompiler, compileMDX, compileToESM } from '../src/compiler'

describe('MDX Compiler', () => {
  beforeAll(async () => {
    await initializeCompiler()
  })

  it('should compile MDX to ESM format', async () => {
    const mdx = `
      # Hello World

      This is a test MDX file.

      export const meta = {
        title: 'Test'
      }
    `

    const result = await compileToESM(mdx)
    expect(result).toContain('export')
    expect(result).toContain('meta')
  })

  it('should support custom compilation options', async () => {
    const mdx = 'const x = 1 + 2'
    const result = await compileMDX(mdx, { minify: true })
    expect(result.outputFiles[0].text).toContain('const x=3')
  })

  it('should handle JSX syntax', async () => {
    const mdx = `
      import { Button } from './components'

      <Button>Click me</Button>
    `
    const result = await compileToESM(mdx)
    expect(result).toContain('Button')
    expect(result).toContain('Click me')
  })
})
