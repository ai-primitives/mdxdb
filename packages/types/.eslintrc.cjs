module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: '/home/ubuntu/repos/mdxdb/packages/types/tsconfig.json',
    tsconfigRootDir: '/home/ubuntu/repos/mdxdb/packages/types',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true
  }
}
