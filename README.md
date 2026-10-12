# Retornos Externos: Dashboard Interativo (2000–2025)

Aplicação web estática e interativa para exploração, visualização e replicação de **taxas de retorno externas brutas, diferenciais de retorno e posições de investimento internacional (IIP / Estoques)** de economias mundiais, com base nas estatísticas oficiais do Fundo Monetário Internacional (BOP, IIP, International Liquidity) e Banco Mundial (WDI).

---

## 📌 Módulos e Funcionalidades

### 1. Retornos e Diferenciais

- **Visão por Grupo e por Período**: Análise da hierarquia monetária e financeira internacional com agregação por períodos customizados (anuais, ciclos de liquidez, triênios, etc.).
- **Visão por País**: Evolução temporal de taxas de retorno e diferenciais para países individuais ou comparações multilaterais (ano a ano ou por períodos customizados).
- **Toggle F7 (Derivativos Financeiros)**: Alternância instantânea entre a série padronizada (sem derivativos) e a série com derivativos financeiros contabilizados nos fluxos e ganhos de capital.
- **Tabela no padrão GT**: Cabeçalho fixo (*sticky header*), diferenciais destacados com destaque visual e formatação numérica rigorosa.
- **Exportação para Excel**: Download direto da tabela exibida em formato `.xlsx`.

### 2. Estoques e IIP (Posição de Investimento Internacional)

- **Gráficos Interativos de Séries Históricas (2000–2025)**: Curvas temporais dinâmicas via Chart.js comparando médias de grupos analíticos ou países individuais.
- **Métricas Disponíveis**:
  - Posição Internacional de Investimento Líquida ($A_P - L_P$);
  - Ativos Externos Totais ($A_P$);
  - Passivos Externos Totais ($L_P$);
  - Reservas Internacionais Totais (FMI IL `TRGMV_REVS`);
  - Reservas Internacionais / PIB (%).
- **Unidades Alternáveis**: Valores em US$ Bilhões ou como proporção do PIB nominal (% do PIB).
- **Tabela Consolidada por Período**: Médias dos agregados externos para cada período customizado selecionado na barra lateral.

### 3. Liquidez Internacional

- **Facet Grid de Barras e Linhas**: Visualização em grade comparativa do percentual anual de países com perda de reservas cambiais ($\Delta R < 0$) e incidência de contrações severas ($>10\%$ no ano) para *Emerging Markets*, *Frontier Markets* e *Other Developing*.
- **Tabela de Ciclos de Liquidez**: Estatísticas consolidadas nos 7 regimes macroeconômicos globais (Crises Cambiais, Superciclo de Acumulação, Crise Subprime, QE, Fim do Boom, Pandemia e Aperto do Fed) ou por períodos customizados.

### 4. Classificação

- **Definições Operacionais**: Fórmulas e notas conceituais sobre taxas de retorno brutas, ganho de capital, toggle F7 e variações de liquidez.
- **Mapeamento dos Países por Grupo**: Relação nominal e transparente de todos os 191 países mapeados nas 6 categorias do sistema monetário internacional (FMI Table A4.1.2 - 2025), com busca dinâmica por nome ou código ISO-3.

### 5. Segmentação Estrutural de Países

- `USA`: Estados Unidos (polo emissor da moeda de reserva global);
- `AEs`: G7 ex-EUA (*Canadá, França, Alemanha, Itália, Japão, Reino Unido*);
- `AEs Periféricos`: Demais economias avançadas (*Austrália, Espanha, Holanda, Suíça, Coreia do Sul, etc.*);
- `Emerging Markets`: Economias emergentes (*Brasil, México, China, África do Sul, etc.*);
- `Frontier Markets`: Mercados de fronteira;
- `Other Developing`: Demais economias em desenvolvimento;
- `Outros`: Economias com regimes ou dados particulares.

---

## 📂 Estrutura de Arquivos

```
.
├── index.html        # Estrutura HTML, navegação por abas e containers
├── style.css         # Folha de estilos, layout responsivo e tabelas GT
├── app.js            # Lógica computacional, filtros, ordenação e gráficos Chart.js
├── data/
│   ├── dados.json    # Base consolidada (retornos + estoques/IIP) em JSON
│   ├── dados.js      # Base consolidada em JS para suporte a carregamento local direto
│   └── gerar_dados_web.R # Script em R que processa as bases brutas e gera os arquivos web
└── README.md         # Documentação da aplicação
```
