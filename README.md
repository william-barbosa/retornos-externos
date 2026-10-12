# Retornos Externos: Dashboard Interativo (2000–2025)

Aplicação web estática para exploração, visualização e replicação de **taxas de retorno externas brutas e diferenciais de retorno** sobre os ativos e passivos externos de economias mundiais, com base nas estatísticas do Fundo Monetário Internacional (BOP e IIP).

---

## 📌 Funcionalidades

- **Visão por Grupo e por Período**: Análise da hierarquia centro-periferia com agregação por períodos históricos, quinquênios, triênios ou ciclos de liquidez.
- **Visão por País**: Evolução temporal de taxas de retorno e diferenciais para países individuais ou comparações multilaterais (ano a ano ou por períodos).
- **Segmentação Estrutural de Países**:
  - `USA`: Estados Unidos (polo emissor da moeda de reserva global);
  - `AEs`: G7 ex-EUA (*Canadá, França, Alemanha, Itália, Japão, Reino Unido*);
  - `AEs Periféricos`: Demais economias avançadas (*Austrália, Espanha, Holanda, Suíça, Coreia do Sul, etc.*);
  - `Emerging Markets`: Economias emergentes (*Brasil, México, China, África do Sul, etc.*);
  - `Frontier Markets`: Mercados de fronteira;
  - `Other Developing`: Demais economias em desenvolvimento;
  - `Outros`: Economias com regimes ou dados particulares.
- **Toggle F7 (Derivativos Financeiros)**: Alternância instantânea entre a série padronizada (sem derivativos) e a série com derivativos financeiros contabilizados nos fluxos e ganhos de capital.
- **Tabela GT com Sticky Header**: Navegação fluida com cabeçalho fixo, diferenciais destacados em vermelho e valores tabulares formatados.
- **Exportação para Excel**: Download direto de planilhas `.xlsx` da tabela ativa.

---

## 🚀 Como Executar Localmente

### Opção 1: Abertura Direta (Sem servidor)
Basta abrir o arquivo `index.html` em qualquer navegador web moderno. O dashboard possui suporte nativo a execução offline via `data/dados.js`.

### Opção 2: Servidor Local Simples
```bash
# Python
python -m http.server 8080

# Navegue até http://127.0.0.1:8080
```

---

## 🌐 Publicação no GitHub Pages

Este repositório está pronto para ser publicado no GitHub Pages:

1. Suba este repositório para o seu GitHub;
2. Vá em **Settings** > **Pages**;
3. Em **Build and deployment**, selecione:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Salve. O site estará disponível em `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

---

## 📂 Estrutura de Arquivos

```
.
├── index.html        # Página principal e estrutura da aplicação
├── style.css         # Folha de estilos e regras visuais
├── app.js            # Lógica computacional, filtros e renderização
├── data/
│   ├── dados.json    # Dados consolidados em formato JSON (online)
│   ├── dados.js      # Dados consolidados em formato JS (fallback offline)
│   └── gerar_dados_web.R # Script de extração e exportação a partir dos dados do FMI
└── README.md
```
