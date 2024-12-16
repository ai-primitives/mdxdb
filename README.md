# @ai-primitives/workspace-template

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern TypeScript monorepo template with pnpm workspaces, Turborepo, and shared configurations.

## Features

- 🏗️ pnpm workspaces for package management
- 🚀 Turborepo for build orchestration
- 📦 Example package with TypeScript and Vitest
- 🔧 Shared ESLint and TypeScript configurations
- 🎨 Prettier for consistent code formatting
- 🔄 GitHub Actions for CI/CD

## Getting Started

```bash
# Clone the template
gh repo clone ai-primitives/workspace-template my-workspace

# Install dependencies
cd my-workspace
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Workspace Structure

```
.
├── packages/           # Package implementations
│   └── example-package/
├── sites/             # Frontend applications
├── utilities/         # Shared configurations
│   ├── eslint-config/
│   ├── prettier-config/
│   └── tsconfig/
├── pnpm-workspace.yaml
└── turbo.json
```

## Development Workflow

```bash
# Create a new package
mkdir packages/my-package
cd packages/my-package

# Start development
pnpm dev

# Run tests in watch mode
pnpm test:watch
```

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) to learn about our development process and how to propose bugfixes and improvements.

## License

MIT © [AI Primitives](https://mdx.org.ai)

## Dependencies

This workspace uses the following key dependencies:

- pnpm for package management
- Turborepo for build orchestration
- TypeScript for static typing
- Vitest for testing
- ESLint for linting
- Prettier for code formatting
