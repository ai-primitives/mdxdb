# Project Status and Tasks

## Setup and Configuration

- [x] Initialize package with TypeScript configuration
- [x] Set up Vitest for testing
- [x] Configure ESLint and Prettier
- [x] Set up basic project structure
- [x] Create placeholder implementation and tests
- [x] Configure package.json with proper metadata

## Implementation
- [x] Basic package structure
  - [x] TypeScript configuration
  - [x] Testing setup with Vitest
  - [x] ESLint and Prettier configuration
- [x] CLI functionality
  - [x] Basic command-line interface
  - [x] Version and help commands

## Packages Implementation
- [ ] @mdxdb/types
  - [ ] Document interface with JSON-LD support
  - [ ] Collection and Database types
  - [ ] Vector search types and options
- [ ] CSV/JSONL Import Feature
  - [ ] CLI Setup
    - [ ] Create bin directory and CLI entry point
    - [ ] Add commander.js for CLI argument parsing
    - [ ] Add import command implementation
  - [ ] Import Implementation
    - [ ] Add yaml package for frontmatter handling
    - [ ] Implement CSV parser using csv-parse
    - [ ] Implement JSONL parser using readline
    - [ ] Add frontmatter generation from record fields
    - [ ] Add MDX content generation from template/field
  - [ ] Testing
    - [ ] Add unit tests for parsers
    - [ ] Add integration tests for import command
    - [ ] Add example files for testing
  - [ ] Documentation
    - [ ] Add usage examples to README
    - [ ] Add API documentation for programmatic usage
- [ ] @mdxdb/fetch
  - [ ] HTTP/API provider implementation
  - [ ] RESTful endpoints integration
  - [ ] Error handling
- [x] @mdxdb/fs
  - [x] Filesystem storage implementation
  - [x] AI embeddings integration
  - [x] Cosine similarity using ai package
- [ ] @mdxdb/clickhouse
  - [x] Schema implementation
    - [x] MergeTree oplog table
    - [x] VersionedCollapsingMergeTree data table
    - [x] Materialized view configuration
  - [ ] Client setup with @clickhouse/client-web
  - [ ] Environment variables configuration
  - [ ] Cosine distance implementation
- [ ] @mdxdb/server
  - [ ] Hono REST API setup
  - [ ] OpenAI embeddings integration
  - [ ] CRUD endpoints
  - [ ] Vector search endpoints

## AI Integration
- [x] OpenAI embeddings setup
  - [x] text-embedding-3-large model configuration (256 dimensions)
  - [x] Integration with ai and @ai-sdk/openai packages
  - [x] Error handling and retries for API calls
  - [ ] Rate limiting and batch processing
- [x] Vector similarity implementations
  - [x] fs provider using ai.cosineSimilarity
  - [ ] clickhouse provider using cosineDistance function
  - [x] Threshold configuration and tuning
  - [x] Performance optimization strategies

