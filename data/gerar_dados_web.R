# =============================================================================
# Exportação dos dados consolidados para o dashboard web estático (dashboard_retornos/)
# Inclui: Retornos, Estoques/IIP, Liquidez Internacional e Mapeamento de Países
# =============================================================================

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(countrycode)
  library(jsonlite)
})

# 1. Carrega a base consolidada de retornos com e sem F7
dados_rds <- "App_Retornos/dados_app.rds"
if (!file.exists(dados_rds)) {
  stop("Arquivo App_Retornos/dados_app.rds não encontrado.")
}

d <- readRDS(dados_rds)

# Filtra apenas observações completas (mesmo critério do app Shiny)
d_limpo <- d %>%
  filter(
    !is.na(yield_A), !is.na(yield_L),
    !is.na(kg_A_semF7), !is.na(kg_L_semF7),
    !is.na(flag_IN1)
  ) %>%
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
    across(c(
      y_a, y_l, kg_a_sem, kg_l_sem, tr_a_sem, tr_l_sem,
      kg_a_com, kg_l_com, tr_a_com, tr_l_com
    ), ~ round(.x, 6))
  ) %>%
  arrange(ano, tipo, pais)

# 2. Carrega a base consolidada de estoques, IIP, PIB e Reservas
estoques_rds <- "scratch/estoques_consolidados.rds"
if (!file.exists(estoques_rds)) {
  stop("Arquivo scratch/estoques_consolidados.rds não encontrado.")
}

estoques_raw <- readRDS(estoques_rds) %>%
  left_join(distinct(d_limpo, iso, novo_tipo = tipo), by = "iso") %>%
  mutate(tipo = coalesce(novo_tipo, Tipo, "Outros")) %>%
  select(
    ano,
    iso,
    pais = País,
    tipo,
    a_p = a_p_bi,
    l_p = l_p_bi,
    iip = iip_bi,
    pib = pib_bi,
    res = res_bi,
    res_pib,
    ativo_pib,
    passivo_pib,
    iip_pib
  ) %>%
  arrange(ano, tipo, pais)

# 3. Base de Liquidez Internacional: Cálculo da Perda de Reservas e Ciclos Globais
il_path <- "C:/Users/William Barbosa/.gemini/antigravity-ide/brain/d0d71791-fac5-4a79-a181-7eaf1758aeeb/scratch/IL_all.rds"
if (!file.exists(il_path)) {
  stop("Arquivo IL_all.rds não encontrado.")
}
IL <- readRDS(il_path)

# Definição dos grupos estruturais (TABLE A4.1.2 - 2025 refinada estruturalmente)
USA <- tibble(País = "United States", Tipo = "USA")

AEs_g7 <- tibble(
  País = c("Canada", "France", "Germany", "Italy", "Japan", "United Kingdom"),
  Tipo = "AEs (G7 exc-USA)"
)

AEs_centrais <- tibble(
  País = c(
    "Australia", "Austria", "Belgium", "Denmark", "Finland", "Iceland", "Israel",
    "Korea", "Netherlands, The", "New Zealand", "Norway", "Singapore",
    "Sweden", "Switzerland"
  ),
  Tipo = "AEs Centrais"
)

Periferia_europeia <- tibble(
  País = c(
    "Croatia", "Czech Republic", "Estonia", "Greece", "Latvia", "Lithuania",
    "Portugal", "Slovak Republic", "Slovenia", "Spain"
  ),
  Tipo = "Periferia Europeia"
)

Centros_financeiros <- tibble(
  País = c(
    "Andorra", "Cyprus", "Hong Kong SAR", "Ireland", "Luxembourg",
    "Macao SAR", "Malta", "Puerto Rico", "San Marino"
  ),
  Tipo = "Centros Financeiros"
)

Frontier_markets <- tibble(
  País = c(
    "Mongolia", "Papua New Guinea", "Viet Nam", "Armenia", "Azerbaijan", "Georgia", "Kazakhstan",
    "Kyrgyz Republic", "Montenegro", "North Macedonia", "Serbia", "Tajikistan", "Ukraine", "Uzbekistan",
    "Argentina", "Bolivia", "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Honduras", "Jamaica",
    "Paraguay", "Suriname", "Iraq", "Jordan", "Lebanon", "Morocco", "Pakistan", "Tunisia",
    "West Bank and Gaza", "Bangladesh", "Maldives", "Sri Lanka", "Angola", "Benin", "Botswana",
    "Burkina Faso", "Cameroon", "Côte d'Ivoire", "Ethiopia", "Gabon", "Ghana", "Guinea-Bissau",
    "Kenya", "Mali", "Mauritius", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
    "Senegal", "Tanzania", "Togo", "Zambia"
  ),
  Tipo = "Frontier Markets"
)

