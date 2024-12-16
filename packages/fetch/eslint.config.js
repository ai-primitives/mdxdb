import baseConfig from '../../utilities/eslint-config/index.js'

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly'
      }
    }
  }
]
