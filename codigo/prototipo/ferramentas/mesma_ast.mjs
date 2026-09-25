// Confere que dois arquivos JavaScript têm a mesma árvore sintática (AST): mudou só a forma (espaços, quebras de
// linha, parênteses redundantes, aspas), não o comportamento. Usado depois de formatar o código com o Prettier.
// Uso: node mesma_ast.mjs <pasta_antes> <pasta_depois>   (compara os .js de mesmo nome, inclusive em subpastas)
// Precisa do espree (o analisador do ESLint) instalado onde o node o encontre.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as espree from "espree";

const IGNORA = new Set(["start", "end", "loc", "range", "raw"]);
const limpa = n => {
  if (Array.isArray(n)) return n.map(limpa);
  if (!n || typeof n !== "object") return n;
  const o = {};
  for (const [k, v] of Object.entries(n)) {
    if (IGNORA.has(k) && !(n.type === "TemplateElement" && k === "value")) continue;
    o[k] = limpa(v);
  }
  return o;
};
const ast = f => JSON.stringify(limpa(espree.parse(readFileSync(f, "utf8"), { ecmaVersion: "latest", sourceType: "script" })));
const lista = d => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? lista(join(d, n)) : n.endsWith(".js") ? [join(d, n)] : []);

const [a, b] = process.argv.slice(2);
let dif = 0;
for (const f of lista(a)) {
  const r = relative(a, f), igual = ast(f) === ast(join(b, r));
  if (!igual) dif++;
  console.log((igual ? "igual     " : "DIFERENTE ") + r);
}
process.exitCode = dif ? 1 : 0;
