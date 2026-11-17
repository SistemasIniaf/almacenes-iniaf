import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      // Fijo a esta carpeta: si no, typescript-eslint la adivina y falla cuando el
      // editor ve otra copia del frontend (p. ej. un worktree en .claude/worktrees).
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Componentes generados por shadcn: exportan sus variantes (buttonVariants,
    // useSidebar…) junto al componente. Solo afecta al hot-reload de desarrollo.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