Emerging_markets <- tibble(
  País = c(
    "China", "Indonesia", "Malaysia", "Nauru", "Palau", "Philippines", "Thailand", "Bulgaria", "Hungary", "Poland",
    "Romania", "Russian Federation", "Türkiye", "Antigua and Barbuda", "Bahamas, The", "Barbados", "Brazil", "Chile",
    "Colombia", "Costa Rica", "Guyana", "Mexico", "Panama", "Peru", "St. Kitts and Nevis", "Trinidad and Tobago",
    "Uruguay", "Bahrain", "Egypt, Arab Rep.", "Kuwait", "Oman", "Qatar", "Saudi Arabia", "United Arab Emirates",
    "India", "Seychelles", "South Africa"
  ),
  Tipo = "Emerging Markets"
)

Other_developing_economies <- tibble(
  País = c(
    "Cambodia", "Fiji", "Kiribati", "Lao PDR", "Marshall Islands", "Micronesia, Fed. Sts.", "Myanmar", "Samoa",
    "Solomon Islands", "Timor-Leste", "Tonga", "Tuvalu", "Vanuatu", "Albania", "Belarus", "Bosnia and Herzegovina",
    "Kosovo", "Moldova", "Belize", "Dominica", "Grenada", "Haiti", "Nicaragua", "St. Lucia",
    "St. Vincent and the Grenadines", "Afghanistan", "Algeria", "Djibouti", "Iran, Islamic Rep.", "Libya",
    "Syrian Arab Republic", "Yemen, Rep.", "Bhutan", "Nepal", "Burundi", "Cabo Verde", "Central African Republic", "Chad",
    "Comoros", "Congo, Dem. Rep.", "Congo, Rep.", "Equatorial Guinea", "Eritrea", "Eswatini", "Gambia, The", "Guinea",
    "Lesotho", "Liberia", "Madagascar", "Malawi", "Mauritania", "São Tomé and Principe", "Sierra Leone",
    "South Sudan", "Sudan", "Uganda", "Zimbabwe"
  ),
  Tipo = "Other Developing"
)

# Todos os países mapeados
todos_paises_grupos <- bind_rows(
  USA, AEs_g7, AEs_centrais, Periferia_europeia, Centros_financeiros,
  Emerging_markets, Frontier_markets, Other_developing_economies
) %>%
  mutate(
    iso = suppressWarnings(countrycode(País, origin = "country.name", destination = "iso3c", custom_match = c("Kosovo" = "XKX"))),
    # Sincroniza os países que foram reclassificados em Outros no tratamento de dados
    Tipo = if_else(iso %in% c(
      "MUS", "AGO", "CIV", "ZMB", "GIN", "LBR",
      "FSM", "MDG", "MWI", "TLS"
    ), "Outros", Tipo)
  ) %>%
  distinct()

# Base de reservas e variação
paises_periferia <- bind_rows(Frontier_markets, Emerging_markets, Other_developing_economies) %>%
  mutate(iso3c = suppressWarnings(countrycode(País, origin = "country.name", destination = "iso3c", custom_match = c("Kosovo" = "XKX"))))

df_res <- IL %>%
  select(iso3c = COUNTRY, year = TIME_PERIOD, reserves = OBS_VALUE) %>%
  mutate(
    year = as.integer(year),
    reserves = as.numeric(reserves)
  ) %>%
  inner_join(paises_periferia, by = "iso3c") %>%
  arrange(iso3c, year) %>%
  group_by(iso3c) %>%
  mutate(
    lag_res = lag(reserves),
    var_pct = (reserves - lag_res) / lag_res * 100,
    gasta_reserva = var_pct < 0,
    queda_severa = var_pct <= -10
  ) %>%
  ungroup()

df_res <- df_res %>%
  mutate(
    ciclo_liquidez = case_when(
      year <= 2002 ~ "1995-2002: Crises Cambiais Emergentes",
      year <= 2007 ~ "2003-2007: Superciclo de Acumulação",
      year <= 2009 ~ "2008-2009: Crise Financeira Global",
      year <= 2013 ~ "2010-2013: QE e Recomposição",
      year <= 2019 ~ "2014-2019: Fim do Boom & Dólar Forte",
      year <= 2021 ~ "2020-2021: Pandemia & Injeção SDR",
      TRUE ~ "2022-2024: Aperto do Fed & Choque de Juros"
    )
  )

