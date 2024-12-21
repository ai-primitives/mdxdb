import * as vscode from 'vscode'
import type { Document } from '@mdxdb/types'
import type { FSCollection } from '@mdxdb/fs/src/collection'
import * as path from 'path'
import { createProvider } from './providerFactory'

interface MDXDocument extends Document {
  id: string;
  content: string;
  data: Record<string, unknown>;
  metadata: {
    type: 'mdx';
    path: string;
    ts: number;
  };
}

export class MDXFileSystemProvider implements vscode.FileSystemProvider {
  private db: Awaited<ReturnType<typeof createProvider>> | undefined
  private collection: FSCollection | undefined
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>()
  private initializationPromise: Promise<void>

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event

  constructor() {
    this.initializationPromise = this.initialize()
  }

  private async initialize(): Promise<void> {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.'
    const config = vscode.workspace.getConfiguration('mdxdb')
    const fsPath = config.get<string>('fs.path') || '.'
    const _basePath = path.resolve(workspacePath, fsPath)
    
    this.db = await createProvider()
    this.collection = this.db.collection('mdx') as FSCollection
  }

  watch(_uri: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
    return { dispose: () => {} }
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    try {
      const docs = await this.collection.get(uri.fsPath)
      const doc = docs[0]
      if (!doc) {
        throw vscode.FileSystemError.FileNotFound(uri)
      }
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

  async readDirectory(_uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    const docs = await this.collection.get(_uri.fsPath)
    return docs
      .filter((doc): doc is Document & { metadata: { id: string } } => Boolean(doc.metadata?.id))
      .map(doc => [path.basename(doc.metadata.id), vscode.FileType.File])
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    try {
      const docs = await this.collection.get(uri.fsPath)
      const doc = docs[0]
      if (!doc) {
        throw vscode.FileSystemError.FileNotFound(uri)
      }
      return new TextEncoder().encode(doc.content)
    } catch (_error) {
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, _options: { readonly create: boolean; readonly overwrite: boolean }): Promise<void> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    const doc: MDXDocument = {
      id: uri.fsPath,
      content: new TextDecoder().decode(content),
      data: {},
      metadata: {
        type: 'mdx',
        path: uri.fsPath,
        ts: Date.now()
      }
    }
    await this.collection.add(uri.fsPath, doc)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }])
  }

  async delete(uri: vscode.Uri, _options: { readonly recursive: boolean }): Promise<void> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    await this.collection.delete(uri.fsPath, uri.fsPath)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }])
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, _options: { readonly overwrite: boolean }): Promise<void> {
    await this.initializationPromise
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    const docs = await this.collection.get(oldUri.fsPath)
    const doc = docs[0]
    if (!doc) {
      throw vscode.FileSystemError.FileNotFound(oldUri)
    }
    doc.metadata = { ...doc.metadata, id: newUri.fsPath }
    await this.collection.add(newUri.fsPath, doc)
    await this.collection.delete(oldUri.fsPath, oldUri.fsPath)
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
