/* Regras de negócio
   As regras que decidem números publicados, num lugar só e com testes (testes/regras.test.mjs). Cada uma cita a parte
   do Anexo I da Nota Informativa à STI que a descreve. Nenhuma lê a página: recebem dados e devolvem valores. */

/* Nordeste e Semiárido, regra da data de referência (Anexo I, 4, "Regra da data de referência"; regra do portal
   "Entendendo o Mapa, a Tabela e o Gráfico"): cada reservatório entra com a medição de data mais próxima, até lim dias
   antes ou depois; no empate entre uma anterior e uma posterior, vale a anterior (Diego, 21/09/2026).
   serie: em ordem crescente de dia; dia(x): o dia do item (número); tem(x): se o item tem o valor pedido.
   Devolve o índice da medição usada, ou -1 quando não há medição na janela. Mesma regra de na_data (preparar_ne.py). */
function medicaoNaJanela(serie, alvo, lim, dia, tem = () => true) {
  let k0 = -1,
    dist = Infinity;
  for (let k = 0; k < serie.length; k++) {
    const d = dia(serie[k]) - alvo;
    if (d > lim) break; // a série é crescente: daqui em diante, tudo fora da janela
    if (d < -lim || !tem(serie[k])) continue;
    if (Math.abs(d) < dist) {
      // estrito: no empate fica a anterior, que vem primeiro
      dist = Math.abs(d);
      k0 = k;
    }
  }
  return k0;
}

// Nordeste e Semiárido, faixa de volume do reservatório (Anexo I, 4): restrição abaixo de 20%, atenção de 20% a menos de 50%,
// normal a partir de 50%; sem medição na janela, "sem"
const faixaPct = p => (p == null ? "sem" : p < 20 ? "restricao" : p < 50 ? "atencao" : "normal");

// Nordeste e Semiárido, volume acumulado (Anexo I, 4, "Volume acumulado"): soma dos volumes (hm³) dos reservatórios com
// medição na janela dividida pela soma das capacidades desses mesmos reservatórios; os sem informação ficam fora das duas
// agregado de uma lista de reservatórios já resolvidos na data
function agregar(L) {
  const com = L.filter(r => !r.sem_info);
  const cap = com.reduce((a, r) => a + (r.capacidade_hm3 || 0), 0);
  const vol = com.reduce((a, r) => a + (r.volume_hm3 || 0), 0);
  const faixas = { restricao: 0, atencao: 0, normal: 0 };
  com.forEach(r => {
    if (faixas[r.faixa] != null) faixas[r.faixa]++;
  });
  return {
    n: L.length,
    com_dado: com.length,
    sem_info: L.length - com.length,
    capacidade_hm3: L.reduce((a, r) => a + (r.capacidade_hm3 || 0), 0),
    capacidade_com_dado_hm3: cap,
    volume_hm3: vol,
    volume_pct: cap ? (vol / cap) * 100 : null,
    faixas
  };
}

