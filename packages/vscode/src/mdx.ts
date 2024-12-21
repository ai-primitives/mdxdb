import { compile } from '@mdx-js/mdx'
import { Document } from '@mdxdb/types'
import * as JSON5 from 'json5'

export async function parseMDX(content: string): Promise<{ ast: Record<string, unknown>; html: string }> {
  try {
    const compiled = await compile(content, {
      outputFormat: 'function-body',
      development: false,
      jsx: false,
      format: 'mdx'
    })

    // Extract AST from compilation result
    const ast = JSON5.parse(JSON.stringify(compiled.data.estree))

    // For now, return the compiled content as HTML
    // TODO: Implement proper React/JSX rendering
    const html = String(compiled)

    return { ast, html }
  } catch (error) {
    console.error('Error parsing MDX:', error)
    throw error
  }
}

export function parseDocument(doc: Document): { frontmatter: Record<string, unknown>; content: string } {
  const { data, content } = doc
  const frontmatter = { ...data }

  // Handle special fields
  const specialFields = ['type', 'context', 'id', 'language', 'base', 'vocab', 'list', 'set', 'reverse']
  specialFields.forEach(field => {
    if (field in frontmatter) {
      frontmatter[`$${field}`] = frontmatter[field]
      delete frontmatter[field]
    }
  })

  return { frontmatter, content }
}
