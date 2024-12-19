import { Command } from 'commander'
import { existsSync, createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import * as path from 'path'
import { parse } from 'csv-parse'
import { createInterface } from 'readline'
import { stringify as stringifyYAML } from 'yaml'
import { FSDatabase } from '../index.js'
import crypto from 'crypto'

interface ImportOptions {
  collection: string
  format?: 'csv' | 'jsonl'
  idField?: string
  contentField?: string
  template?: string
  frontmatterFields?: string
}

function convertPrefixes(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => convertPrefixes(item))
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const newKey = key.startsWith('@') ? key.replace('@', '$') : key
      if (typeof value === 'string' && (key.startsWith('@') || value.trim().startsWith('{'))) {
        try {
          const parsedValue = JSON.parse(value)
          acc[newKey] = typeof parsedValue === 'object' && parsedValue !== null
            ? convertPrefixes(parsedValue)
            : parsedValue
        } catch {
          acc[newKey] = value
        }
      } else if (typeof value === 'object' && value !== null) {
        acc[newKey] = convertPrefixes(value)
      } else {
        acc[newKey] = value
      }
      return acc
    }, {} as Record<string, any>)
  }
  return obj
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
  .option('-t, --template [file]', 'MDX template file to use for content')
  .option('-F, --frontmatter-fields <fields>', 'Fields to include in frontmatter (comma-separated)')
  .action(async (file: string, options: ImportOptions) => {
    try {
      // Auto-detect format if not specified
      const format = options.format || (path.extname(file).toLowerCase() === '.csv' ? 'csv' : 'jsonl')

      // Initialize database with current directory as base path
      const db = new FSDatabase(process.cwd())
      await db.connect()

      // Get collection
      const collection = db.collection(options.collection)
      await collection.create(options.collection)

      // Load template if specified and not empty
      let template = ''
      if (options.template && options.template.trim() !== '') {
        try {
          const templatePath = path.isAbsolute(options.template)
            ? options.template
            : path.resolve(path.dirname(file), options.template)

          if (!existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`)
          }

          template = await readFile(templatePath, 'utf-8')
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to read template file: ${error.message}. Make sure the template file exists and is accessible.`)
          }
          throw error
        }
      }

      // Parse frontmatter field list
      const frontmatterFields = options.frontmatterFields?.split(',').map(f => f.trim()).filter(Boolean) || []

      // Process records based on format
      if (format === 'csv') {
        const parser = createReadStream(file).pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            cast: true,
            cast_date: false,
            trim: true,
            relax_column_count: true
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
            try {
              const record = JSON.parse(line)
              await processRecord(record)
            } catch (error) {
              console.error(`Failed to parse JSONL line: ${error instanceof Error ? error.message : 'unknown error'}`)
              throw error
            }
          }
        }
      }

      async function processRecord(record: Record<string, any>) {
        // Convert @ prefixes to $ for YAML-LD compatibility
        const processedRecord = Object.entries(record).reduce((acc, [key, value]) => {
          const newKey = key.startsWith('@') ? key.replace('@', '$') : key

          // Handle nested objects and arrays
          if (typeof value === 'string' && (key.startsWith('@') || value.trim().startsWith('{'))) {
            try {
              const parsedValue = JSON.parse(value)
              acc[newKey] = Array.isArray(parsedValue)
                ? parsedValue.map(item => convertPrefixes(item))
                : convertPrefixes(parsedValue)
            } catch {
              acc[newKey] = value
            }
          } else if (typeof value === 'object' && value !== null) {
            acc[newKey] = convertPrefixes(value)
          } else {
            acc[newKey] = value
          }
          return acc
        }, {} as Record<string, any>)

        // Generate content from template or content field
        let content = ''
        if (options.contentField && processedRecord[options.contentField]) {
          content = processedRecord[options.contentField]
          // Remove content field from frontmatter if specified
          delete processedRecord[options.contentField]
        } else if (template) {
          content = Object.entries(processedRecord).reduce(
            (text, [key, value]) => text.replace(new RegExp(`{${key}}`, 'g'), String(value)),
            template
          )
        }

        // Filter frontmatter fields if specified
        const frontmatterData = frontmatterFields.length > 0
          ? frontmatterFields.reduce((acc, field) => {
              if (field in processedRecord) {
                acc[field] = processedRecord[field]
              }
              return acc
            }, {} as Record<string, any>)
          : processedRecord

        // Use specified ID field or fall back to title or UUID
        const id = options.idField && processedRecord[options.idField]
          ? processedRecord[options.idField]
          : (processedRecord.title || crypto.randomUUID())

        // Add document to collection
        await collection.add(id, {
          id,
          content: `---\n${stringifyYAML(frontmatterData)}---\n\n${content}`,
          data: frontmatterData
        })
      }

      console.log('Import completed successfully')
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Import failed:', error.message)
        throw error
      } else {
        const unknownError = new Error('Import failed with unknown error')
        console.error(unknownError.message)
        throw unknownError
      }
    }
  })
