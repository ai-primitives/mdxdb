export interface Provider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(query: string): Promise<T>;
}

export interface Document {
  id: string;
  content: string;
  data?: Record<string, any>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export interface VectorSearchOptions extends SearchOptions {
  vector: number[];
}

export interface FilterQuery {
  [key: string]: any;
}

export interface SearchResult<T = Document> {
  hits: T[];
  total: number;
}

export interface CollectionProvider {
  find(query: FilterQuery, options?: SearchOptions): Promise<SearchResult>;
  findOne(query: FilterQuery): Promise<Document | null>;
  insert(doc: Document): Promise<void>;
  update(query: FilterQuery, update: Partial<Document>): Promise<void>;
  delete(query: FilterQuery): Promise<void>;
  vectorSearch(options: VectorSearchOptions): Promise<SearchResult>;
}

export interface DatabaseProvider extends Provider {
  collection(name: string): CollectionProvider;
}
