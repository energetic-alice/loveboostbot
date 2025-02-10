import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.js'],
    ignores: ['node_modules', 'dist'],
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