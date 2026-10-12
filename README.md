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

### 3. Segmentação Estrutural de Países
- `USA`: Estados Unidos (polo emissor da moeda de reserva global);
- `AEs`: G7 ex-EUA (*Canadá, França, Alemanha, Itália, Japão, Reino Unido*);
- `AEs Periféricos`: Demais economias avançadas (*Austrália, Espanha, Holanda, Suíça, Coreia do Sul, etc.*);
- `Emerging Markets`: Economias emergentes (*Brasil, México, China, África do Sul, etc.*);
- `Frontier Markets`: Mercados de fronteira;
- `Other Developing`: Demais economias em desenvolvimento;
- `Outros`: Economias com regimes ou dados particulares.

---

## 🚀 Como Executar Localmente

### Opção 1: Abertura Direta (Sem servidor)
Basta abrir o arquivo `index.html` em qualquer navegador web moderno. O dashboard possui suporte nativo a execução offline via script embutido `data/dados.js`.

### Opção 2: Servidor Local
```bash
# Via Python (na pasta raiz do repositório)
python -m http.server 8080

# Acesse no navegador:
# http://127.0.0.1:8080
```

---

## 🌐 Publicação no GitHub Pages

Este repositório está pronto para ser publicado no GitHub Pages:

1. Faça o envio deste repositório para o GitHub (`git push origin main`);
2. No GitHub, navegue até **Settings** > **Pages**;
3. Em **Build and deployment**, selecione:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Salve. Em poucos instantes a aplicação estará no ar no endereço configurado.

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