# 3.1. Dados para o Facet Grid anual (2000-2024)
facet_grupos <- df_res %>%
  filter(!is.na(var_pct), !is.na(Tipo), year >= 2000, year <= 2024) %>%
  group_by(tipo = Tipo, ano = year) %>%
  summarise(
    n_paises = n(),
    pct_queimando = round(mean(gasta_reserva) * 100, 1),
    pct_severo = round(mean(queda_severa) * 100, 1),
    mediana_var = round(median(var_pct), 1),
    .groups = "drop"
  )

facet_total_periferia <- df_res %>%
  filter(!is.na(var_pct), year >= 2000, year <= 2024) %>%
  group_by(ano = year) %>%
  summarise(
    tipo = "Periferia Consolidada",
    n_paises = n(),
    pct_queimando = round(mean(gasta_reserva) * 100, 1),
    pct_severo = round(mean(queda_severa) * 100, 1),
    mediana_var = round(median(var_pct), 1),
    .groups = "drop"
  )

liquidez_facet <- bind_rows(facet_grupos, facet_total_periferia) %>%
  arrange(tipo, ano)

# 3.2. Tabela de Ciclos Globais (tabela_ciclos) - Médias anuais sincronizadas
medias_anuais_grupo <- df_res %>%
  filter(!is.na(var_pct), !is.na(Tipo)) %>%
  group_by(ciclo_liquidez, tipo = Tipo, year) %>%
  summarise(
    media_ano = mean(var_pct, na.rm = TRUE),
    pct_queima_ano = mean(gasta_reserva, na.rm = TRUE) * 100,
    pct_severo_ano = mean(queda_severa, na.rm = TRUE) * 100,
    n_ano = n(),
    .groups = "drop"
  )

tabela_ciclos <- medias_anuais_grupo %>%
  group_by(ciclo_liquidez, tipo) %>%
  summarise(
    n_obs = sum(n_ano),
    pct_queimando = round(mean(pct_queima_ano), 1),
    pct_severo = round(mean(pct_severo_ano), 1),
    crescimento_medio = round(mean(media_ano), 1),
    crescimento_mediano = round(mean(media_ano), 1), # mantido para retrocompatibilidade
    .groups = "drop"
  ) %>%
  arrange(ciclo_liquidez, tipo)

# 3.3. Base de variações individuais de reservas por país e ano (para cálculo customizado)
liquidez_obs <- df_res %>%
  filter(!is.na(var_pct), year >= 2000) %>%
  select(
    iso = iso3c,
    pais = País,
    tipo = Tipo,
    ano = year,
    res = reserves,
    var_pct = var_pct,
    gasta = gasta_reserva,
    severo = queda_severa
  ) %>%
  mutate(
    res_bi = round(res / 1e9, 2),
    var_pct = round(var_pct, 2)
  )

