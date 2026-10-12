// =============================================================================
// Lógica Computacional e Renderização do Dashboard de Retornos Externos
// =============================================================================

(function () {
  "use strict";

  // Estado da Aplicação
  const state = {
    dados: null,
    usar_f7: false,
    aba_ativa: "grupo", // "grupo" | "pais"
    agrupar_por: "periodo", // "periodo" | "grupo"
    modo_tempo_pais: "anual", // "anual" | "periodo"
    preset: "script",
    metodo: "script", // "script" | "pooled" | "mediana"
    grupos_ativos: [],
    grupos_paises: {}, // { "USA": ["USA"], "AEs": [...], ... }
    paises_selecionados: ["BRA"],
    periodos_texto: "",
    periodos_parsed: []
  };

  const VARS = ["yield_A", "yield_L", "yield_dif", "kg_A", "kg_L", "kg_dif", "TR_A", "TR_L", "TR_dif"];

  const PRESETS = {
    script: ["2000-2004", "2005-2009", "2010-2014", "2015-2019", "2020-2025"],
    proposta: ["2000-2005", "2006-2009", "2010-2014", "2015-2019", "2020-2025"],
    ciclos: [
      "2000-2002: Crises e dotcom",
      "2003-2007: Superciclo",
      "2008-2009: Crise financeira global",
      "2010-2013: QE",
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
    const soma = arr.reduce((acc, v) => acc + v, 0);
    return soma / arr.length;
  }

  function calcMediana(arr) {
    if (!arr || !arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
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
      TR_dif: TR_A - TR_L
    };
  }

  // Formatação em porcentagem com 2 decimais
  function fmtPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    const num = (val * 100).toFixed(2).replace(".", ",");
    return `${num}%`;
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

    // Mapa país -> grupos aos quais pertence
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
      // Filtra observações que caem nos anos do período
      const obsPeriodo = obsTotal.filter(o => per.anos.includes(o.ano));

      for (const g of grupos) {
        // Observações pertencentes ao grupo g neste período
        const obsGrupo = obsPeriodo.filter(o => {
          const grps = paisGruposMap[o.iso];
          return grps && grps.includes(g);
        });

        if (!obsGrupo.length) continue;

        let resMetricas = {};

        if (metodo === "script") {
          // Média das médias anuais (idêntico ao script R)
          // 1. Média para cada ano do período
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

          // 2. Média das médias anuais
          for (const v of VARS) {
            resMetricas[v] = calcMedia(mediasPorAno.map(m => m[v]));
          }
        } else if (metodo === "pooled") {
          // Média de todas as observações país-ano
          for (const v of VARS) {
            const vals = obsGrupo.map(o => extrairMetricas(o, comF7)[v]);
            resMetricas[v] = calcMedia(vals);
          }
        } else if (metodo === "mediana") {
          // Mediana das medianas anuais
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
      // Retornos ano a ano
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
      // Retornos por período
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
    } else {
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

    // Agrupamento por Periodo ou Grupo
    const gruposMap = {};
    if (porPeriodo) {
      dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo || a.ordemGrupo - b.ordemGrupo);
      for (const d of dados) {
        if (!gruposMap[d.periodo]) gruposMap[d.periodo] = [];
        gruposMap[d.periodo].push(d);
      }
    } else {
      dados.sort((a, b) => a.ordemGrupo - b.ordemGrupo || a.ordemPeriodo - b.ordemPeriodo);
      for (const d of dados) {
        if (!gruposMap[d.grupo]) gruposMap[d.grupo] = [];
        gruposMap[d.grupo].push(d);
      }
    }

    let tbodyHtml = "<tbody>";
    for (const [nomeGrupo, itens] of Object.entries(gruposMap)) {
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
        // Agrupa por País
        const paisMap = {};
        for (const d of dados) {
          if (!paisMap[d.pais]) paisMap[d.pais] = [];
          paisMap[d.pais].push(d);
        }
        for (const [paisNome, itens] of Object.entries(paisMap)) {
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
        // País único: linhas são os Anos
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
        // Agrupa por Período
        const perMap = {};
        dados.sort((a, b) => a.ordemPeriodo - b.ordemPeriodo || a.pais.localeCompare(b.pais));
        for (const d of dados) {
          if (!perMap[d.periodo]) perMap[d.periodo] = [];
          perMap[d.periodo].push(d);
        }
        for (const [perNome, itens] of Object.entries(perMap)) {
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
        // País único por período
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

  // =============================================================================
  // Exportação Excel
  // =============================================================================
  function exportarExcel() {
    const isGrupo = state.aba_ativa === "grupo";
    const dados = isGrupo ? calcularTabelaGrupo() : calcularTabelaPais();
    if (!dados.length) return;

    const linhasExport = [];

    // Cabeçalho colunas
    const cabecalho = isGrupo
      ? (state.agrupar_por === "periodo" ? ["Período", "Grupo"] : ["Grupo", "Período"])
      : (state.modo_tempo_pais === "anual" ? ["País", "Ano"] : ["Período", "País"]);

    cabecalho.push(
      "Yield Ativo", "Yield Passivo", "Yield Dif",
      "KG Ativo", "KG Passivo", "KG Dif",
      "TR Ativo", "TR Passivo", "TR Dif"
    );

    linhasExport.push(cabecalho);

    for (const d of dados) {
      const linha = isGrupo
        ? (state.agrupar_por === "periodo" ? [d.periodo, d.grupo] : [d.grupo, d.periodo])
        : (state.modo_tempo_pais === "anual" ? [d.pais, d.ano] : [d.periodo, d.pais]);

      linha.push(
        d.yield_A, d.yield_L, d.yield_dif,
        d.kg_A, d.kg_L, d.kg_dif,
        d.TR_A, d.TR_L, d.TR_dif
      );
      linhasExport.push(linha);
    }

    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(linhasExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Retornos");
      const prefix = isGrupo
        ? (state.agrupar_por === "periodo" ? "Periodo_Grupo_" : "Grupo_Periodo_")
        : (state.modo_tempo_pais === "anual" ? "Pais_Anual_" : "Pais_Periodo_");
      const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");
      XLSX.writeFile(wb, `${prefix}${dataStr}.xlsx`);
    } else {
      // Fallback CSV
      const csvContent = "data:text/csv;charset=utf-8," +
        linhasExport.map(e => e.map(val => typeof val === "string" ? `"${val}"` : String(val).replace(".", ",")).join(";")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Retornos_${state.aba_ativa}.csv`);
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

  function vincularEventos() {
    // Toggle F7
    const chkF7 = document.getElementById("chk-f7");
    if (chkF7) {
      chkF7.addEventListener("change", (e) => {
        state.usar_f7 = e.target.checked;
        renderizar();
      });
    }

    // Abas de navegação (Por Grupo / Por País)
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.aba_ativa = btn.dataset.tab;

        // Alterna visibilidade dos painéis condicionais na sidebar
        document.getElementById("painel-grupo-sidebar").style.display = state.aba_ativa === "grupo" ? "block" : "none";
        document.getElementById("painel-pais-sidebar").style.display = state.aba_ativa === "pais" ? "block" : "none";

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
            // Atualiza select
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
  }

  function renderizar() {
    renderizarTabela();
  }

  // Auto-iniciar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
