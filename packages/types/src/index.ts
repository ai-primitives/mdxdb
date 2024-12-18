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

export interface SearchOptions<T = Document> {
  limit?: number;
  offset?: number;
}

export interface VectorSearchOptions extends SearchOptions<Document> {
  vector: number[];
}

export interface FilterQuery<T = Document> {
  [key: string]: T[keyof T] | {
    $eq?: T[keyof T],
    $gt?: T[keyof T],
    $gte?: T[keyof T],
    $lt?: T[keyof T],
    $lte?: T[keyof T],
    $in?: T[keyof T][],
    $nin?: T[keyof T][]
  };
}

export interface SearchResult<T = Document> {
  hits: T[];
  total: number;
}

export interface CollectionProvider<T = Document> {
  find(query: FilterQuery<T>, options?: SearchOptions<T>): Promise<SearchResult<T>>;
  findOne(query: FilterQuery<T>): Promise<T | null>;
  insert(doc: T): Promise<void>;
  update(query: FilterQuery<T>, update: Partial<T>): Promise<void>;
  delete(query: FilterQuery<T>): Promise<void>;
  vectorSearch(options: VectorSearchOptions & SearchOptions<T>): Promise<SearchResult<T>>;
}

export interface DatabaseProvider<T = Document> extends Provider {
  collection(name: string): CollectionProvider<T>;
}
