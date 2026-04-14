# Tarefa 05 — Exibição de preço com desconto PIX (configurável)

## Objetivo
Exibir o valor com desconto no PIX como incentivo (sem app), em:
- Card de produto
- PDP

Formato:
- `R$ [Valor com Desconto] no PIX (economia de X%)`

## Configuração (Horizon)
Em `config/settings_schema.json`:
- `settings.pix_discount_percent` (0–100)

Tradução usada:
- `content.pix_price_line` com placeholders `amount` e `percent`

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/pix-price-display.liquid`
- Converte % para fator, calcula desconto em centavos e arredonda:
  - `pix_cents = (price_cents * (100 - pct) + 50) / 100` (equivalente a round para centavos)
- Só renderiza se:
  - `pct > 0`
  - `pix_cents < price_cents`
  - variante existe e está disponível (ou `variant` não foi passado)
- Formata com `money` ou `money_with_currency` dependendo do contexto

Código completo:

```liquid
{%- liquid
  assign pct = settings.pix_discount_percent | default: 0 | plus: 0
  if pct > 100
    assign pct = 100
  endif

  assign render_ok = false
  assign pix_cents = 0

  if pct > 0 and price_cents != blank and price_cents > 0
    if variant == blank or variant.available
      assign factor = 100 | minus: pct
      assign raw_pix = price_cents | times: factor
      assign pix_cents = raw_pix | plus: 50 | divided_by: 100
      if pix_cents > 0 and pix_cents < price_cents
        assign render_ok = true
      endif
    endif
  endif
-%}

{%- if render_ok -%}
  {%- liquid
    if template.name == 'product'
      assign use_cc = settings.currency_code_enabled_product_pages
    else
      assign use_cc = settings.currency_code_enabled_product_cards
    endif

    if use_cc
      assign pix_money = pix_cents | money_with_currency
    else
      assign pix_money = pix_cents | money
    endif
  -%}

  <div
    ref="pixPriceDisplay"
    class="pix-price-display"
    data-pix-discount-percent="{{ pct }}"
  >
    <p class="pix-price-display__text">
      {{- 'content.pix_price_line' | t: amount: pix_money, percent: pct -}}
    </p>
  </div>
{%- endif -%}

{% stylesheet %}
  .pix-price-display {
    margin: 0;
    padding-block-start: 0.35em;
    font-size: min(0.85em, var(--font-paragraph--size, 1rem));
    font-weight: var(--font-paragraph--weight, 400);
    color: rgb(var(--color-foreground-rgb) / var(--opacity-subdued-text));
    line-height: 1.35;
  }

  .pix-price-display__text {
    margin: 0;
  }
{% endstylesheet %}
```

### 2) Integração em `snippets/price.liquid`
- Renderiza logo após o bloco de parcelas:

```liquid
{% if settings.pix_discount_percent > 0 and product_resource and hide_pix_price != true %}
  {% render 'pix-price-display',
    price_cents: installments_base_cents,
    variant: selected_variant
  %}
{% endif %}
```

### 3) Traduções
Exemplos:
- `pt-BR.json`: `content.pix_price_line`: `{{ amount }} no PIX (economia de {{ percent }}%)`
- `en.default.json`: `{{ amount }} with PIX (save {{ percent }}%)`

## Port para o Dawn
- Copiar o snippet `pix-price-display.liquid`
- Integrar no snippet do preço do Dawn (ex.: `snippets/price.liquid` do Dawn) próximo ao preço principal
- Adicionar setting `pix_discount_percent` em `config/settings_schema.json` do Dawn
- Adicionar traduções em `locales/*.json` do Dawn (`content.pix_price_line`)

