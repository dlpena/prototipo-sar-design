/* Contexto compartilhado entre as páginas: o que mais de um módulo lê e altera. Um módulo ES não pode reatribuir a
   variável que importou de outro; por isso esses valores ficam num objeto só, e cada página muda a propriedade.
   Os valores que dependem dos dados são postos ao carregar pelo módulo dono (ne.js, dataRef; outros.js, refOS). */
const contexto = {
  dataRef: null, // data de referência do Nordeste e Semiárido (páginas do módulo, dos estados e das fichas)
  refSIN: null, // data de referência do SIN (página do módulo, da bacia e fichas das usinas)
  refOS: null, // data de referência de Outros Sistemas Hídricos, dentro do sistema aberto
  sisOS: null, // sistema aberto em Outros Sistemas Hídricos (cantareira, df ou rmbh)
  redesenharSIN: null, // função que refaz os gráficos da página do SIN quando a largura muda
  redesenharOS: null, // idem, na página aberta de Outros Sistemas Hídricos
  buscaDados: "" // busca vinda da página inicial ("ver todos na área de dados")
};

export { contexto };
