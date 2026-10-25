// =============================================================================
// Lógica Computacional e Renderização do Dashboard de Retornos Externos
// =============================================================================

(function () {
  "use strict";

  // Estado da Aplicação
  const state = {
    dados: null,
    usar_f7: false,
    aba_ativa: "grupo", // "grupo" | "pais" | "estoques"
    agrupar_por: "periodo", // "periodo" | "grupo"
    modo_tempo_pais: "anual", // "anual" | "periodo"
    preset: "script",
    metodo: "script", // "script" | "pooled" | "mediana"
    grupos_ativos: [],
    grupos_paises: {}, // { "USA": ["USA"], "AEs": [...], ... }
    paises_selecionados: ["BRA"],
    periodos_texto: "",
    periodos_parsed: [],

    // Controles da Aba Estoques e IIP
    visao_grafico_estoque: "grupo", // "grupo" | "pais"
    grupos_grafico_estoque: ["USA", "AEs (G7 ex-USA)", "AEs Centrais", "Emerging Markets"],
    paises_grafico_estoque: ["USA", "BRA", "DEU"],
    metrica_grafico_estoque: "iip", // "iip" | "a_p" | "l_p" | "res"
    unidade_estoque: "usd", // "usd" | "pib"
    diferencial_estoque: "tr_dif", // "tr_dif" | "yield_dif" | "kg_dif"
    chartInstance: null,
    chartDiferenciaisInstance: null,

    // Controles da Aba Liquidez Internacional
    modo_tabela_liquidez: "ciclos", // "ciclos" | "periodos"
    chartLiquidezInstances: {},

    // Controles da Aba Classificação
    busca_classificacao: ""
  };

  const VARS = ["yield_A", "yield_L", "yield_dif", "kg_A", "kg_L", "kg_dif", "TR_A", "TR_L", "TR_dif"];

  const CORES_PALETA = {
    "USA": "#1d4ed8",
    "AEs (G7 ex-USA)": "#0284c7",
    "AEs Centrais": "#0ea5e9",
    "Periferia Europeia": "#0d9488",
    "Centros Financeiros": "#8b5cf6",
    "Emerging Markets": "#059669",
    "Frontier Markets": "#d97706",
    "Other Developing": "#b45309",
    "Outros": "#6b7280"
  };

  const CORES_PAISES = [
    "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
    "#0891b2", "#ca8a04", "#4f46e5", "#059669", "#be123c"
  ];

  const PRESETS = {
    script: ["2000-2004", "2005-2009", "2010-2014", "2015-2019", "2020-2025"],
    proposta: ["2000-2005", "2006-2009", "2010-2014", "2015-2019", "2020-2025"],
    ciclos: [
      "2000-2002: Crises",
      "2003-2007: Superciclo",
      "2008-2009: Crise Subprime",
      "2010-2013: Quebra Estrutural",
      "2014-2019: Fim do boom e dólar forte",
      "2020-2025: Pandemia e aperto do Fed"
    ],
    trienios: [
      "2000-2002", "2003-2005", "2006-2008", "2009-2011", "2012-2014",
      "2015-2017", "2018-2020", "2021-2023", "2024-2025"
    ],
    bienios: [
      "2000-2001", "2002-2003", "2004-2005", "2006-2007", "2008-2009",
      "2010-2011", "2012-2013", "2014-2015", "2016-2017", "2018-2019",
      "2020-2021", "2022-2023", "2024-2025"
    ],
    anual: Array.from({ length: 25 }, (_, i) => String(2001 + i))
  };

  // Inicialização
  async function init() {
    try {
      const resp = await fetch("data/dados.json?t=" + Date.now());
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      state.dados = await resp.json();
    } catch (e) {
      console.warn("Fetch de dados.json falhou, usando fallback offline DADOS_APP:", e);
      if (window.DADOS_APP) {
        state.dados = window.DADOS_APP;
      } else {
        document.getElementById("tabela-container").innerHTML =
          '<div class="state-message">Erro ao carregar os dados. Verifique a conexão ou os arquivos locais.</div>';
        return;
      }
    }

    // Configura estado inicial dos grupos
    state.grupos_ativos = [...state.dados.grupos_ordem];
    state.grupos_paises = JSON.parse(JSON.stringify(state.dados.grupos_paises));
    state.periodos_texto = PRESETS[state.preset].join("\n");
    parsePeriodos();

    // Constrói controles da UI
    montarControlesUI();
    vincularEventos();

    // Primeira renderização
    renderizar();
  }

  // Parser de períodos (compatível com regex do script R)
  function parsePeriodos() {
    const linhas = state.periodos_texto.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = [];
    const rx = /^(\d{4})(?:\s*[-\u2013\u2014]\s*(\d{4}))?(?:\s*:\s*(.*))?$/;

    for (let i = 0; i < linhas.length; i++) {
      const m = linhas[i].match(rx);
      if (!m) continue;
      const ini = parseInt(m[1], 10);
      const fim = m[2] ? parseInt(m[2], 10) : ini;
      const rot = m[3] ? m[3].trim() : "";
      if (ini > fim) continue;

      const baseRot = ini === fim ? String(ini) : `${ini} - ${fim}`;
      const rotulo = rot ? `${baseRot}: ${rot}` : baseRot;

      const anos = [];
      for (let a = ini; a <= fim; a++) anos.push(a);

      parsed.push({
        ordem: i,
        rotulo: rotulo,
        ini: ini,
        fim: fim,
        anos: anos
      });
    }

    state.periodos_parsed = parsed;
    const msgEl = document.getElementById("msg-periodos");
    if (msgEl) {
      msgEl.innerText = `${parsed.length} período(s) definidos.`;
    }
  }

  // Funções Estatísticas
  function calcMedia(arr) {
    if (!arr || !arr.length) return null;
    const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (!valid.length) return null;
    const soma = valid.reduce((acc, v) => acc + v, 0);
    return soma / valid.length;
  }

  function calcMediana(arr) {
    if (!arr || !arr.length) return null;
    const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (!valid.length) return null;
    const sorted = [...valid].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Extração das métricas país-ano respeitando o toggle F7
  function extrairMetricas(obs, comF7) {
    const kg_A = comF7 ? obs.kg_a_com : obs.kg_a_sem;
    const kg_L = comF7 ? obs.kg_l_com : obs.kg_l_sem;
    const TR_A = comF7 ? obs.tr_a_com : obs.tr_a_sem;
    const TR_L = comF7 ? obs.tr_l_com : obs.tr_l_sem;
    const yield_A = obs.y_a;
    const yield_L = obs.y_l;

    return {
      yield_A: yield_A,
      yield_L: yield_L,
      yield_dif: yield_A - yield_L,
      kg_A: kg_A,
      kg_L: kg_L,
      kg_dif: kg_A - kg_L,
      TR_A: TR_A,
      TR_L: TR_L,
      TR_dif: TR_A - TR_L,
      tr_dif: TR_A - TR_L
    };
  }

  // Formatações Numéricas
  function fmtPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    const num = (val * 100).toFixed(2).replace(".", ",");
    return `${num}%`;
  }

  function fmtBi(val) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function fmtPctBr(val) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return val.toFixed(2).replace(".", ",") + "%";
  }

  // =============================================================================
  // Agregação dos Dados para Aba "Por Grupo"
  // =============================================================================
  function calcularTabelaGrupo() {
    const comF7 = state.usar_f7;
    const metodo = state.metodo;
    const periodos = state.periodos_parsed;
    const grupos = state.grupos_ativos;
    const obsTotal = state.dados.obs;

    const paisGruposMap = {};
    for (const g of grupos) {
      let listaPaises = state.grupos_paises[g] || [];
      if (typeof listaPaises === "string") listaPaises = [listaPaises];
      for (const iso of listaPaises) {
        if (!paisGruposMap[iso]) paisGruposMap[iso] = [];
        paisGruposMap[iso].push(g);
      }
    }
    // Adiciona o tipo nativo da observação como garantia absoluta
    for (const o of obsTotal) {
      if (o.tipo && (!paisGruposMap[o.iso] || !paisGruposMap[o.iso].includes(o.tipo))) {
        if (!paisGruposMap[o.iso]) paisGruposMap[o.iso] = [];
        paisGruposMap[o.iso].push(o.tipo);
      }
    }

    const resultados = [];

    for (const per of periodos) {
      const obsPeriodo = obsTotal.filter(o => per.anos.includes(o.ano));

      for (const g of grupos) {
        const obsGrupo = obsPeriodo.filter(o => {
          const grps = paisGruposMap[o.iso];
          return grps && grps.includes(g);
        });

        if (!obsGrupo.length) continue;

        let resMetricas = {};

        if (metodo === "script") {
          const mediasPorAno = [];
          for (const ano of per.anos) {
            const obsAno = obsGrupo.filter(o => o.ano === ano);
            if (!obsAno.length) continue;

            const mAno = {};
            for (const v of VARS) {
              const vals = obsAno.map(o => extrairMetricas(o, comF7)[v]);
              mAno[v] = calcMedia(vals);
            }
            mediasPorAno.push(mAno);
          }

          if (!mediasPorAno.length) continue;

          for (const v of VARS) {
            resMetricas[v] = calcMedia(mediasPorAno.map(m => m[v]));
          }
        } else if (metodo === "pooled") {
          for (const v of VARS) {
            const vals = obsGrupo.map(o => extrairMetricas(o, comF7)[v]);
            resMetricas[v] = calcMedia(vals);
          }
        } else if (metodo === "mediana") {
          const medianasPorAno = [];
          for (const ano of per.anos) {
            const obsAno = obsGrupo.filter(o => o.ano === ano);
            if (!obsAno.length) continue;

            const mAno = {};
            for (const v of VARS) {
              const vals = obsAno.map(o => extrairMetricas(o, comF7)[v]);
              mAno[v] = calcMediana(vals);
            }
            medianasPorAno.push(mAno);
          }
          if (!medianasPorAno.length) continue;
          for (const v of VARS) {
            resMetricas[v] = calcMediana(medianasPorAno.map(m => m[v]));
          }
        }

        resultados.push({
          periodo: per.rotulo,
          ordemPeriodo: per.ordem,
          grupo: g,
          ordemGrupo: state.dados.grupos_ordem.indexOf(g),
          ...resMetricas
        });
      }
    }

    return resultados;
  }

  // =============================================================================
  // Agregação dos Dados para Aba "Por País"
  // =============================================================================
  function calcularTabelaPais() {
    const comF7 = state.usar_f7;
    const paisesIso = state.paises_selecionados;
    const obsTotal = state.dados.obs.filter(o => paisesIso.includes(o.iso));

    if (!obsTotal.length) return [];

    if (state.modo_tempo_pais === "anual") {
      const ordenado = [...obsTotal].sort((a, b) => {
        if (a.pais !== b.pais) return a.pais.localeCompare(b.pais);
        return a.ano - b.ano;
      });

      return ordenado.map(o => ({
        pais: o.pais,
        iso: o.iso,
        ano: String(o.ano),
        ...extrairMetricas(o, comF7)
      }));
    } else {
      const periodos = state.periodos_parsed;
      const fnCalc = state.metodo === "mediana" ? calcMediana : calcMedia;
      const res = [];

      for (const per of periodos) {
        const obsPeriodo = obsTotal.filter(o => per.anos.includes(o.ano));
        for (const iso of paisesIso) {
          const obsPais = obsPeriodo.filter(o => o.iso === iso);
          if (!obsPais.length) continue;

          const m = {};
          for (const v of VARS) {
            const vals = obsPais.map(o => extrairMetricas(o, comF7)[v]);
            m[v] = fnCalc(vals);
          }

          const nomePais = state.dados.paises.find(p => p.iso === iso)?.pais || iso;
          res.push({
            periodo: per.rotulo,
            ordemPeriodo: per.ordem,
            pais: nomePais,
            iso: iso,
            ...m
          });
        }
      }

      return res;
    }
  }

  // =============================================================================
  // Agregação dos Dados para Aba "Estoques e IIP"
  // =============================================================================
  function calcularTabelaEstoques() {
    if (!state.dados.estoques) return [];
    const periodos = state.periodos_parsed;
    const grupos = state.grupos_ativos;
    const estoquesTotal = state.dados.estoques;
    const fnCalc = state.metodo === "mediana" ? calcMediana : calcMedia;

    const paisGruposMap = {};
    for (const g of grupos) {
      let listaPaises = state.grupos_paises[g] || [];
      if (typeof listaPaises === "string") listaPaises = [listaPaises];
      for (const iso of listaPaises) {
        if (!paisGruposMap[iso]) paisGruposMap[iso] = [];
        paisGruposMap[iso].push(g);
      }
    }
    for (const o of estoquesTotal) {
      if (o.tipo && (!paisGruposMap[o.iso] || !paisGruposMap[o.iso].includes(o.tipo))) {
        if (!paisGruposMap[o.iso]) paisGruposMap[o.iso] = [];
        paisGruposMap[o.iso].push(o.tipo);
      }
    }

    const resultados = [];

    for (const per of periodos) {
      const obsPeriodo = estoquesTotal.filter(o => per.anos.includes(o.ano));

      for (const g of grupos) {
        const obsGrupo = obsPeriodo.filter(o => {
          const grps = paisGruposMap[o.iso];
          return grps && grps.includes(g);
        });

        if (!obsGrupo.length) continue;

        resultados.push({
          periodo: per.rotulo,
          ordemPeriodo: per.ordem,
          grupo: g,
          ordemGrupo: state.dados.grupos_ordem.indexOf(g),
          a_p: fnCalc(obsGrupo.map(o => o.a_p)),
          l_p: fnCalc(obsGrupo.map(o => o.l_p)),
          iip: fnCalc(obsGrupo.map(o => o.iip)),
          pib: fnCalc(obsGrupo.map(o => o.pib)),
          res_pib: fnCalc(obsGrupo.map(o => o.res_pib))
        });
      }
    }

    return resultados;
  }

  // =============================================================================
  // Renderização do Gráfico Interativo com Chart.js (Aba Estoques)
  // =============================================================================
  function renderizarGraficoEstoques() {
    const cardEl = document.getElementById("card-grafico-estoques");
    if (state.aba_ativa !== "estoques") {
      if (cardEl) cardEl.style.display = "none";
      return;
    }

    if (cardEl) cardEl.style.display = "block";
    const canvas = document.getElementById("chart-estoques-canvas");
    if (!canvas || !window.Chart) return;

    const anos = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const metrica = state.metrica_grafico_estoque;
    const unidade = state.unidade_estoque;
    const visao = state.visao_grafico_estoque;
    const estoquesTotal = state.dados.estoques || [];

    // Mapeamento de campo conforme a unidade
    let campoChave = metrica;
    if (unidade === "pib") {
      if (metrica === "a_p") campoChave = "ativo_pib";
      else if (metrica === "l_p") campoChave = "passivo_pib";
      else if (metrica === "iip") campoChave = "iip_pib";
      else if (metrica === "res") campoChave = "res_pib";
    }

    const labelsMetrica = {
      iip: "Posição Internacional de Investimento Líquida (IIP)",
      a_p: "Estoque de Ativos Externos (A_P)",
      l_p: "Estoque de Passivos Externos (L_P)",
      res: "Reservas Totais (TRGMV_REVS)"
    };

    const sulfixoUnidade = unidade === "pib" ? "% do PIB" : "US$ Bilhões";
    const tituloGrafico = `${labelsMetrica[metrica]} — ${sulfixoUnidade}`;
    const tituloEl = document.getElementById("chart-estoques-titulo");
    if (tituloEl) tituloEl.innerText = tituloGrafico;

    const datasets = [];

    if (visao === "grupo") {
      const gruposSel = state.grupos_grafico_estoque;
      gruposSel.forEach(g => {
        const cor = CORES_PALETA[g] || "#3b82f6";
        const dadosPontos = anos.map(ano => {
          const obsAno = estoquesTotal.filter(o => o.ano === ano && o.tipo === g);
          if (!obsAno.length) return null;
          const valores = obsAno.map(o => o[campoChave]).filter(v => v !== null && !isNaN(v));
          return calcMedia(valores);
        });

        datasets.push({
          label: g,
          data: dadosPontos,
          borderColor: cor,
          backgroundColor: cor + "33",
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25
        });
      });
    } else {
      const paisesSel = state.paises_grafico_estoque;
      paisesSel.forEach((iso, idx) => {
        const cor = CORES_PAISES[idx % CORES_PAISES.length];
        const nomePais = state.dados.paises.find(p => p.iso === iso)?.pais || iso;
        const dadosPontos = anos.map(ano => {
          const obs = estoquesTotal.find(o => o.ano === ano && o.iso === iso);
          return obs && obs[campoChave] !== undefined ? obs[campoChave] : null;
        });

        datasets.push({
          label: nomePais,
          data: dadosPontos,
          borderColor: cor,
          backgroundColor: cor + "33",
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25
        });
      });
    }

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: anos.map(String),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 12, family: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto" } }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.parsed.y;
                if (val === null || val === undefined) return `${context.dataset.label}: —`;
                const sufixo = unidade === "pib" ? "%" : " bi";
                const prefixo = unidade === "usd" ? "US$ " : "";
                return `${context.dataset.label}: ${prefixo}${val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${sufixo}`;
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function (val) {
                const sufixo = unidade === "pib" ? "%" : " bi";
                return val.toLocaleString("pt-BR") + sufixo;
              }
            },
            grid: { color: "#f1f5f9" }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // =============================================================================
  // Renderização do Gráfico Inferior de Diferenciais (Aba Estoques)
  // =============================================================================
  function renderizarGraficoDiferenciaisEstoques() {
    const cardEl = document.getElementById("card-grafico-estoques");
    if (state.aba_ativa !== "estoques") return;

    const canvas = document.getElementById("chart-diferenciais-canvas");
    if (!canvas || !window.Chart) return;

    const anos = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const metricaDif = state.diferencial_estoque || "tr_dif";
    const visao = state.visao_grafico_estoque;
    const obsTotal = state.dados.obs || [];

    const labelsDif = {
      tr_dif: "Diferencial de Retorno Total (TR Dif = TR_A - TR_L)",
      yield_dif: "Diferencial de Rendimento (Yield Dif = Yield_A - Yield_L)",
      kg_dif: "Diferencial de Ganho de Capital (KG Dif = KG_A - KG_L)"
    };

    const tituloEl = document.getElementById("chart-diferenciais-titulo");
    if (tituloEl) {
      const f7Tag = state.usar_f7 ? " (Com F7)" : " (Sem F7)";
      tituloEl.innerText = `${labelsDif[metricaDif]}${f7Tag}`;
    }

    // Mapa de países para grupos
    const paisGruposMap = {};
    for (const g of state.dados.grupos_ordem) {
      let listaPaises = state.grupos_paises[g] || [];
      if (typeof listaPaises === "string") listaPaises = [listaPaises];
      for (const iso of listaPaises) {
        if (!paisGruposMap[iso]) paisGruposMap[iso] = [];
        paisGruposMap[iso].push(g);
      }
    }
    for (const o of obsTotal) {
      if (o.tipo && (!paisGruposMap[o.iso] || !paisGruposMap[o.iso].includes(o.tipo))) {
        if (!paisGruposMap[o.iso]) paisGruposMap[o.iso] = [];
        paisGruposMap[o.iso].push(o.tipo);
      }
    }

    const datasets = [];

    const campoDif = (metricaDif === "tr_dif" || metricaDif === "TR_dif") ? "TR_dif" : metricaDif;

    if (visao === "grupo") {
      const gruposSel = state.grupos_grafico_estoque;
      gruposSel.forEach(g => {
        const cor = CORES_PALETA[g] || "#3b82f6";
        const dadosPontos = anos.map(ano => {
          const obsAno = obsTotal.filter(o => {
            const grps = paisGruposMap[o.iso];
            return o.ano === ano && grps && grps.includes(g);
          });
          if (!obsAno.length) return null;
          const valores = obsAno.map(o => {
            const m = extrairMetricas(o, state.usar_f7);
            return m[campoDif] !== undefined ? m[campoDif] : m[metricaDif];
          }).filter(v => v !== null && !isNaN(v));
          if (!valores.length) return null;
          return calcMedia(valores) * 100; // Multiplica por 100 para percentual
        });

        datasets.push({
          label: g,
          data: dadosPontos,
          borderColor: cor,
          backgroundColor: cor + "33",
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25
        });
      });
    } else {
      const paisesSel = state.paises_grafico_estoque;
      paisesSel.forEach((iso, idx) => {
        const cor = CORES_PAISES[idx % CORES_PAISES.length];
        const nomePais = state.dados.paises.find(p => p.iso === iso)?.pais || iso;
        const dadosPontos = anos.map(ano => {
          const obs = obsTotal.find(o => o.ano === ano && o.iso === iso);
          if (!obs) return null;
          const metricas = extrairMetricas(obs, state.usar_f7);
          const val = metricas[campoDif] !== undefined ? metricas[campoDif] : metricas[metricaDif];
          return (val !== null && val !== undefined && !isNaN(val)) ? val * 100 : null;
        });

        datasets.push({
          label: nomePais,
          data: dadosPontos,
          borderColor: cor,
          backgroundColor: cor + "33",
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.25
        });
      });
    }

    if (state.chartDiferenciaisInstance) {
      state.chartDiferenciaisInstance.destroy();
    }

    state.chartDiferenciaisInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: anos.map(String),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 12, family: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto" } }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.parsed.y;
                if (val === null || val === undefined) return `${context.dataset.label}: —`;
                const sinal = val > 0 ? "+" : "";
                return `${context.dataset.label}: ${sinal}${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function (val) {
                const sinal = val > 0 ? "+" : "";
                return `${sinal}${val.toLocaleString("pt-BR")}%`;
              }
            },
            grid: {
              color: function (ctx) {
                return ctx.tick.value === 0 ? "#1e293b" : "#f1f5f9";
              },
              lineWidth: function (ctx) {
                return ctx.tick.value === 0 ? 1.5 : 1;
              }
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // =============================================================================
  // Renderização do Facet Grid de Barras (Aba Liquidez Internacional)
  // =============================================================================
  function renderizarFacetLiquidez() {
    const cardEl = document.getElementById("card-facet-liquidez");
    if (state.aba_ativa !== "liquidez") {
      if (cardEl) cardEl.style.display = "none";
      return;
    }

    if (cardEl) cardEl.style.display = "block";
    if (!window.Chart) return;

    const gruposFacet = [
      { id: "chart-liquidez-emerging", tipo: "Emerging Markets" },
      { id: "chart-liquidez-frontier", tipo: "Frontier Markets" },
      { id: "chart-liquidez-other", tipo: "Other Developing" }
    ];

    const anos = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const dadosFacet = state.dados.liquidez_facet || [];

    gruposFacet.forEach(cfg => {
      const canvas = document.getElementById(cfg.id);
      if (!canvas) return;

      const dadosGrupo = dadosFacet.filter(d => d.tipo === cfg.tipo);

      const pctQueima = anos.map(ano => {
        const item = dadosGrupo.find(d => d.ano === ano);
        return item ? item.pct_queimando : 0;
      });

      const pctSevero = anos.map(ano => {
        const item = dadosGrupo.find(d => d.ano === ano);
        return item ? item.pct_severo : 0;
      });

      const linhaRef = anos.map(() => 50);

      if (state.chartLiquidezInstances[cfg.id]) {
        state.chartLiquidezInstances[cfg.id].destroy();
      }

      state.chartLiquidezInstances[cfg.id] = new Chart(canvas, {
        data: {
          labels: anos.map(String),
          datasets: [
            {
              type: "bar",
              label: "% com Perda de Reservas (ΔR < 0)",
              data: pctQueima,
              backgroundColor: "#2c3e50dd",
              borderRadius: 3,
              order: 2
            },
            {
              type: "line",
              label: "% Queda Severa (>10%)",
              data: pctSevero,
              borderColor: "#dc2626",
              backgroundColor: "#dc2626",
              borderWidth: 2.2,
              pointRadius: 2,
              pointHoverRadius: 4,
              tension: 0.1,
              order: 1
            },
            {
              type: "line",
              label: "Linha de 50%",
              data: linhaRef,
              borderColor: "#94a3b8",
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 0,
              pointHoverRadius: 0,
              order: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  if (ctx.dataset.label === "Linha de 50%") return null;
                  const val = ctx.parsed.y;
                  return `${ctx.dataset.label}: ${val.toFixed(1).replace(".", ",")}%`;
                }
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: {
                stepSize: 25,
                callback: val => val + "%",
                font: { size: 10 }
              },
              grid: { color: "#f1f5f9" }
            },
            x: {
              grid: { display: false },
              ticks: {
                font: { size: 9 },
                maxRotation: 45,
                minRotation: 45
              }
            }
          }
        }
      });
    });
  }

  // =============================================================================
  // Cálculo da Tabela de Liquidez Internacional
  // =============================================================================
  function calcularTabelaLiquidez() {
    if (state.modo_tabela_liquidez === "ciclos") {
      const ciclosOficiais = state.dados.tabela_ciclos || [];
      return ciclosOficiais.map((item, idx) => ({
        ciclo: item.ciclo_liquidez,
        ordemCiclo: idx,
        tipo: item.tipo,
        n_obs: item.n_obs,
        pct_queimando: item.pct_queimando,
        pct_severo: item.pct_severo,
        crescimento_medio: item.crescimento_medio !== undefined ? item.crescimento_medio : item.crescimento_mediano
      }));
    } else {
      // Períodos customizados da barra lateral: média das médias anuais sincronizadas
      const periodos = state.periodos_parsed;
      const obsLiquidez = state.dados.liquidez_obs || [];
      const gruposPeriferia = ["Emerging Markets", "Frontier Markets", "Other Developing"];
      const resultados = [];

      periodos.forEach(per => {
        const obsPer = obsLiquidez.filter(o => per.anos.includes(o.ano));
        gruposPeriferia.forEach(g => {
          const obsGrupo = obsPer.filter(o => o.tipo === g);
          if (!obsGrupo.length) return;

          const n_obs = obsGrupo.length;
          const n_queimando = obsGrupo.filter(o => o.gasta).length;
          const n_severo = obsGrupo.filter(o => o.severo).length;

          // Média sincronizada: calcula a média anual de cada ano e depois a média do período
          const anosNoPer = [...new Set(obsGrupo.map(o => o.ano))];
          const mediasPorAno = anosNoPer.map(ano => {
            const obsAno = obsGrupo.filter(o => o.ano === ano);
            const vals = obsAno.map(o => o.var_pct).filter(v => v !== null && !isNaN(v));
            return calcMedia(vals);
          }).filter(m => m !== null);
          const crescMedio = calcMedia(mediasPorAno);

          resultados.push({
            ciclo: per.rotulo,
            ordemCiclo: per.ordem,
            tipo: g,
            n_obs: n_obs,
            pct_queimando: Math.round((n_queimando / n_obs) * 1000) / 10,
            pct_severo: Math.round((n_severo / n_obs) * 1000) / 10,
            crescimento_medio: Math.round((crescMedio || 0) * 10) / 10
          });
        });
      });
      return resultados;
    }
  }

  function gerarHtmlTabelaLiquidez(dados) {
    const isCiclos = state.modo_tabela_liquidez === "ciclos";
    const stubhead = isCiclos ? "Ciclo de Liquidez" : "Período";

    const ciclosMap = new Map();
    dados.sort((a, b) => a.ordemCiclo - b.ordemCiclo || a.tipo.localeCompare(b.tipo));

    for (const d of dados) {
      if (!ciclosMap.has(d.ciclo)) ciclosMap.set(d.ciclo, []);
      ciclosMap.get(d.ciclo).push(d);
    }

    let tbodyHtml = "<tbody>";
    for (const [cicloNome, itens] of ciclosMap.entries()) {
      tbodyHtml += `
        <tr class="group-header-row">
          <td colspan="5">${cicloNome}</td>
        </tr>
      `;
      for (const item of itens) {
        const queimaDestaque = item.pct_queimando >= 40 ? "val-neg font-weight-medium" : "";
        const severoDestaque = item.pct_severo >= 20 ? "val-neg font-weight-medium" : "";
        tbodyHtml += `
          <tr>
            <td class="text-left font-weight-medium">${item.tipo}</td>
            <td class="text-right">${item.n_obs}</td>
            <td class="text-right ${queimaDestaque}">${item.pct_queimando.toFixed(1).replace(".", ",")}%</td>
            <td class="text-right ${severoDestaque}">${item.pct_severo.toFixed(1).replace(".", ",")}%</td>
            <td class="text-right ${item.crescimento_medio < 0 ? 'val-neg' : ''}">${item.crescimento_medio.toFixed(1).replace(".", ",")}%</td>
          </tr>
        `;
      }
    }
    tbodyHtml += "</tbody>";

    return `
      <table class="gt-table">
        <thead>
          <tr>
            <th class="stubhead">Grupo</th>
            <th class="text-right">Obs (N)</th>
            <th class="text-right">% com Perda de Reservas</th>
            <th class="text-right">% com Queda Severa (&gt;10%)</th>
            <th class="text-right">Variação Média Anual (%)</th>
          </tr>
        </thead>
        ${tbodyHtml}
      </table>
    `;
  }

  // =============================================================================
  // Renderização da Aba de Classificação de Países
  // =============================================================================
  function renderizarClassificacao() {
    const container = document.getElementById("container-grupos-classificacao");
    if (!container) return;

    const listaPaises = state.dados.classificacao_paises || [];
    const busca = (state.busca_classificacao || "").trim().toLowerCase();

    let paisesFiltrados = listaPaises;
    if (busca) {
      paisesFiltrados = listaPaises.filter(p =>
        p.pais.toLowerCase().includes(busca) || (p.iso && p.iso.toLowerCase().includes(busca))
      );
    }

    const descricoesGrupos = {
      "USA": "Estados Unidos — polo emissor da moeda de reserva e centro hegemônico do sistema monetário internacional.",
      "AEs": "G7 ex-EUA (Canadá, França, Alemanha, Itália, Japão, Reino Unido) — economias avançadas centrais.",
      "AEs Periféricos": "Economias avançadas fora do G7 (Europa não-G7, Ásia avançada, Oceania) com mercados de capitais maduros.",
      "Emerging Markets": "Economias emergentes integradas aos fluxos globais de capital com vulnerabilidades periféricas típicas.",
      "Frontier Markets": "Mercados de fronteira com maior restrição externa de liquidez e vulnerabilidade a choques cambiais.",
      "Other Developing": "Demais economias em desenvolvimento e de menor renda relativa."
    };

    const ordemGrupos = ["USA", "AEs", "AEs Periféricos", "Emerging Markets", "Frontier Markets", "Other Developing"];

    let html = "";
    ordemGrupos.forEach(grupo => {
      const paisesDoGrupo = paisesFiltrados.filter(p => p.tipo === grupo);
      if (busca && !paisesDoGrupo.length) return;

      const chipsHtml = paisesDoGrupo.map(p => `
        <span class="pais-badge">
          ${p.pais}
          <span class="pais-badge-iso">${p.iso || "—"}</span>
        </span>
      `).join("");

      html += `
        <div class="grupo-classificacao-card">
          <div class="grupo-card-header">
            <div>
              <span class="grupo-card-title">${grupo}</span>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${descricoesGrupos[grupo] || ""}</p>
            </div>
            <span class="badge-count">${paisesDoGrupo.length} ${paisesDoGrupo.length === 1 ? 'país' : 'países'}</span>
          </div>
          <div class="grupo-paises-chips">
            ${chipsHtml || '<span style="color: var(--text-muted); font-size: 0.8rem;">Nenhum país encontrado para a busca.</span>'}
          </div>
        </div>
      `;
    });

    if (!html) {
      html = '<div class="state-message">Nenhum país encontrado com o termo pesquisado.</div>';
    }

    container.innerHTML = html;
  }

  // =============================================================================
  // Renderização de Tabelas no Estilo GT com Sticky Header
  // =============================================================================
  function renderizarTabela() {
    const container = document.getElementById("tabela-container");
    const tituloEl = document.getElementById("content-title");

    if (state.aba_ativa === "grupo") {
      tituloEl.innerText = state.agrupar_por === "periodo" ? "Retornos por período" : "Retornos por grupo";
      const dadosGrupo = calcularTabelaGrupo();
      if (!dadosGrupo.length) {
        container.innerHTML = '<div class="state-message">Sem observações para a seleção.</div>';
        return;
      }
      container.innerHTML = gerarHtmlTabelaGrupo(dadosGrupo);
    } else if (state.aba_ativa === "pais") {
      const nomesPaises = state.paises_selecionados.map(iso => {
        return state.dados.paises.find(p => p.iso === iso)?.pais || iso;
      }).join(", ");

      tituloEl.innerText = state.modo_tempo_pais === "anual"
        ? `Retornos por ano: ${nomesPaises}`
        : `Retornos por período: ${nomesPaises}`;

      const dadosPais = calcularTabelaPais();
      if (!dadosPais.length) {
        container.innerHTML = '<div class="state-message">Sem dados disponíveis para o(s) país(es) selecionado(s).</div>';
        return;
      }
      container.innerHTML = gerarHtmlTabelaPais(dadosPais);
    } else if (state.aba_ativa === "estoques") {
      tituloEl.innerText = "Médias de Estoques, IIP e Liquidez por Grupo no Período";
      const dadosEstoques = calcularTabelaEstoques();
      if (!dadosEstoques.length) {
        container.innerHTML = '<div class="state-message">Sem observações de estoques para a seleção.</div>';
        return;
      }
      container.innerHTML = gerarHtmlTabelaEstoques(dadosEstoques);
    } else if (state.aba_ativa === "liquidez") {
      tituloEl.innerText = state.modo_tabela_liquidez === "ciclos"
        ? "Regimes Globais de Liquidez e Perda de Reservas"
        : "Perda de Reservas por Período Customizado";
      const dadosLiquidez = calcularTabelaLiquidez();
      if (!dadosLiquidez.length) {
        container.innerHTML = '<div class="state-message">Sem observações de liquidez para a seleção.</div>';
        return;
      }
      container.innerHTML = gerarHtmlTabelaLiquidez(dadosLiquidez);
    }
  }

  function gerarCabecalhoHtml(stubhead) {
    return `
      <thead>
        <tr>
          <th class="stubhead" rowspan="2">${stubhead}</th>
          <th colspan="3" class="spanner-border">Yield</th>
          <th colspan="3" class="spanner-border">Ganho de capital</th>
          <th colspan="3" class="spanner-border">Retorno total</th>
        </tr>
        <tr>
          <th class="spanner-border">Ativo</th>
          <th>Passivo</th>
          <th>Dif</th>
          <th class="spanner-border">Ativo</th>
          <th>Passivo</th>
          <th>Dif</th>
          <th class="spanner-border">Ativo</th>
          <th>Passivo</th>
          <th>Dif</th>
        </tr>
      </thead>
    `;
  }

  function gerarHtmlLinhaValores(item) {
    return `
      <td class="text-right spanner-border ${item.yield_A < 0 ? 'val-neg' : ''}">${fmtPercent(item.yield_A)}</td>
      <td class="text-right ${item.yield_L < 0 ? 'val-neg' : ''}">${fmtPercent(item.yield_L)}</td>
      <td class="text-right ${item.yield_dif < 0 ? 'val-neg' : ''}">${fmtPercent(item.yield_dif)}</td>
      <td class="text-right spanner-border ${item.kg_A < 0 ? 'val-neg' : ''}">${fmtPercent(item.kg_A)}</td>
      <td class="text-right ${item.kg_L < 0 ? 'val-neg' : ''}">${fmtPercent(item.kg_L)}</td>
      <td class="text-right ${item.kg_dif < 0 ? 'val-neg' : ''}">${fmtPercent(item.kg_dif)}</td>
      <td class="text-right spanner-border ${item.TR_A < 0 ? 'val-neg' : ''}">${fmtPercent(item.TR_A)}</td>
      <td class="text-right ${item.TR_L < 0 ? 'val-neg' : ''}">${fmtPercent(item.TR_L)}</td>
      <td class="text-right ${item.TR_dif < 0 ? 'val-neg' : ''}">${fmtPercent(item.TR_dif)}</td>
    `;
  }

  function gerarHtmlTabelaGrupo(dados) {
    const porPeriodo = state.agrupar_por === "periodo";
    const stubhead = porPeriodo ? "Grupo" : "Período";

    // Preserva estritamente a ordem de inserção usando new Map()
    const gruposMap = new Map();
    if (porPeriodo) {
      dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo || a.ordemGrupo - b.ordemGrupo);
      for (const d of dados) {
        if (!gruposMap.has(d.periodo)) gruposMap.set(d.periodo, []);
        gruposMap.get(d.periodo).push(d);
      }
    } else {
      dados.sort((a, b) => a.ordemGrupo - b.ordemGrupo || a.ordemPeriodo - b.ordemPeriodo);
      for (const d of dados) {
        if (!gruposMap.has(d.grupo)) gruposMap.set(d.grupo, []);
        gruposMap.get(d.grupo).push(d);
      }
    }

    let tbodyHtml = "<tbody>";
    for (const [nomeGrupo, itens] of gruposMap.entries()) {
      tbodyHtml += `
        <tr class="group-header-row">
          <td colspan="10">${nomeGrupo}</td>
        </tr>
      `;
      for (const item of itens) {
        const rowLabel = porPeriodo ? item.grupo : item.periodo;
        tbodyHtml += `
          <tr>
            <td class="text-left font-weight-medium">${rowLabel}</td>
            ${gerarHtmlLinhaValores(item)}
          </tr>
        `;
      }
    }
    tbodyHtml += "</tbody>";

    return `
      <table class="gt-table">
        ${gerarCabecalhoHtml(stubhead)}
        ${tbodyHtml}
      </table>
    `;
  }

  function gerarHtmlTabelaPais(dados) {
    const isAnual = state.modo_tempo_pais === "anual";
    const isMulti = state.paises_selecionados.length > 1;

    let stubhead = isAnual ? "Ano" : (isMulti ? "País" : "Período");

    let tbodyHtml = "<tbody>";

    if (isAnual) {
      if (isMulti) {
        const paisMap = new Map();
        for (const d of dados) {
          if (!paisMap.has(d.pais)) paisMap.set(d.pais, []);
          paisMap.get(d.pais).push(d);
        }
        for (const [paisNome, itens] of paisMap.entries()) {
          tbodyHtml += `<tr class="group-header-row"><td colspan="10">${paisNome}</td></tr>`;
          for (const item of itens) {
            tbodyHtml += `
              <tr>
                <td class="text-left">${item.ano}</td>
                ${gerarHtmlLinhaValores(item)}
              </tr>
            `;
          }
        }
      } else {
        for (const item of dados) {
          tbodyHtml += `
            <tr>
              <td class="text-left">${item.ano}</td>
              ${gerarHtmlLinhaValores(item)}
            </tr>
          `;
        }
      }
    } else {
      if (isMulti) {
        const perMap = new Map();
        dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo || a.pais.localeCompare(b.pais));
        for (const d of dados) {
          if (!perMap.has(d.periodo)) perMap.set(d.periodo, []);
          perMap.get(d.periodo).push(d);
        }
        for (const [perNome, itens] of perMap.entries()) {
          tbodyHtml += `<tr class="group-header-row"><td colspan="10">${perNome}</td></tr>`;
          for (const item of itens) {
            tbodyHtml += `
              <tr>
                <td class="text-left">${item.pais}</td>
                ${gerarHtmlLinhaValores(item)}
              </tr>
            `;
          }
        }
      } else {
        dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo);
        for (const item of dados) {
          tbodyHtml += `
            <tr>
              <td class="text-left">${item.periodo}</td>
              ${gerarHtmlLinhaValores(item)}
            </tr>
          `;
        }
      }
    }

    tbodyHtml += "</tbody>";

    return `
      <table class="gt-table">
        ${gerarCabecalhoHtml(stubhead)}
        ${tbodyHtml}
      </table>
    `;
  }

  function gerarHtmlTabelaEstoques(dados) {
    const perMap = new Map();
    dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo || a.ordemGrupo - b.ordemGrupo);
    for (const d of dados) {
      if (!perMap.has(d.periodo)) perMap.set(d.periodo, []);
      perMap.get(d.periodo).push(d);
    }

    let tbodyHtml = "<tbody>";
    for (const [perNome, itens] of perMap.entries()) {
      tbodyHtml += `
        <tr class="group-header-row">
          <td colspan="6">${perNome}</td>
        </tr>
      `;
      for (const item of itens) {
        tbodyHtml += `
          <tr>
            <td class="text-left font-weight-medium">${item.grupo}</td>
            <td class="text-right">${fmtBi(item.a_p)}</td>
            <td class="text-right">${fmtBi(item.l_p)}</td>
            <td class="text-right ${item.iip < 0 ? 'val-neg' : ''}">${fmtBi(item.iip)}</td>
            <td class="text-right">${fmtBi(item.pib)}</td>
            <td class="text-right font-weight-medium">${fmtPctBr(item.res_pib)}</td>
          </tr>
        `;
      }
    }
    tbodyHtml += "</tbody>";

    return `
      <table class="gt-table">
        <thead>
          <tr>
            <th class="stubhead">Grupo</th>
            <th class="text-right">Ativos Externos (US$ bi)</th>
            <th class="text-right">Passivos Externos (US$ bi)</th>
            <th class="text-right">IIP Líquido (US$ bi)</th>
            <th class="text-right">PIB (US$ bi)</th>
            <th class="text-right">Reservas / PIB (%)</th>
          </tr>
        </thead>
        ${tbodyHtml}
      </table>
    `;
  }

  // =============================================================================
  // Exportação Excel
  // =============================================================================
  function exportarExcel() {
    const isGrupo = state.aba_ativa === "grupo";
    const isPais = state.aba_ativa === "pais";
    const isEstoques = state.aba_ativa === "estoques";
    const isLiquidez = state.aba_ativa === "liquidez";

    let dados, cabecalho, prefix;

    if (isLiquidez) {
      dados = calcularTabelaLiquidez();
      if (!dados.length) return;
      cabecalho = [state.modo_tabela_liquidez === "ciclos" ? "Ciclo de Liquidez" : "Período", "Grupo", "Obs (N)", "% Perda de Reservas", "% Queda Severa (>10%)", "Variação Média Anual (%)"];
      prefix = "Liquidez_Internacional_";
    } else if (isEstoques) {
      dados = calcularTabelaEstoques();
      if (!dados.length) return;
      cabecalho = ["Período", "Grupo", "Ativos (US$ bi)", "Passivos (US$ bi)", "IIP Líquido (US$ bi)", "PIB (US$ bi)", "Reservas / PIB (%)"];
      prefix = "Estoques_IIP_";
    } else if (isGrupo) {
      dados = calcularTabelaGrupo();
      if (!dados.length) return;
      cabecalho = state.agrupar_por === "periodo" ? ["Período", "Grupo"] : ["Grupo", "Período"];
      cabecalho.push("Yield Ativo", "Yield Passivo", "Yield Dif", "KG Ativo", "KG Passivo", "KG Dif", "TR Ativo", "TR Passivo", "TR Dif");
      prefix = state.agrupar_por === "periodo" ? "Periodo_Grupo_" : "Grupo_Periodo_";
    } else {
      dados = calcularTabelaPais();
      if (!dados.length) return;
      cabecalho = state.modo_tempo_pais === "anual" ? ["País", "Ano"] : ["Período", "País"];
      cabecalho.push("Yield Ativo", "Yield Passivo", "Yield Dif", "KG Ativo", "KG Passivo", "KG Dif", "TR Ativo", "TR Passivo", "TR Dif");
      prefix = state.modo_tempo_pais === "anual" ? "Pais_Anual_" : "Pais_Periodo_";
    }

    const linhasExport = [cabecalho];

    for (const d of dados) {
      if (isLiquidez) {
        linhasExport.push([d.ciclo, d.tipo, d.n_obs, d.pct_queimando, d.pct_severo, d.crescimento_medio]);
      } else if (isEstoques) {
        linhasExport.push([d.periodo, d.grupo, d.a_p, d.l_p, d.iip, d.pib, d.res_pib]);
      } else if (isGrupo) {
        const linha = state.agrupar_por === "periodo" ? [d.periodo, d.grupo] : [d.grupo, d.periodo];
        linha.push(d.yield_A, d.yield_L, d.yield_dif, d.kg_A, d.kg_L, d.kg_dif, d.TR_A, d.TR_L, d.TR_dif);
        linhasExport.push(linha);
      } else {
        const linha = state.modo_tempo_pais === "anual" ? [d.pais, d.ano] : [d.periodo, d.pais];
        linha.push(d.yield_A, d.yield_L, d.yield_dif, d.kg_A, d.kg_L, d.kg_dif, d.TR_A, d.TR_L, d.TR_dif);
        linhasExport.push(linha);
      }
    }

    const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");

    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(linhasExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `${prefix}${dataStr}.xlsx`);
    } else {
      const csvContent = "data:text/csv;charset=utf-8," +
        linhasExport.map(e => e.map(val => typeof val === "string" ? `"${val}"` : String(val).replace(".", ",")).join(";")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${prefix}${dataStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // =============================================================================
  // Controles UI e Bindings
  // =============================================================================
  function montarControlesUI() {
    // Textarea de períodos
    const txtPeriodos = document.getElementById("txt-periodos");
    if (txtPeriodos) {
      txtPeriodos.value = state.periodos_texto;
    }

    // Select de países na aba "Por País"
    const selectPais = document.getElementById("select-pais");
    if (selectPais) {
      selectPais.innerHTML = state.dados.paises.map(p =>
        `<option value="${p.iso}" ${state.paises_selecionados.includes(p.iso) ? "selected" : ""}>${p.pais} (${p.iso})</option>`
      ).join("");
    }
    atualizarChipsPaises();

    // Checkboxes dos grupos na sidebar
    const containerGrupos = document.getElementById("lista-grupos-tabela");
    if (containerGrupos) {
      containerGrupos.innerHTML = state.dados.grupos_ordem.map(g => `
        <label class="checkbox-item">
          <input type="checkbox" value="${g}" ${state.grupos_ativos.includes(g) ? "checked" : ""}>
          ${g}
        </label>
      `).join("");
    }

    // Controles da Aba Estoques e IIP
    const selectGrupoEstoque = document.getElementById("select-grupo-estoque");
    if (selectGrupoEstoque) {
      selectGrupoEstoque.innerHTML = state.dados.grupos_ordem.map(g =>
        `<option value="${g}" ${state.grupos_grafico_estoque.includes(g) ? "selected" : ""}>${g}</option>`
      ).join("");
    }
    atualizarChipsGruposEstoque();

    const selectPaisEstoque = document.getElementById("select-pais-estoque");
    if (selectPaisEstoque) {
      selectPaisEstoque.innerHTML = state.dados.paises.map(p =>
        `<option value="${p.iso}" ${state.paises_grafico_estoque.includes(p.iso) ? "selected" : ""}>${p.pais} (${p.iso})</option>`
      ).join("");
    }
    atualizarChipsPaisesEstoque();
  }

  function atualizarChipsPaises() {
    const chipsContainer = document.getElementById("chips-paises");
    if (!chipsContainer) return;
    chipsContainer.innerHTML = state.paises_selecionados.map(iso => {
      const p = state.dados.paises.find(item => item.iso === iso);
      const nome = p ? p.pais : iso;
      return `
        <span class="chip">
          ${nome}
          <span class="chip-remove" data-iso="${iso}">&times;</span>
        </span>
      `;
    }).join("");
  }

  function atualizarChipsGruposEstoque() {
    const chipsContainer = document.getElementById("chips-grupos-estoque");
    if (!chipsContainer) return;
    chipsContainer.innerHTML = state.grupos_grafico_estoque.map(g => `
      <span class="chip">
        ${g}
        <span class="chip-remove" data-grupo="${g}">&times;</span>
      </span>
    `).join("");
  }

  function atualizarChipsPaisesEstoque() {
    const chipsContainer = document.getElementById("chips-paises-estoque");
    if (!chipsContainer) return;
    chipsContainer.innerHTML = state.paises_grafico_estoque.map(iso => {
      const p = state.dados.paises.find(item => item.iso === iso);
      const nome = p ? p.pais : iso;
      return `
        <span class="chip">
          ${nome}
          <span class="chip-remove" data-iso="${iso}">&times;</span>
        </span>
      `;
    }).join("");
  }

  function vincularEventos() {
    // Toggle F7
    const chkF7 = document.getElementById("chk-f7");
    if (chkF7) {
      chkF7.addEventListener("change", (e) => {
        state.usar_f7 = e.target.checked;
        renderizar();
      });
    }

    // Abas de navegação (Por Grupo / Por País / Estoques e IIP / Liquidez / Classificação)
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.aba_ativa = btn.dataset.tab;

        // Alterna visibilidade dos painéis condicionais na sidebar
        const f7Box = document.getElementById("f7-container");
        if (f7Box) f7Box.style.display = (state.aba_ativa === "grupo" || state.aba_ativa === "pais" || state.aba_ativa === "estoques") ? "block" : "none";

        document.getElementById("painel-grupo-sidebar").style.display = state.aba_ativa === "grupo" ? "block" : "none";
        document.getElementById("painel-pais-sidebar").style.display = state.aba_ativa === "pais" ? "block" : "none";
        document.getElementById("painel-estoques-sidebar").style.display = state.aba_ativa === "estoques" ? "block" : "none";
        document.getElementById("painel-liquidez-sidebar").style.display = state.aba_ativa === "liquidez" ? "block" : "none";

        // Accordions na sidebar
        const accordions = document.querySelectorAll(".accordion-item");
        if (accordions.length >= 3) {
          accordions[0].style.display = state.aba_ativa === "classificacao" ? "none" : "block"; // Períodos
          accordions[1].style.display = (state.aba_ativa === "grupo" || state.aba_ativa === "pais" || state.aba_ativa === "estoques") ? "block" : "none"; // Grupos
          accordions[2].style.display = (state.aba_ativa === "grupo" || state.aba_ativa === "pais") ? "block" : "none"; // Método
        }

        renderizar();
      });
    });

    // Ordenação (Período vs Grupo)
    document.querySelectorAll("input[name='agrupar_por']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.agrupar_por = e.target.value;
        renderizar();
      });
    });

    // Modo tempo país (Ano a ano vs Período)
    document.querySelectorAll("input[name='modo_tempo_pais']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.modo_tempo_pais = e.target.value;
        renderizar();
      });
    });

    // Seleção de país no select
    const selectPais = document.getElementById("select-pais");
    if (selectPais) {
      selectPais.addEventListener("change", (e) => {
        const sel = Array.from(e.target.selectedOptions).map(o => o.value);
        if (sel.length) {
          state.paises_selecionados = sel;
          atualizarChipsPaises();
          renderizar();
        }
      });
    }

    // Remoção de chip de país
    const chipsContainer = document.getElementById("chips-paises");
    if (chipsContainer) {
      chipsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("chip-remove")) {
          const iso = e.target.dataset.iso;
          if (state.paises_selecionados.length > 1) {
            state.paises_selecionados = state.paises_selecionados.filter(i => i !== iso);
            const opt = selectPais.querySelector(`option[value="${iso}"]`);
            if (opt) opt.selected = false;
            atualizarChipsPaises();
            renderizar();
          }
        }
      });
    }

    // Preset de períodos
    const selectPreset = document.getElementById("select-preset");
    const txtPeriodos = document.getElementById("txt-periodos");
    if (selectPreset && txtPeriodos) {
      selectPreset.addEventListener("change", (e) => {
        state.preset = e.target.value;
        txtPeriodos.value = PRESETS[state.preset].join("\n");
        state.periodos_texto = txtPeriodos.value;
        parsePeriodos();
        renderizar();
      });

      txtPeriodos.addEventListener("input", (e) => {
        state.periodos_texto = e.target.value;
        parsePeriodos();
        renderizar();
      });
    }

    // Grupos ativos na tabela
    const containerGrupos = document.getElementById("lista-grupos-tabela");
    if (containerGrupos) {
      containerGrupos.addEventListener("change", () => {
        const checked = Array.from(containerGrupos.querySelectorAll("input[type='checkbox']:checked")).map(c => c.value);
        state.grupos_ativos = checked.length ? checked : [...state.dados.grupos_ordem];
        renderizar();
      });
    }

    // Método de agregação
    document.querySelectorAll("input[name='metodo_agregacao']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.metodo = e.target.value;
        renderizar();
      });
    });

    // Accordions
    document.querySelectorAll(".accordion-header").forEach(hdr => {
      hdr.addEventListener("click", () => {
        const item = hdr.closest(".accordion-item");
        item.classList.toggle("open");
      });
    });

    // Botão Exportar Excel
    const btnExport = document.getElementById("btn-exportar");
    if (btnExport) {
      btnExport.addEventListener("click", exportarExcel);
    }

    // =========================================================================
    // Eventos Específicos da Aba Estoques e IIP
    // =========================================================================
    document.querySelectorAll("input[name='visao_grafico_estoque']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.visao_grafico_estoque = e.target.value;
        const blocoGrupo = document.getElementById("bloco-select-grupo-estoque");
        const blocoPais = document.getElementById("bloco-select-pais-estoque");
        if (blocoGrupo && blocoPais) {
          blocoGrupo.style.display = state.visao_grafico_estoque === "grupo" ? "block" : "none";
          blocoPais.style.display = state.visao_grafico_estoque === "pais" ? "block" : "none";
        }
        renderizar();
      });
    });

    const selectGrupoEstoque = document.getElementById("select-grupo-estoque");
    if (selectGrupoEstoque) {
      selectGrupoEstoque.addEventListener("change", (e) => {
        const sel = Array.from(e.target.selectedOptions).map(o => o.value);
        if (sel.length) {
          state.grupos_grafico_estoque = sel;
          atualizarChipsGruposEstoque();
          renderizarGraficoEstoques();
          renderizarGraficoDiferenciaisEstoques();
        }
      });
    }

    const chipsGruposEstoque = document.getElementById("chips-grupos-estoque");
    if (chipsGruposEstoque) {
      chipsGruposEstoque.addEventListener("click", (e) => {
        if (e.target.classList.contains("chip-remove")) {
          const g = e.target.dataset.grupo;
          if (state.grupos_grafico_estoque.length > 1) {
            state.grupos_grafico_estoque = state.grupos_grafico_estoque.filter(item => item !== g);
            const opt = selectGrupoEstoque.querySelector(`option[value="${g}"]`);
            if (opt) opt.selected = false;
            atualizarChipsGruposEstoque();
            renderizarGraficoEstoques();
            renderizarGraficoDiferenciaisEstoques();
          }
        }
      });
    }

    const selectPaisEstoque = document.getElementById("select-pais-estoque");
    if (selectPaisEstoque) {
      selectPaisEstoque.addEventListener("change", (e) => {
        const sel = Array.from(e.target.selectedOptions).map(o => o.value);
        if (sel.length) {
          state.paises_grafico_estoque = sel;
          atualizarChipsPaisesEstoque();
          renderizarGraficoEstoques();
          renderizarGraficoDiferenciaisEstoques();
        }
      });
    }

    const chipsPaisesEstoque = document.getElementById("chips-paises-estoque");
    if (chipsPaisesEstoque) {
      chipsPaisesEstoque.addEventListener("click", (e) => {
        if (e.target.classList.contains("chip-remove")) {
          const iso = e.target.dataset.iso;
          if (state.paises_grafico_estoque.length > 1) {
            state.paises_grafico_estoque = state.paises_grafico_estoque.filter(i => i !== iso);
            const opt = selectPaisEstoque.querySelector(`option[value="${iso}"]`);
            if (opt) opt.selected = false;
            atualizarChipsPaisesEstoque();
            renderizarGraficoEstoques();
            renderizarGraficoDiferenciaisEstoques();
          }
        }
      });
    }

    const selectMetricaEstoque = document.getElementById("select-metrica-estoque");
    if (selectMetricaEstoque) {
      selectMetricaEstoque.addEventListener("change", (e) => {
        state.metrica_grafico_estoque = e.target.value;
        renderizarGraficoEstoques();
      });
    }

    document.querySelectorAll("input[name='unidade_estoque']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.unidade_estoque = e.target.value;
        renderizarGraficoEstoques();
      });
    });

    // Seletor de Diferencial no Gráfico Inferior de Estoques (com sincronização)
    function sincronizarDiferencialEstoque(val) {
      state.diferencial_estoque = val;
      document.querySelectorAll("input[name='diferencial_estoque']").forEach(r => r.checked = (r.value === val));
      document.querySelectorAll("input[name='diferencial_estoque_top']").forEach(r => r.checked = (r.value === val));
      renderizarGraficoDiferenciaisEstoques();
    }

    document.querySelectorAll("input[name='diferencial_estoque']").forEach(radio => {
      radio.addEventListener("change", (e) => sincronizarDiferencialEstoque(e.target.value));
    });

    document.querySelectorAll("input[name='diferencial_estoque_top']").forEach(radio => {
      radio.addEventListener("change", (e) => sincronizarDiferencialEstoque(e.target.value));
    });

    // Modo da tabela de liquidez
    document.querySelectorAll("input[name='modo_tabela_liquidez']").forEach(radio => {
      radio.addEventListener("change", (e) => {
        state.modo_tabela_liquidez = e.target.value;
        renderizarTabela();
      });
    });

    // Busca rápida na aba de classificação
    const inputBuscaClass = document.getElementById("input-busca-classificacao");
    if (inputBuscaClass) {
      inputBuscaClass.addEventListener("input", (e) => {
        state.busca_classificacao = e.target.value;
        renderizarClassificacao();
      });
    }
  }

  function renderizar() {
    const isEstoques = state.aba_ativa === "estoques";
    const isLiquidez = state.aba_ativa === "liquidez";
    const isClassificacao = state.aba_ativa === "classificacao";

    const cardEstoques = document.getElementById("card-grafico-estoques");
    if (cardEstoques) cardEstoques.style.display = isEstoques ? "block" : "none";

    const cardFacetLiquidez = document.getElementById("card-facet-liquidez");
    if (cardFacetLiquidez) cardFacetLiquidez.style.display = isLiquidez ? "block" : "none";

    const cardClassificacao = document.getElementById("card-classificacao");
    if (cardClassificacao) cardClassificacao.style.display = isClassificacao ? "block" : "none";

    const toolbar = document.getElementById("content-toolbar-container");
    if (toolbar) toolbar.style.display = isClassificacao ? "none" : "flex";

    const tabelaCont = document.getElementById("tabela-container");
    if (tabelaCont) tabelaCont.style.display = isClassificacao ? "none" : "block";

    if (isEstoques) {
      renderizarGraficoEstoques();
      renderizarGraficoDiferenciaisEstoques();
    } else if (isLiquidez) {
      renderizarFacetLiquidez();
    } else if (isClassificacao) {
      renderizarClassificacao();
    }

    if (!isClassificacao) {
      renderizarTabela();
    }
  }

  // Auto-iniciar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
