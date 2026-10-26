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

- **Gráficos Interativos Sincronizados (2000–2025)**:
  - **Gráfico Superior (Estoques)**: Curvas temporais dinâmicas comparando médias de grupos analíticos ou países individuais em US$ Bilhões ou % do PIB (Posição Líquida IIP, Ativos $A_P$, Passivos $L_P$ e Reservas Totais `TRGMV_REVS`).
  - **Gráfico Inferior (Diferenciais de Retorno)**: Curvas anuais dos diferenciais de retorno ($r^A - r^L$) para as mesmas entidades selecionadas, permitindo alternar entre Total (TR Dif), Rendimento (Yield Dif) e Ganho de Capital (KG Dif), integrado com o toggle F7.
- **Tabela Consolidada por Período**: Médias dos agregados externos para cada período customizado selecionado na barra lateral.

### 3. Liquidez Internacional

- **Facet Grid de Barras e Linhas**: Visualização em grade comparativa do percentual anual de países com perda de reservas cambiais ($\Delta R < 0$) e incidência de contrações severas ($>10\%$ no ano) para *Emerging Markets*, *Frontier Markets* e *Other Developing*.
- **Tabela de Ciclos de Liquidez**: Estatísticas consolidadas nos 7 regimes macroeconômicos globais (Crises Cambiais, Superciclo de Acumulação, Crise Subprime, QE, Fim do Boom, Pandemia e Aperto do Fed) ou por períodos customizados.

### 4. Classificação

- **Definições Operacionais**: Fórmulas e notas conceituais sobre taxas de retorno brutas, ganho de capital, toggle F7 e variações de liquidez.
- **Mapeamento dos Países por Grupo**: Relação nominal e transparente de todos os 191 países mapeados nas 6 categorias do sistema monetário internacional (FMI Table A4.1.2 - 2025), com busca dinâmica por nome ou código ISO-3.

### 5. Segmentação Estrutural de Países

- `USA`: Estados Unidos (polo hegemônico emissor da moeda de reserva global);
- `AEs (G7 exc-USA)`: G7 sem Estados Unidos (*Canadá, França, Alemanha, Itália, Japão, Reino Unido*);
- `AEs Centrais`: Economias avançadas maduras com moedas fortes e credoras líquidas (*Holanda, Suíça, Austrália, Suécia, Noruega, Dinamarca, Coreia do Sul, Cingapura, etc.*);
- `Periferia Europeia`: Leste Europeu (transição da UE) e Sul da Europa (*Rep. Tcheca, Eslováquia, Eslovênia, Bálticos, Croácia, Grécia, Portugal, Espanha*);
- `Centros Financeiros`: Enclaves offshore e centros de arbitragem fiscal / *Phantom FDI* (*Luxemburgo, Irlanda, Chipre, Malta, Hong Kong, etc.*);
- `Emerging Markets`: Economias emergentes (*Brasil, México, China, Índia, África do Sul, etc.*);
- `Frontier Markets`: Mercados de fronteira (*Argentina, Vietnã, Nigéria, etc.*);
- `Other Developing`: Demais economias em desenvolvimento;
- `Outros`: Economias com regimes ou dados atípicos / outliers.

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
