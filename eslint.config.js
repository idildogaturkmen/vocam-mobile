import typescript from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['node_modules', 'dist', 'build', 'android', 'ios'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // Se você usar tsconfig
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
    },
    rules: {
      // Regras TypeScript opcionais
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',

      // Regras Prettier
      'prettier/prettier': [
        'error',
        {
          useTabs: false,
          tabWidth: 4,
          singleQuote: true,
          semi: true,
          endOfLine: 'auto',
          printWidth: 100,
          trailingComma: 'all',
        },
      ],
    },
  },
];
