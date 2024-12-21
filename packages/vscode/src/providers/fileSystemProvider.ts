import * as vscode from 'vscode'
import type { Document, DatabaseProvider } from '@mdxdb/types'
import type { FSCollection } from '@mdxdb/fs/src/collection'
import * as path from 'path'

interface MDXDocument extends Document {
  id: string;
  content: string;
  data: Record<string, unknown>;
  metadata: {
    id: string;
    type: 'mdx';
    path: string;
    ts: number;
  };
}

export class MDXFileSystemProvider implements vscode.FileSystemProvider {
  private collection: FSCollection | undefined
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>()

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event

  constructor(private db: DatabaseProvider<Document>) {
    this.collection = this.db.collection('mdx') as FSCollection
  }

  watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
    // Log watch request for debugging
    console.debug('File system watch requested:', { uri: uri.toString(), options })
    return { dispose: () => {} }
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
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
    } catch (error) {
      console.error('Error in stat operation:', error)
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  async readDirectory(_uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    const docs = await this.collection.get(_uri.fsPath)
    return docs
      .filter((doc): doc is Document & { metadata: { id: string } } => Boolean(doc.metadata?.id))
      .map(doc => [path.basename(doc.metadata.id), vscode.FileType.File])
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
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
    } catch (error) {
      console.error('Error in readFile operation:', error)
      throw vscode.FileSystemError.FileNotFound(uri)
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean }): Promise<void> {
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    console.debug('Writing file:', { uri: uri.toString(), create: options.create, overwrite: options.overwrite })
    const doc: MDXDocument = {
      id: uri.fsPath,
      content: new TextDecoder().decode(content),
      data: {},
      metadata: {
        id: uri.fsPath,
        type: 'mdx',
        path: uri.fsPath,
        ts: Date.now()
      }
    }
    await this.collection.add(uri.fsPath, doc)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }])
  }

  async delete(uri: vscode.Uri, options: { readonly recursive: boolean }): Promise<void> {
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    console.debug('Deleting file:', { uri: uri.toString(), recursive: options.recursive })
    await this.collection.delete(uri.fsPath, uri.fsPath)
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Deleted, uri }])
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean }): Promise<void> {
    if (!this.collection) {
      throw vscode.FileSystemError.Unavailable('Provider not initialized')
    }
    console.debug('Renaming file:', { oldUri: oldUri.toString(), newUri: newUri.toString(), overwrite: options.overwrite })
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
