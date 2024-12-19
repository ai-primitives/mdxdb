import { Command } from 'commander'
import { importCommand } from './import.js'

export const program = new Command()
  .name('mdxdb')
  .description('MDXDB CLI tool for managing MDX documents')
  .version('0.1.0')

program.addCommand(importCommand)
