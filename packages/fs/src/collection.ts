// Placeholder file for FSCollection - will be implemented in step 004
import { CollectionProvider, Document, FilterQuery, SearchOptions, VectorSearchOptions } from '@mdxdb/types'

export class FSCollection implements CollectionProvider<Document> {
  constructor(
    private basePath: string,
    public path: string
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async find(filter: FilterQuery<Document>): Promise<Document[]> {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(query: string, options?: SearchOptions<Document>): Promise<Document[]> {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async vectorSearch(options: VectorSearchOptions & SearchOptions<Document>): Promise<Document[]> {
    return []
  }
}
