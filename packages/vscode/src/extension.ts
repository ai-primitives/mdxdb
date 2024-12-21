/// <reference types="node" />
import * as vscode from 'vscode'
import { MDXFileSystemProvider } from './providers/fileSystemProvider'
import * as JSON5 from 'json5'
import { parseMDX } from './mdx'

type Timeout = ReturnType<typeof setTimeout>

let astPanel: vscode.WebviewPanel | undefined
let previewPanel: vscode.WebviewPanel | undefined
const fileSystemProvider = new MDXFileSystemProvider()

export function activate(context: vscode.ExtensionContext) {
  console.log('MDXDB extension is now active!')

  // Register MDX file system provider
  const mdxScheme = 'mdxdb'
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(mdxScheme, fileSystemProvider, { 
      isCaseSensitive: true,
      isReadonly: false 
    })
  )

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mdxdb.openPreview', () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      if (previewPanel) {
        previewPanel.reveal()
      } else {
        previewPanel = vscode.window.createWebviewPanel(
          'mdxPreview',
          'MDX Preview',
          vscode.ViewColumn.Beside,
          { enableScripts: true }
        )

        previewPanel.onDidDispose(() => {
          previewPanel = undefined
        })
      }

      updatePreview(editor.document)
    }),

    vscode.commands.registerCommand('mdxdb.openAst', () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) return

      if (astPanel) {
        astPanel.reveal()
      } else {
        astPanel = vscode.window.createWebviewPanel(
          'mdxAst',
          'MDX AST',
          vscode.ViewColumn.Beside,
          { enableScripts: true }
        )

        astPanel.onDidDispose(() => {
          astPanel = undefined
        })
      }

      updateAst(editor.document)
    })
  )

  // Register document change handlers
  let previewDebounceTimeout: Timeout
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (previewPanel && event.document === vscode.window.activeTextEditor?.document) {
        const debounceMs = vscode.workspace.getConfiguration('mdxdb').get('preview.debounceMs') || 300
        clearTimeout(previewDebounceTimeout)
        previewDebounceTimeout = setTimeout(() => {
          updatePreview(event.document)
        }, debounceMs)
      }

      if (astPanel && event.document === vscode.window.activeTextEditor?.document) {
        updateAst(event.document)
      }
    })
  )
}

async function updatePreview(document: vscode.TextDocument) {
  if (!previewPanel) return

  try {
    const { html } = await parseMDX(document.getText())
    previewPanel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { padding: 1em; font-family: system-ui, -apple-system, sans-serif; }
            pre { background: #f5f5f5; padding: 1em; border-radius: 4px; }
            code { font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `
  } catch (error) {
    previewPanel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { padding: 1em; color: #c41e3a; }
          </style>
        </head>
        <body>
          <h3>Error Rendering MDX</h3>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </body>
      </html>
    `
  }
}

async function updateAst(document: vscode.TextDocument) {
  if (!astPanel) return

  try {
    const { ast } = await parseMDX(document.getText())
    const format = vscode.workspace.getConfiguration('mdxdb').get('ast.format') || 'json5'
    const astString = format === 'json5' ? JSON5.stringify(ast, null, 2) : JSON.stringify(ast, null, 2)

    astPanel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { padding: 1em; }
            pre { 
              white-space: pre-wrap;
              background: #f5f5f5;
              padding: 1em;
              border-radius: 4px;
              font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
            }
          </style>
        </head>
        <body>
          <pre>${astString}</pre>
        </body>
      </html>
    `
  } catch (error) {
    astPanel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { padding: 1em; color: #c41e3a; }
          </style>
        </head>
        <body>
          <h3>Error Parsing AST</h3>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </body>
      </html>
    `
  }
}

export function deactivate() {}
