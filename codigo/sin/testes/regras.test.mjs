// Testes das regras de negócio do protótipo (js/regras.js). Rodar em mockups/sin: node --test testes/
// Importam o próprio módulo js/regras.js (o mesmo código da página) e leem os dados embutidos (dados_sin.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as R from "../js/regras.js";

const D = JSON.parse(readFileSync(new URL("../dados_sin.json", import.meta.url), "utf8"));
const NE = D.ne;
const dia = iso => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(NE.serie_de + "T00:00:00Z")) / 864e5);

// ------------------------------------------------------------------------------ janela do Nordeste
test("janela: escolhe a medição mais próxima, até o limite, e no empate a anterior", () => {
  const s = [
      [10, 1],
      [20, 2],
      [30, 3]
    ],
    j = (alvo, lim = 5) => R.medicaoNaJanela(s, alvo, lim, x => x[0]);
  assert.equal(j(19), 1); // 20 está a 1 dia
  assert.equal(j(25), 1); // 20 e 30 a 5 dias: vale a anterior
  assert.equal(j(26), 2); // 30 mais perto
  assert.equal(j(35), 2); // 30 a 5 dias: no limite, entra
  assert.equal(j(36), -1); // 30 a 6 dias: fora da janela de 5
});
test("janela: fora do limite, nenhuma medição (-1)", () => {
  const s = [[10], [20]];
  assert.equal(
    R.medicaoNaJanela(s, 40, 5, x => x[0]),
    -1
  );
  assert.equal(
    R.medicaoNaJanela([], 10, 30, x => x[0]),
    -1
  );
});
test("janela: pula as medições sem o valor pedido", () => {
  const s = [
    [10, null],
    [14, 5]
  ];
  assert.equal(
    R.medicaoNaJanela(
      s,
      10,
      30,
      x => x[0],
      x => x[1] != null
    ),
    1
  );
});
test("janela: mesma medição que a função Python original (na_data), em todos os reservatórios e datas", () => {
  const F = JSON.parse(readFileSync(new URL("./fixture_janela.json", import.meta.url), "utf8"));
  assert.equal(F.serie_de, NE.serie_de, "fixture de outros dados: rodar testes/gera_fixture_janela.py");
  const dif = [];
  for (const [i, alvo, esperado] of F.casos) {
    const s = NE.reservatorios[i].s,
      k = R.medicaoNaJanela(
        s,
        alvo,
        F.limiar,
        x => x[0],
        x => x[2] != null
      ),
      obtido = k < 0 ? null : s[k][0];
    if (obtido !== esperado) dif.push({ i, alvo, esperado, obtido });
  }
  assert.equal(
    dif.length,
    0,
    `${dif.length} de ${F.casos.length} casos diferentes: ${JSON.stringify(dif.slice(0, 5))}`
  );
});

