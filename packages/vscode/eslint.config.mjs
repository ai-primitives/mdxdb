import baseConfig from '../../utilities/eslint-config/index.js'

const vscodeConfig = [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    }
  },
  {
    files: ['src/test/**/*.ts'],
    languageOptions: {
      globals: {
        suite: 'readonly',
        test: 'readonly'
      }
    }
  }
]

export default vscodeConfig;