// SIN, faixas de operação das resoluções da ANA (Anexo I, 3, "Faixas de operação"), lidas nos textos das resoluções em
// gov.br/ana (22/09/2026): limites em % do volume útil, artigo, ato e início da vigência de cada usina
// faixas de operação definidas por resolução da ANA, por usina (só referência na ficha; a faixa vigente é a do ato)
// Faixas e limites de operação em resolução da ANA, por usina (nome no SAR). Só referência na ficha: a faixa em vigor é a
// definida conforme o próprio ato. Textos em gov.br/ana/pt-br/legislacao/resolucoes/resolucoes-regulatorias, lidos em 22/09/2026.
const FAIXAS_ANA = (() => {
  const PAL = {
    n: ["#1B7F3B", "#CFE8D5"],
    at: ["#D4A800", "#FFF0A8"],
    al: ["#E07B00", "#FFC98A"],
    r: ["#C0392B", "#F2A09A"]
  };
  const fx = (rot, de, ate, c) => ({ de, ate, rot, cor: PAL[c][0], fundo: PAL[c][1] });
  const pct = (a, b) => (b >= 1e9 ? `${a}% ou mais` : a <= -1e9 ? `abaixo de ${b}%` : `${a}% a ${b}%`);
  const tres = (n, a, rr = "Operação de Restrição") => [
    fx(`Operação Normal (${pct(n, 1e9)})`, n, 1e9, "n"),
    fx(`Operação de Atenção (${pct(a, n)})`, a, n, "at"),
    fx(`${rr} (${pct(-1e9, a)})`, -1e9, a, "r")
  ];
  const quatro = (n, at, al) => [
    fx(`Operação Normal (${pct(n, 1e9)})`, n, 1e9, "n"),
    fx(`Operação de Atenção (${pct(at, n)})`, at, n, "at"),
    fx(`Operação de Alerta (${pct(al, at)})`, al, at, "al"),
    fx(`Operação de Restrição (${pct(-1e9, al)})`, -1e9, al, "r")
  ];
  const mensal1 =
    "A faixa em vigor é definida mensalmente, a partir da situação do reservatório observada no primeiro dia do mês (art. 10); por isso, pode diferir da indicada pelo volume do dia.";
  const R193 = {
    ato: "Resolução ANA nº 193, de 10 de maio de 2024",
    desde: "2024-12-02",
    artVig: "art. 22",
    vig: mensal1
  };
  const R194 = {
    ato: "Resolução ANA nº 194, de 10 de maio de 2024",
    desde: "2024-12-02",
    artVig: "art. 22",
    vig: mensal1
  };
  const R132 = {
    ato: "Resolução ANA nº 132, de 10 de outubro de 2022",
    desde: "2023-01-01",
    artVig: "art. 20",
    vig: "A faixa em vigor é definida semanalmente, a partir da situação do reservatório observada na sexta-feira anterior à semana operativa, de sábado a sexta-feira (art. 8º); por isso, pode diferir da indicada pelo volume do dia."
  };
  const R2081 = {
    ato: "Resolução ANA nº 2.081, de 4 de dezembro de 2017",
    desde: "2019-05-01",
    // art. 22: vigência a partir de comunicado da ANA; Ofício Circular nº 1/2019/AA-CD-ANA (Documento nº
    // 02500.026496/2019-54), de 30/04/2019: o sistema passa a ser operado pela resolução a partir de 1º/05/2019
    artVig: "art. 22; comunicado pelo Ofício Circular nº 1/2019/AA-CD-ANA, de 30 de abril de 2019",
    vig: "As faixas são verificadas no início de cada mês; por isso, a faixa em vigor pode diferir da indicada pelo volume do dia."
  };
  const R70 = {
    ato: "Resolução ANA nº 70, de 19 de abril de 2021",
    desde: "2021-12-01",
    artVig: "art. 18",
    vig: "As faixas dependem do período: úmido, de dezembro a maio, e seco, de junho a novembro (art. 2º); a régua usa as do período da data."
  };
  return {
    FURNAS: { ...R193, art: "art. 3º", faixas: tres(50, 20) },
    "M. MORAES": { ...R193, art: "art. 6º", faixas: tres(70, 30) },
    "EMBORCAÇÃO": { ...R194, art: "art. 3º", faixas: tres(50, 20) },
    ITUMBIARA: { ...R194, art: "art. 6º", faixas: tres(40, 20) },
    JURUMIRIM: {
      ...R132,
      art: "art. 2º",
      faixas: quatro(40, 30, 25),
      obs: "No inciso III, a resolução traz “25% (vinte por cento)”; adotado 25%, valor repetido no inciso IV."
    },
    CHAVANTES: { ...R132, art: "art. 4º", faixas: quatro(40, 30, 20) },
    CAPIVARA: { ...R132, art: "art. 6º", faixas: quatro(40, 20, 15) },
    "TRÊS MARIAS": { ...R2081, art: "art. 5º", faixas: tres(60, 30) },
    SOBRADINHO: { ...R2081, art: "art. 9º", faixas: tres(60, 20, "Operação com Restrição") },
    "SERRA DA MESA": {
      ...R70,
      art: "arts. 4º e 5º",
      periodos: [
        {
          meses: [12, 1, 2, 3, 4, 5],
          rot: "período úmido, de dezembro a maio",
          faixas: [
            fx("Operação Normal (20% ou mais)", 20, 1e9, "n"),
            fx("Operação de Atenção (abaixo de 20%, período úmido)", -1e9, 20, "at")
          ]
        },
        {
          meses: [6, 7, 8, 9, 10, 11],
          rot: "período seco, de junho a novembro",
          faixas: [
            fx("Operação Normal (20% ou mais)", 20, 1e9, "n"),
            fx("Operação de Atenção (10% a 20%, período seco)", 10, 20, "at"),
            fx("Operação de Alerta (abaixo de 10%, período seco)", -1e9, 10, "al")
          ]
        }
      ]
    }
  };
})();

const faixasNaData = (RA, iso) =>
  RA.periodos ? RA.periodos.find(p => p.meses.includes(+iso.slice(5, 7))).faixas : RA.faixas || [];