## Clickhouse Configuration
- [ ] Environment variables setup
  - [ ] CLICKHOUSE_URL configuration (default: http://localhost:8123)
  - [ ] CLICKHOUSE_USERNAME and PASSWORD setup (default: default/'')
  - [ ] CLICKHOUSE_DATABASE configuration (default: default)
  - [ ] CLICKHOUSE_OPLOG_TABLE setup (default: oplog)
  - [ ] CLICKHOUSE_DATA_TABLE setup (default: data)
- [ ] Database and table initialization
  - [ ] Auto-creation of database if not exists
  - [ ] oplog table with MergeTree engine
    - [ ] Implement camelCase column naming
    - [ ] Define sorting and partitioning keys
  - [ ] data table with VersionedCollapsingMergeTree engine
    - [ ] Implement camelCase column naming
    - [ ] Define version and sign columns
    - [ ] Configure sorting and partitioning
- [ ] Query optimization
  - [ ] Implement efficient cosineDistance calculations
  - [ ] Optimize table schemas for vector operations
  - [ ] Configure proper indices for performance

## Testing and Quality Assurance
- [ ] Unit tests
  - [ ] @mdxdb/types type definitions
  - [ ] @mdxdb/fetch HTTP operations
  - [x] @mdxdb/fs filesystem operations
  - [x] @mdxdb/clickhouse database operations
  - [ ] @mdxdb/server API endpoints
- [ ] Integration tests
  - [x] AI embeddings verification
    - [x] OpenAI API integration
    - [x] Embedding dimensions validation
    - [x] Error handling scenarios
  - [x] Vector search accuracy
    - [x] Cosine similarity calculations
    - [x] Search result relevance
    - [x] Performance benchmarks
  - [x] Clickhouse operations
    - [x] Table creation and schema validation
    - [ ] CRUD operations
    - [ ] Vector search queries
- [ ] Documentation
  - [ ] API documentation
    - [ ] Type definitions and interfaces
    - [ ] Provider implementations
    - [ ] Server endpoints
  - [ ] Setup guides
    - [ ] Environment configuration
    - [ ] Clickhouse setup
    - [ ] OpenAI integration
  - [ ] Usage examples
    - [ ] Basic CRUD operations
    - [ ] Vector search implementations
    - [ ] AI feature demonstrations

## Documentation

- [x] Create README with badges and usage instructions
- [ ] Complete CONTRIBUTING.md guide
- [ ] Add API documentation
- [ ] Add examples directory with usage examples

## CI/CD

- [ ] Fix GitHub Actions configuration
  - [ ] Document inconsistent check behavior (PR #1 passed, #2/#3 failed, #5 no checks)
  - [ ] Implement consistent CI workflow
    - [ ] Add build steps for all packages
    - [ ] Configure test execution
    - [ ] Set up ESLint checks
    - [ ] Add TypeScript type checking
- [ ] ESLint Configuration
  - [ ] Use shared eslint-config from utilities
  - [ ] Ensure TypeScript rule compatibility
  - [ ] Maintain ESM support across packages
- [ ] Package Dependencies
  - [ ] Standardize TypeScript version (5.5.4)
  - [ ] Use Vitest 2.1.8 with MSW integration
  - [ ] Consistent ESLint package versions
- [ ] Testing Requirements
  - [ ] Run tests with Vitest
  - [ ] Include MSW for API mocking
  - [ ] Maintain >80% coverage
- [ ] Release Process
  - [ ] Semantic versioning
  - [ ] Automated npm publishing
  - [ ] GitHub Actions integration
- [ ] Set up semantic-release
  - [ ] Configure version bumping
  - [ ] Set up changelog generation
  - [ ] Configure npm publishing
- [ ] Add test coverage reporting
  - [ ] Configure coverage collection
  - [ ] Set up coverage reporting to CI
  - [ ] Add coverage badges to README
- [ ] Set up automated npm publishing
  - [ ] Configure npm authentication
  - [ ] Set up publish workflow
  - [ ] Add version tagging

## Blockers

- ESLint issues in @mdxdb/fs package:
  - Unused variable 'filter' in collection.ts:104
  - Explicit 'any' type used in index.ts:11
  These issues were surfaced after fixing ESLint configuration and should be addressed in a separate PR.

- Type definition and workspace dependency issues:
  - Missing type definitions for CollectionProvider methods (create, get)
  - Missing @mdxdb/clickhouse module and type declarations
  - DatabaseProvider<Document> type incompatibility with FSDatabase
  - Build failures in @mdxdb/server package due to type errors
  These issues block the server package implementation and need to be resolved.

- CI workflow failures in @mdxdb/clickhouse package:
  - No test files found in the package
  - Causing CI workflow to fail with exit code 1
  - Needs test files to be added or CI configuration updated
  This is blocking PR #12 and needs to be addressed before merging the CI permissions configuration.

- Import command test failures in @mdxdb/fs package:
  - CSV parser import issues with csv-parse/sync module
  - Template file path resolution in test environment
  - Collection.get() method usage instead of list()
  These issues are being addressed in PR #27 and affect the import command functionality.

## Known Issues

- [ ] ESLint configuration issues in @mdxdb/types package
  - TypeScript parser configuration needs review
  - Files not found in project configuration: src/index.d.ts, src/index.js, src/types.d.ts, src/types.js
  - parserOptions.project configuration needs to be updated
- [ ] ESLint rule errors in @workspace/example-package
  - @typescript-eslint/no-unused-expressions rule configuration issue
  - Error in rule loading: Cannot read properties of undefined (reading 'allowShortCircuit')

## Future Enhancements

### @mdxdb/fetch
- [ ] Add WebSocket support for real-time updates
  - [ ] Implement WebSocket connection management
  - [ ] Add real-time collection updates
  - [ ] Support bidirectional communication

### General Enhancements
- [ ] Add more comprehensive examples
- [ ] Add changelog generation
- [ ] Add pull request template
- [ ] Add issue templates
