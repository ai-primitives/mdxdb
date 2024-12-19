import { Command } from 'commander'
import { parse } from 'csv-parse'
import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { createInterface } from 'readline'
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml'
import { FSDatabase } from '../index.js'
import path from 'path'

interface ImportOptions {
  collection: string
  format?: 'csv' | 'jsonl'
  idField?: string
  contentField?: string
  template?: string
  frontmatterFields?: string
}

export const importCommand = new Command('import')
  .description('Import CSV or JSONL file into MDX documents')
  .argument('<file>', 'Input file (CSV or JSONL)')
  .requiredOption('-c, --collection <name>', 'Collection name')
  .option('-f, --format <format>', 'Input format (csv|jsonl)', (value: string) => {
    if (!['csv', 'jsonl'].includes(value)) {
      throw new Error('Format must be either csv or jsonl')
    }
    return value as 'csv' | 'jsonl'
  })
  .option('-i, --id-field <field>', 'Field to use as document ID')
  .option('-m, --content-field <field>', 'Field to use as main MDX content')
  .option('-t, --template <file>', 'MDX template file to use for content')
  .option('-F, --frontmatter-fields <fields>', 'Fields to include in frontmatter (comma-separated)')
  .action(async (file: string, options: ImportOptions) => {
    try {
      // Auto-detect format if not specified
      const format = options.format || (path.extname(file).toLowerCase() === '.csv' ? 'csv' : 'jsonl')

      // Initialize database with current directory as base path
      const db = new FSDatabase(process.cwd())
      await db.connect()

      // Create collection if it doesn't exist
      const collection = db.collection(options.collection)
      await collection.create(options.collection)

      // Load template if specified
      let template = ''
      if (options.template) {
        template = await readFile(options.template, 'utf-8')
      }

      // Parse frontmatter field list
      const frontmatterFields = options.frontmatterFields?.split(',') || []

      // Process records based on format
      if (format === 'csv') {
        const parser = createReadStream(file).pipe(
          parse({
            columns: true,
            skip_empty_lines: true
          })
        )

        for await (const record of parser) {
          await processRecord(record)
        }
      } else {
        const fileStream = createInterface({
          input: createReadStream(file),
          crlfDelay: Infinity
        })

        for await (const line of fileStream) {
          if (line.trim()) {
            const record = JSON.parse(line)
            await processRecord(record)
          }
        }
      }

      async function processRecord(record: Record<string, any>) {
        // Generate document ID
        const id = options.idField ? record[options.idField] : crypto.randomUUID()

        // Generate content
        let content = ''
        if (options.contentField && record[options.contentField]) {
          content = record[options.contentField]
        } else if (template) {
          content = template
        }

        // Generate frontmatter
        const frontmatter: Record<string, any> = {}
        const fields = frontmatterFields.length > 0 ? frontmatterFields : Object.keys(record)

        for (const field of fields) {
          if (field in record && field !== options.contentField) {
            // Convert @ prefixes to $ for YAML-LD compatibility
            const key = field.startsWith('@') ? `$${field.slice(1)}` : field
            frontmatter[key] = record[field]
          }
        }

        // Create MDX document with YAML frontmatter
        const mdx = `---\n${stringifyYAML(frontmatter)}---\n\n${content}`

        // Add document to collection
        await collection.add(options.collection, {
          id,
          content: mdx,
          data: frontmatter
        })
      }

      console.log('Import completed successfully')
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Import failed:', error.message)
      } else {
        console.error('Import failed with unknown error')
      }
      process.exit(1)
    }
  })
