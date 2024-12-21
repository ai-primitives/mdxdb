import * as vscode from 'vscode'
import { FSDatabase, FSCollection } from '@mdxdb/fs'
import { Document } from '@mdxdb/types'
import * as path from 'path'

export class MDXFileSystemProvider implements vscode.FileSystemProvider {
  private db: FSDatabase
  private collection: FSCollection
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>()

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event

  constructor() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.'
    const fsPath = vscode.workspace.getConfiguration('mdxdb').get('fs.path') || '.'
    const basePath = path.resolve(workspacePath, fsPath)
    
    this.db = new FSDatabase({ path: basePath })
    this.collection = this.db.collection('mdx')
  }

  watch(_uri: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
    return { dispose: () => {} }
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    try {
      const doc = await this.collection.get(uri.fsPath)
      return {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: new TextEncoder().encode(doc.content).length,
      }
    } catch (_error) {
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const docs = await this.collection.list()
    return docs.map((doc: { id: string }) => [path.basename(doc.id), vscode.FileType.File])
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    try {
      const doc = await this.collection.get(uri.fsPath)
      return new TextEncoder().encode(doc.content)
    } catch (_error) {
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, _options: { readonly create: boolean; readonly overwrite: boolean }): Promise<void> {
    const doc: Document = {
      id: uri.fsPath,
      content: content.toString(),
      data: {}
    }
    await this.collection.set(doc)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }])
  }

  async delete(uri: vscode.Uri, _options: { readonly recursive: boolean }): Promise<void> {
    await this.collection.delete(uri.fsPath)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }])
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { readonly overwrite: boolean }): Promise<void> {
    const doc = await this.collection.get(oldUri.fsPath)
    doc.id = newUri.fsPath
    await this.collection.set(doc)
    await this.collection.delete(oldUri.fsPath)
    this._onDidChangeFile.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ])
  }

  createDirectory(uri: vscode.Uri): void | Promise<void> {
    // Directories not supported in MDX database
    throw vscode.FileSystemError.NoPermissions(uri)
  }
}
