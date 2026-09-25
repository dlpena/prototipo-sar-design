/* Ponto de entrada do protótipo. Carrega os módulos na ordem abaixo e dá a partida (rotas.js, iniciar).

   A mesma lista serve às duas formas de rodar:
   - dev.html carrega este arquivo como módulo ES, direto do código-fonte (py -m http.server na pasta mockups/sin);
   - montar.py lê a lista, junta os arquivos nessa ordem sem os import e export e gera o arquivo único publicado
     (prototipo-sin.html). Por isso a ordem segue a das dependências: quem é usado ao carregar vem antes. */
import "./contexto.js"; // contexto compartilhado entre as páginas (datas de referência, sistema aberto)
import "./regras.js"; // regras de negócio que decidem números publicados, com testes em testes/
import "./dados_embutidos.js"; // dados do protótipo (dados_sin.json)
import "./base.js"; // utilitários da página: seletores, formatos, cores, barra de data, índice
import "./exportacao.js"; // CSV, PDF, PNG e KMZ
import "./graficos.js"; // componentes de gráfico (linhas, calendário, barras por ano, mensal) e textos "Como ler"
import "./sin.js"; // página do módulo SIN
import "./topologia.js"; // diagrama da cascata a partir da ligação entre usinas
import "./bacia.js"; // página da bacia
import "./ficha_sin.js"; // ficha da usina
import "./inicio.js"; // página inicial e busca
import "./ne.js"; // módulo Nordeste e Semiárido
import "./ne_estados.js"; // páginas dos estados e açudes só com nível
import "./ficha_ne.js"; // ficha do açude
import "./outros.js"; // módulo Outros Sistemas Hídricos
import "./cantareira.js"; // página do Sistema Cantareira
import "./outros_sistemas.js"; // páginas do Distrito Federal e do Paraopeba
import "./ficha_outros.js"; // ficha do reservatório de Outros Sistemas Hídricos
import "./dados.js"; // área de dados
import "./api.js"; // documentação da API pública
import "./admin/admin_nucleo.js"; // área administrativa: núcleo, perfis, cadastro, série, aprovações
import "./admin/admin_telas.js"; // área administrativa: cobertura, valores suspeitos, inclusão, códigos, agrupamentos, textos
import "./titulo_grafico_celular.js"; // título de gráfico quebrado em linhas no celular
import { iniciar } from "./rotas.js"; // rotas por hash e barra lateral

iniciar();