// ------------------------------------------------------------------------------ faixa de volume e volume acumulado
test("faixa de volume: restrição abaixo de 20%, atenção de 20% a 50%, normal a partir de 50%", () => {
  const casos = {
    "-3": "restricao",
    0: "restricao",
    19.99: "restricao",
    20: "atencao",
    49.99: "atencao",
    50: "normal",
    112: "normal"
  };
  for (const [p, f] of Object.entries(casos)) assert.equal(R.faixaPct(+p), f, `${p}%`);
  assert.equal(R.faixaPct(null), "sem");
});
test("volume acumulado: soma dos volumes ÷ soma das capacidades de quem tem medição", () => {
  const A = R.agregar([
    { capacidade_hm3: 100, volume_hm3: 50, faixa: "normal" },
    { capacidade_hm3: 300, volume_hm3: 30, faixa: "restricao" },
    { capacidade_hm3: 1000, sem_info: true, faixa: "sem" }
  ]);
  assert.equal(A.volume_pct, 20); // 80 / 400, sem o reservatório sem informação
  assert.equal(A.capacidade_hm3, 1400);
  assert.equal(A.sem_info, 1);
  assert.deepEqual({ ...A.faixas }, { restricao: 1, atencao: 0, normal: 1 });
});
test("volume acumulado do Piauí: a saída de Jenipapo da janela (67,8% em 28/05/2026; 39,4% em 12/06/2026) interrompe a linha mensal", () => {
  const NV = (NE.nivel && NE.nivel.estados) || {},
    fora = new Set(
      Object.values(NV).flatMap(e => [...((e.ocultos && e.ocultos.indices) || []), ...(e.fora_do_volume || [])])
    );
  const noEstado = (uf, iso) =>
    NE.reservatorios
      .filter(r => r.uf === uf && !fora.has(r.i))
      .map(r => {
        const k = R.medicaoNaJanela(
          r.s,
          dia(iso),
          NE.limiar_dias,
          x => x[0],
          x => x[2] != null
        );
        return k < 0
          ? { ...r, sem_info: true }
          : { ...r, sem_info: false, volume_hm3: r.s[k][2], faixa: R.faixaPct(r.s[k][1]) };
      });
  // caso que motivou a regra de interrupção da linha (numeros.py: Jenipapo de 29/04, Bocaina e Petrônio Portela do
  // dia; em 12/06 o Jenipapo sai da janela). Os dados embutidos guardam o volume com uma casa decimal em hm³ (Bocaina
  // 66,0 em vez de 66,05), o que dá 67,74% contra 67,76% da série completa: a tolerância é de 0,1 ponto percentual.
  const pct = iso => R.agregar(noEstado("PI", iso)).volume_pct,
    quem = iso =>
      noEstado("PI", iso)
        .filter(r => !r.sem_info)
        .map(r => r.nome)
        .sort();
  assert.deepEqual(quem("2026-05-28"), ["BOCAINA", "JENIPAPO", "PETRÔNIO PORTELA"]);
  assert.deepEqual(quem("2026-06-12"), ["BOCAINA", "PETRÔNIO PORTELA"]);
  assert.ok(Math.abs(pct("2026-05-28") - 67.8) <= 0.1, `28/05/2026: ${pct("2026-05-28")}`);
  assert.ok(Math.abs(pct("2026-06-12") - 39.4) <= 0.1, `12/06/2026: ${pct("2026-06-12")}`);
  // na série mensal, o ponto de 12/06 não se liga ao de 12/05: Jenipapo (248 hm³) saiu da medição
  const SD = NE.serie_direta,
    k = (Date.parse("2026-06-12T00:00:00Z") - Date.parse(SD.inicio + "T00:00:00Z")) / 864e5;
  assert.equal(R.pontoLigado(SD.series.PI.troca[k], SD.limiar_troca_pct), false, `troca ${SD.series.PI.troca[k]}%`);
});

// ------------------------------------------------------------------------------ faixas de operação
const contiguas = (F, nome) => {
  const f = [...F].sort((a, b) => a.de - b.de);
  assert.ok(f[0].de <= -1e9 && f[f.length - 1].ate >= 1e9, `${nome}: as faixas cobrem de -∞ a +∞`);
  for (let k = 1; k < f.length; k++)
    assert.equal(f[k].de, f[k - 1].ate, `${nome}: sem buraco nem sobreposição em ${f[k].de}%`);
};
test("faixas das resoluções da ANA: cobrem todo o volume útil, sem buraco, e têm vigência", () => {
  for (const [usina, RA] of Object.entries(R.FAIXAS_ANA)) {
    assert.ok(RA.ato && (RA.desde || RA.desdeTxt), `${usina}: ato e vigência`);
    if (RA.periodos) RA.periodos.forEach(p => contiguas(p.faixas, `${usina} (${p.rot})`));
    else contiguas(RA.faixas, usina);
  }
});
test("faixas de Serra da Mesa mudam com o período: úmido de dezembro a maio, seco de junho a novembro", () => {
  const RA = R.FAIXAS_ANA["SERRA DA MESA"],
    umido = RA.periodos.find(p => p.meses.includes(12)),
    seco = RA.periodos.find(p => p.meses.includes(6));
  assert.deepEqual(
    [...umido.meses].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 12]
  );
  assert.deepEqual(
    [...seco.meses].sort((a, b) => a - b),
    [6, 7, 8, 9, 10, 11]
  );
  assert.equal(R.faixasNaData(RA, "2026-01-15"), umido.faixas);
  assert.equal(R.faixasNaData(RA, "2026-07-15"), seco.faixas);
});
test("faixas do Cantareira (Res. Conjunta ANA/DAEE nº 925/2017, art. 4º): 60, 40, 30 e 20%, vigência em 30/05/2017", () => {
  contiguas(R.FAIXAS_OPERACAO_CAN, "Cantareira");
  assert.deepEqual(
    [...R.FAIXAS_OPERACAO_CAN.map(f => f.de)].filter(v => v > -1e9).sort((a, b) => b - a),
    [60, 40, 30, 20]
  );
  assert.equal(R.VIG_CAN, "2017-05-30");
});

