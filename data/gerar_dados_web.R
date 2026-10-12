# =============================================================================
# Exportação dos dados consolidados para o dashboard web estático (docs/)
# =============================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(jsonlite)
})

# Carrega a base consolidada com e sem F7
dados_rds <- "App_Retornos/dados_app.rds"
if (!file.exists(dados_rds)) {
  stop("Arquivo App_Retornos/dados_app.rds não encontrado.")
}

d <- readRDS(dados_rds)

# Filtra apenas observações completas (mesmo critério de na.omit e flag_IN1 do app Shiny)
d_limpo <- d %>%
  filter(!is.na(yield_A), !is.na(yield_L),
         !is.na(kg_A_semF7), !is.na(kg_L_semF7),
         !is.na(flag_IN1)) %>%
  select(
    ano = TIME_PERIOD,
    iso = COUNTRY,
    pais = País,
    tipo = Tipo,
    y_a = yield_A,
    y_l = yield_L,
    kg_a_sem = kg_A_semF7,
    kg_l_sem = kg_L_semF7,
    tr_a_sem = TR_A_semF7,
    tr_l_sem = TR_L_semF7,
    kg_a_com = kg_A_comF7,
    kg_l_com = kg_L_comF7,
    tr_a_com = TR_A_comF7,
    tr_l_com = TR_L_comF7
  ) %>%
  mutate(
    # Arredonda para 6 casas decimais para manter extrema precisão e reduzir tamanho
    across(c(y_a, y_l, kg_a_sem, kg_l_sem, tr_a_sem, tr_l_sem,
             kg_a_com, kg_l_com, tr_a_com, tr_l_com), ~ round(.x, 6))
  ) %>%
  arrange(ano, tipo, pais)

# Metadados de países e grupos
ORDEM_GRUPOS <- c("USA", "AEs", "AEs Periféricos", "Emerging Markets", "Frontier Markets", "Other Developing", "Outros")

paises_meta <- d_limpo %>%
  distinct(iso, pais, tipo) %>%
  arrange(pais)

grupos_meta <- lapply(split(paises_meta$iso, paises_meta$tipo), as.character)

# Objeto final consolidado (mantendo vetores como arrays com I())
export_obj <- list(
  grupos_ordem = ORDEM_GRUPOS,
  paises = paises_meta,
  grupos_paises = lapply(grupos_meta, I),
  anos = sort(unique(d_limpo$ano)),
  obs = d_limpo
)

# Cria o diretório de destino
dir_saida <- "docs/data"
if (!dir.exists(dir_saida)) {
  dir.create(dir_saida, recursive = TRUE)
}

# 1. Exporta dados.json
json_path <- file.path(dir_saida, "dados.json")
write_json(export_obj, json_path, dataframe = "rows", auto_unbox = TRUE)

# 2. Exporta dados.js (para fallback offline sem bloqueio de CORS ao abrir via file:///)
js_path <- file.path(dir_saida, "dados.js")
json_txt <- toJSON(export_obj, dataframe = "rows", auto_unbox = TRUE)
writeLines(paste0("window.DADOS_APP = ", json_txt, ";"), js_path, useBytes = TRUE)

cat("Dados exportados com sucesso para docs/data/:\n")
cat(" - dados.json:", round(file.size(json_path) / 1024, 1), "KB\n")
cat(" - dados.js:  ", round(file.size(js_path) / 1024, 1), "KB\n")
cat("Total de observações país-ano:", nrow(d_limpo), "\n")
cat("Total de países:", nrow(paises_meta), "\n")
