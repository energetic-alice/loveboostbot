import prettierPlugin from 'eslint-plugin-prettier';

export default [
  { ignores: ['node_modules/**', 'dist/**', '*.config.js', '*.config.mjs'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error', // Ошибки, если код не соответствует Prettier
      'no-console': 'off',          // Разрешаем console.log
      'func-names': 'off',          // Разрешаем анонимные функции
    },
  },
];