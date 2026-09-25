// ESLint do protótipo: cada arquivo de js/ é um módulo ES e é conferido sozinho; nome usado sem import é erro
// (no-undef). Rodar com `npm run lint`.
// Avisos esperados: max-lines-per-function e complexity nas funções que montam cada página (uma função por página,
// longa por estrutura); os demais avisos devem ficar em zero.
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        L: "readonly", // Leaflet (CDN, em pagina.html)
        JSZip: "readonly", // JSZip (CDN, em pagina.html): KMZ e XLSX
        XLSX: "readonly",
        jspdf: "readonly" // jsPDF, carregado sob demanda por exportacao.js
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-shadow": "warn",
      "no-redeclare": "error",
      complexity: ["warn", 25],
      "max-lines-per-function": ["warn", { max: 120 }],
      "max-depth": ["warn", 5],
      "no-empty": "warn"
    }
  },
  {
    files: ["testes/**/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } }
  }
];
