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

export interface SearchResult<T = Document> {
  hits: Array<{
    document: T;
    score: number;
  }>;
  total: number;
}

export interface SearchOptions<T = Document> {
  limit?: number;
  offset?: number;
  sort?: {
    field: keyof T;
    order: 'asc' | 'desc';
  };
}

export interface VectorSearchOptions {
  vector: number[];
  threshold?: number;
}

export interface FilterQuery<T = Document> {
  [key: string]: T[keyof T] | {
    $eq?: T[keyof T];
    $gt?: T[keyof T];
    $gte?: T[keyof T];
    $lt?: T[keyof T];
    $lte?: T[keyof T];
    $ne?: T[keyof T];
    $in?: T[keyof T][];
    $nin?: T[keyof T][];
  } | undefined;
}

export interface CollectionProvider<T = Document> {
  find(collection: string, filter: FilterQuery<T>, options?: SearchOptions<T>): Promise<T[]>;
  findOne?(collection: string, filter: FilterQuery<T>): Promise<T | null>;
  insert(collection: string, document: T): Promise<void>;
  update(collection: string, id: string, document: Partial<T>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>>;
}

export interface DatabaseProvider<T = Document> extends Provider {
  collection(name: string): CollectionProvider<T>;
}