# 3.4. Base de Componentes da IIP (Ativos e Passivos em 100% empilhado e valores em US$ bi)
comp_raw_path <- "scratch/iip_componentes_raw.rds"
if (file.exists(comp_raw_path)) {
  raw_comp <- readRDS(comp_raw_path)
  
  # Ativos
  a_totais <- raw_comp %>% filter(entry == "A_P", INDICATOR == "TA_AFR") %>% select(iso, ano, total_a = valor)
  a_comp <- raw_comp %>%
    filter(entry == "A_P", INDICATOR %in% c("D", "P_MV", "F_F7_T", "O", "R")) %>%
    pivot_wider(id_cols = c(iso, ano), names_from = INDICATOR, values_from = valor, values_fill = 0) %>%
    left_join(a_totais, by = c("iso", "ano")) %>%
    mutate(
      soma_a = coalesce(D, 0) + coalesce(P_MV, 0) + coalesce(F_F7_T, 0) + coalesce(O, 0) + coalesce(R, 0),
      total_a = if_else(is.na(total_a) | total_a <= 0, soma_a, total_a)
    ) %>%
    filter(total_a > 0) %>%
    mutate(
      a_fdi = round(pmax(0, D) / soma_a * 100, 2),
      a_port = round(pmax(0, P_MV) / soma_a * 100, 2),
      a_f7 = round(pmax(0, F_F7_T) / soma_a * 100, 2),
      a_oth = round(pmax(0, O) / soma_a * 100, 2),
      a_res = round(pmax(0, R) / soma_a * 100, 2),
      total_a_bi = round(total_a / 1e9, 2)
    ) %>%
    select(iso, ano, total_a_bi, a_fdi, a_port, a_f7, a_oth, a_res)

  # Passivos
  l_totais <- raw_comp %>% filter(entry == "L_P", INDICATOR == "TL_AFR") %>% select(iso, ano, total_l = valor)
  l_comp <- raw_comp %>%
    filter(entry == "L_P", INDICATOR %in% c("D", "P_MV", "F_F7_T", "O")) %>%
    pivot_wider(id_cols = c(iso, ano), names_from = INDICATOR, values_from = valor, values_fill = 0) %>%
    left_join(l_totais, by = c("iso", "ano")) %>%
    mutate(
      soma_l = coalesce(D, 0) + coalesce(P_MV, 0) + coalesce(F_F7_T, 0) + coalesce(O, 0),
      total_l = if_else(is.na(total_l) | total_l <= 0, soma_l, total_l)
    ) %>%
    filter(total_l > 0) %>%
    mutate(
      l_fdi = round(pmax(0, D) / soma_l * 100, 2),
      l_port = round(pmax(0, P_MV) / soma_l * 100, 2),
      l_f7 = round(pmax(0, F_F7_T) / soma_l * 100, 2),
      l_oth = round(pmax(0, O) / soma_l * 100, 2),
      total_l_bi = round(total_l / 1e9, 2)
    ) %>%
    select(iso, ano, total_l_bi, l_fdi, l_port, l_f7, l_oth)

  # Mapeia tipo/grupo
  mapa_tipo <- d_limpo %>% distinct(iso, tipo)
  
  iip_componentes <- full_join(a_comp, l_comp, by = c("iso", "ano")) %>%
    left_join(mapa_tipo, by = "iso") %>%
    mutate(tipo = coalesce(tipo, "Outros")) %>%
    arrange(ano, tipo, iso)
} else {
  iip_componentes <- tibble()
}

# 4. Metadados de países e grupos
ORDEM_GRUPOS <- c(
  "USA", "AEs (G7 exc-USA)", "AEs Centrais", "Periferia Europeia",
  "Centros Financeiros", "Emerging Markets", "Frontier Markets",
  "Other Developing", "Outros"
)

paises_meta <- d_limpo %>%
  distinct(iso, pais, tipo) %>%
  arrange(pais)

grupos_meta <- lapply(split(paises_meta$iso, paises_meta$tipo), as.character)

# Mapeamento completo para a aba Classificação
classificacao_lista <- todos_paises_grupos %>%
  arrange(Tipo, País) %>%
  select(pais = País, tipo = Tipo, iso)

# Objeto final consolidado
export_obj <- list(
  grupos_ordem = ORDEM_GRUPOS,
  paises = paises_meta,
  grupos_paises = lapply(grupos_meta, I),
  anos = sort(unique(d_limpo$ano)),
  obs = d_limpo,
  estoques = estoques_raw,
  iip_componentes = iip_componentes,
  liquidez_facet = liquidez_facet,
  tabela_ciclos = tabela_ciclos,
  liquidez_obs = liquidez_obs,
  classificacao_paises = classificacao_lista
)

dir_saida <- "dashboard_retornos/data"
if (!dir.exists(dir_saida)) {
  dir.create(dir_saida, recursive = TRUE)
}

# 1. Exporta dados.json
json_path <- file.path(dir_saida, "dados.json")
write_json(export_obj, json_path, dataframe = "rows", auto_unbox = TRUE)

# 2. Exporta dados.js (para fallback offline sem bloqueio de CORS)
js_path <- file.path(dir_saida, "dados.js")
json_txt <- toJSON(export_obj, dataframe = "rows", auto_unbox = TRUE)
writeLines(paste0("window.DADOS_APP = ", json_txt, ";"), js_path, useBytes = TRUE)

cat("Dados consolidados exportados com sucesso para dashboard_retornos/data/:\n")
cat(" - dados.json: ", round(file.size(json_path) / 1024, 1), "KB\n")
cat(" - dados.js:   ", round(file.size(js_path) / 1024, 1), "KB\n")
cat("Total obs retornos:     ", nrow(d_limpo), "\n")
cat("Total obs estoques:     ", nrow(estoques_raw), "\n")
cat("Total obs facet liquidez:", nrow(liquidez_facet), "\n")
cat("Total linhas ciclos:    ", nrow(tabela_ciclos), "\n")
cat("Total países mapeados:  ", nrow(classificacao_lista), "\n")