// ------------------------------------------------------------------------------ série do volume acumulado do Nordeste
test("série mensal: o ponto anterior é o mesmo dia do mês anterior, ou o último dia do mês quando ele não tem esse dia", () => {
  assert.equal(R.mesAnterior("2026-09-15"), "2026-08-15");
  assert.equal(R.mesAnterior("2026-01-15"), "2025-12-15"); // virada do ano
  assert.equal(R.mesAnterior("2026-03-31"), "2026-02-28");
  assert.equal(R.mesAnterior("2024-03-31"), "2024-02-29"); // ano bissexto
  assert.equal(R.mesAnterior("2026-05-31"), "2026-04-30");
  // contado para trás a partir de um dia 31, o dia cai no primeiro mês curto e fica nele (como em preparar_serie_ne.py)
  assert.equal(R.mesAnterior(R.mesAnterior("2026-03-31")), "2026-01-28");
});
test("série mensal: a linha só se interrompe quando a troca de reservatórios passa do limiar", () => {
  assert.equal(R.pontoLigado(15, 15), true); // no limiar, ligado
  assert.equal(R.pontoLigado(16, 15), false);
  assert.equal(R.pontoLigado(0, 15), true);
  assert.equal(R.pontoLigado(null, 15), true); // sem um dos conjuntos: o vão entre os pontos já separa a linha
});
test("série do volume acumulado embutida: começa no ano inicial, primeiro ano com a capacidade medida no mínimo", () => {
  const SD = NE.serie_direta,
    a0 = SD.ano_inicial,
    cob = SD.cobertura_ano;
  assert.equal(SD.inicio, `${a0}-01-01`);
  assert.ok(cob[a0] >= SD.cobertura_min_pct, `${a0}: ${cob[a0]}%`);
  Object.keys(cob)
    .map(Number)
    .filter(a => a < a0)
    .forEach(a => assert.ok(cob[a] < SD.cobertura_min_pct, `${a} já teria a cobertura mínima: ${cob[a]}%`));
  const dias = (Date.parse(SD.fim + "T00:00:00Z") - Date.parse(SD.inicio + "T00:00:00Z")) / 864e5 + 1;
  Object.entries(SD.series).forEach(([g, S]) =>
    ["pct", "n", "cap", "troca"].forEach(k => assert.equal(S[k].length, dias, `${g}.${k}`))
  );
});

// ------------------------------------------------------------------------------ conferência do SIN
test("SIN: vazão afluente diária negativa sai da publicação e fica registrada para a revisão, sem repetição", () => {
  const d = {
    data: "2026-09-15",
    reservatorios: [
      { codigo: 1, afl: -4.4 },
      { codigo: 2, afl: 0 },
      { codigo: 3, afl: null }
    ],
    ficha: {
      codigo: 1,
      diario_colunas: ["data", "cota", "afl"],
      diario: [
        ["2026-09-14", 764.1, 10],
        ["2026-09-15", 764.2, -4.4]
      ]
    },
    grande: { res: [{ codigo: 2, afl: 0, serie: [{ data: "2026-09-01", afl: -1 }] }] }
  };
  assert.deepEqual(R.retiraAfluenteNegativa(d), [
    { codigo: 1, data: "2026-09-15", v: -4.4 },
    { codigo: 2, data: "2026-09-01", v: -1 }
  ]);
  assert.equal(d.reservatorios[0].afl, null);
  assert.equal(d.reservatorios[1].afl, 0); // zero não é erro
  assert.equal(d.ficha.diario[1][2], null);
  assert.equal(d.ficha.diario[0][2], 10);
  assert.equal(d.grande.res[0].serie[0].afl, null);
});
