# @mdxdb/vscode

[![npm version](https://badge.fury.io/js/%40mdxdb%2Fvscode.svg)](https://www.npmjs.com/package/@mdxdb/vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

VSCode extension for MDX file management with integrated AST viewing and preview capabilities.

## Features

- MDX File Management
  - List and browse MDX files in workspace
  - View and edit MDX content with syntax highlighting
  - Integrated file system provider support

- AST Visualization
  - View MDX Abstract Syntax Tree in JSON5 format
  - Real-time AST updates as you edit
  - Collapsible tree view for easy navigation

- MDX Preview
  - Live preview of rendered MDX content
  - Support for React components
  - Hot reload on content changes

- Content Type Support
  - Structured Data: YAML frontmatter with optional schema validation
  - Unstructured Content: Markdown editing and preview
  - Executable Code: JavaScript/TypeScript import/export functionality
  - UI Components: JSX/React component integration

## Installation

```bash
npm install @mdxdb/vscode
```

## Usage

1. Open an MDX file in VSCode
2. Use the MDX sidebar to browse files
3. Toggle between edit, AST, and preview modes using the toolbar
4. Edit content with real-time AST and preview updates

## Configuration

```json
{
  'mdxdb.fs.path': '.', // Base path for file system provider
  'mdxdb.preview.refreshInterval': 1000, // Preview refresh rate in ms
  'mdxdb.ast.format': 'json5' // AST output format
}
```

## API

```typescript
import { MDXProvider } from '@mdxdb/vscode'

// Initialize provider
const provider = new MDXProvider({
  basePath: '.',
  openaiApiKey: process.env.OPENAI_API_KEY
})

// List MDX files
const files = await provider.listFiles()

// Get file content
const content = await provider.getContent('example.mdx')

// Get AST
const ast = await provider.getAST('example.mdx')
```

## Dependencies

- @mdxdb/fs: ^0.1.0
- @mdxdb/types: ^0.1.0
- vscode-languageclient: ^8.0.0
- json5: ^2.2.0