// Sistema Cantareira, faixas de operação (Resolução Conjunta ANA/DAEE nº 925/2017, art. 4º; Anexo I, 5)
const VIG_CAN = "2017-05-30"; // Res. Conjunta ANA/DAEE nº 925/2017, art. 9º: vigência na publicação (DOU de 30/05/2017)
// faixas de operação pelo volume útil acumulado (Resolução Conjunta ANA/DAEE nº 925/2017, art. 4º): só referência no gráfico;
// a faixa vigente é a fixada mensalmente pela ANA e pelo DAEE (art. 6º) e não é calculada pela página
const FAIXAS_OPERACAO_CAN = [
  { de: 60, ate: 1e9, rot: "Faixa 1 · Normal (60% ou mais)", cor: "#1B7F3B", fundo: "#CFE8D5" },
  { de: 40, ate: 60, rot: "Faixa 2 · Atenção (40% a 60%)", cor: "#D4A800", fundo: "#FFF0A8" },
  { de: 30, ate: 40, rot: "Faixa 3 · Alerta (30% a 40%)", cor: "#E07B00", fundo: "#FFC98A" },
  { de: 20, ate: 30, rot: "Faixa 4 · Restrição (20% a 30%)", cor: "#C0392B", fundo: "#F2A09A" },
  { de: -1e9, ate: 20, rot: "Faixa 5 · Especial (abaixo de 20%)", cor: "#7A1F1F", fundo: "#C98585" }
];

/* Nordeste e Semiárido, série do volume acumulado (Anexo I, 4, "Série do volume acumulado"; Diego, 23/09/2026): o gráfico
   ao longo do ano tem um ponto por mês, contado para trás a partir da data de referência. mesAnterior(iso): o mesmo dia
   do mês anterior; se o mês anterior não tem esse dia, o último dia dele (igual a mes_anterior, preparar_serie_ne.py). */
function mesAnterior(iso) {
  let a = +iso.slice(0, 4),
    m = +iso.slice(5, 7) - 1;
  if (!m) {
    a--;
    m = 12;
  }
  const ult = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(Math.min(+iso.slice(8, 10), ult)).padStart(2, "0")}`;
}
// dois pontos mensais seguidos são ligados, salvo quando os reservatórios que entraram ou saíram da medição entre eles
// somam mais que o limiar (em % da média das duas capacidades equivalentes; parâmetro da área administrativa). troca
// nula (falta um dos dois conjuntos) não interrompe: o vão entre os pontos já separa a linha
const pontoLigado = (troca, limiar) => troca == null || troca <= limiar;

/* SIN, conferência da base diária (Anexo I, item 22 d; Diego, 24/09/2026: "Erro evidente deveria ser marcado para
   revisão"): a vazão afluente diária negativa é erro evidente. Sai da publicação (páginas, área de dados e API) e vai
   para a fila de revisão da CORSH, que confirma a retirada ou devolve o valor à série; o valor recebido fica guardado.
   Na base horária, os negativos do balanço hídrico continuam publicados, com o aviso fixo (item 22 c).
   Altera d no lugar (último dia de cada usina, série diária da ficha e séries da bacia) e devolve os valores retirados,
   sem repetição: [{ codigo, data, v }]. */
function retiraAfluenteNegativa(d) {
  const R = [],
    visto = new Set(),
    neg = v => v != null && v < 0,
    anota = (codigo, data, v) => {
      const k = codigo + "|" + data;
      if (!visto.has(k)) R.push({ codigo, data, v });
      visto.add(k);
    };
  (d.reservatorios || []).forEach(r => {
    if (!neg(r.afl)) return;
    anota(r.codigo, d.data, r.afl);
    r.afl = null;
  });
  if (d.ficha && d.ficha.diario) {
    const ia = d.ficha.diario_colunas.indexOf("afl");
    d.ficha.diario.forEach(l => {
      if (!neg(l[ia])) return;
      anota(d.ficha.codigo, l[0], l[ia]);
      l[ia] = null;
    });
  }
  ((d.grande && d.grande.res) || []).forEach(r => {
    if (neg(r.afl)) {
      anota(r.codigo, d.data, r.afl);
      r.afl = null;
    }
    (r.serie || []).forEach(o => {
      if (!neg(o.afl)) return;
      anota(r.codigo, o.data, o.afl);
      o.afl = null;
    });
  });
  return R;
}

/* Nordeste e Semiárido, variação em 30 dias (Anexo I, 4.1; Diego, 21/09/2026): igual no volume e no nível, contra a
   leitura mais próxima do dia 30 dias antes da leitura usada, até FOLGA30 dias antes ou depois dele. */
const FOLGA30 = 7;

export {
  agregar,
  faixaPct,
  FAIXAS_ANA,
  FAIXAS_OPERACAO_CAN,
  faixasNaData,
  FOLGA30,
  medicaoNaJanela,
  mesAnterior,
  pontoLigado,
  retiraAfluenteNegativa,
  VIG_CAN
};
