# Tarefa 10 — Badge de promoção com porcentagem (% OFF) no Card e na PDP

## Objetivo
Substituir a badge nativa de promoção (“Promoção/Sale”) por uma badge dinâmica:
- `"[X]% OFF"`
- só quando `compare_at_price > price`
- percentual:
  \[
  \%OFF = round(((compare\_at - price) * 100) / compare\_at)
  \]
- não exibir `0% OFF`
- no card, manter estilo/posição do tema
- na PDP, acompanhar variante selecionada

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/product-discount-badge.liquid` (reutilizável)
Responsável por:
- calcular `pct` em Liquid com proteção contra divisão inválida
- renderizar markup “premium” (número grande + `%` + `OFF`) com acessibilidade
- fallback para texto nativo (`content.product_badge_sale`) quando não há `pct`

**Cálculo (round sem float)**: usa \((diff + cap/2) / cap\) com preços em centavos.

Código (completo):

```liquid
{% liquid
  assign v = variant | default: product.selected_or_first_available_variant
  assign cap = v.compare_at_price
  assign pr = v.price
  assign pct = blank

  if cap != blank and pr != blank and cap > 0 and cap > pr
    assign diff = cap | minus: pr | times: 100
    assign half_cap = cap | divided_by: 2
    assign numerator = diff | plus: half_cap
    assign pct = numerator | divided_by: cap
    if pct <= 0
      assign pct = blank
    endif
  endif

  assign product_level_sale = false
  if product.compare_at_price > product.price
    assign product_level_sale = true
  endif
%}

{% if badge_strip %}
  {% if pct != blank %}
    <div
      class="product-badges product-badges--{{ settings.badge_position }} media-gallery__product-badges"
      style="
        --badge-border-radius: {{ settings.badge_corner_radius }}px;
        --badge-font-family: var(--font-{{ settings.badge_font_family }}--family); --badge-font-weight: var(--font-{{ settings.badge_font_family }}--weight); --badge-text-transform: {{ settings.badge_text_transform }};
      "
    >
      <div class="product-badges__badge product-badges__badge--rectangle color-{{ sale_color_scheme }}">
        <product-discount-badge
          class="product-discount-badge"
          style="display: contents"
          data-context="pdp"
          data-product-level-sale="{% if product_level_sale %}true{% else %}false{% endif %}"
        >
          <span class="visually-hidden" data-product-discount-sr>
            {{- 'content.product_badge_percent_off' | t: percent: pct, value: pct -}}
          </span>
          <span class="product-discount-badge__visual" aria-hidden="true">
            <span class="product-discount-badge__value" data-product-discount-value>{{ pct }}</span>
            <span class="product-discount-badge__sign">%</span>
            <span class="product-discount-badge__off">{{ 'content.product_badge_off_word' | t }}</span>
          </span>
          <span class="product-discount-badge__fallback" data-product-discount-fallback hidden></span>
        </product-discount-badge>
      </div>
    </div>
  {% endif %}
{% else %}
  {% if pct != blank %}
    <product-discount-badge
      class="product-discount-badge"
      style="display: contents"
      data-context="{{ context | default: 'card' }}"
      data-product-level-sale="{% if product_level_sale %}true{% else %}false{% endif %}"
    >
      <span class="visually-hidden" data-product-discount-sr>
        {{- 'content.product_badge_percent_off' | t: percent: pct, value: pct -}}
      </span>
      <span class="product-discount-badge__visual" aria-hidden="true">
        <span class="product-discount-badge__value" data-product-discount-value>{{ pct }}</span>
        <span class="product-discount-badge__sign">%</span>
        <span class="product-discount-badge__off">{{ 'content.product_badge_off_word' | t }}</span>
      </span>
      <span class="product-discount-badge__fallback" data-product-discount-fallback hidden></span>
    </product-discount-badge>
  {% else %}
    {{- 'content.product_badge_sale' | t -}}
  {% endif %}
{% endif %}

{% stylesheet %}
  .product-badges__badge:has(.product-discount-badge__visual),
  .media-gallery__product-badges .product-badges__badge:has(.product-discount-badge__visual) {
    position: relative;
    isolation: isolate;
    padding-block: max(var(--badge-rectangle-padding-block, 0.2rem), 0.32rem);
    padding-inline: max(var(--badge-rectangle-padding-inline, 0.45rem), 0.55rem);
    min-height: 1.75rem;
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--color-foreground) 14%, transparent),
      0 0.35rem 0.85rem color-mix(in srgb, var(--color-foreground) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 12%, transparent);
    backdrop-filter: saturate(1.05);
  }

  .product-discount-badge__visual {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums lining-nums;
  }

  .product-discount-badge__value {
    font-size: 1.18em;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .product-discount-badge__sign {
    font-size: 0.72em;
    font-weight: 700;
    line-height: 1;
    opacity: 0.9;
    transform: translateY(-0.14em);
    margin-inline-start: -0.02em;
  }

  .product-discount-badge__off {
    font-size: 0.58em;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.12em;
    margin-inline-start: 0.18em;
    opacity: 0.82;
    text-transform: uppercase;
  }

  @media screen and (max-width: 749px) {
    .product-discount-badge__value {
      font-size: 1.12em;
    }
  }
{% endstylesheet %}
```

### 2) `assets/product-discount-badge.js`
Necessário para **cards com troca de variante por swatches**.

Motivo: no Horizon, o evento `variant:update` dentro do `product-card` faz `stopPropagation`, então o listener precisa ser `capture: true` no próprio `product-card`.

Código completo:

```js
const VARIANT_UPDATE = 'variant:update';

function percentOff(compareAt, price) {
  const cap = Number(compareAt);
  const pr = Number(price);
  if (!Number.isFinite(cap) || !Number.isFinite(pr) || cap <= 0 || cap <= pr) return null;
  const pct = Math.round(((cap - pr) * 100) / cap);
  return pct > 0 ? pct : null;
}

class ProductDiscountBadge extends HTMLElement {
  #abort;

  connectedCallback() {
    this.#abort?.abort();
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    const card = this.closest('product-card');
    if (card) {
      card.addEventListener(VARIANT_UPDATE, this.#onVariantUpdate, { capture: true, signal });
    }
  }

  disconnectedCallback() {
    this.#abort?.abort();
  }

  #showPercentMode(pct, srTemplate) {
    const sr = this.querySelector('[data-product-discount-sr]');
    const valueEl = this.querySelector('[data-product-discount-value]');
    const visual = this.querySelector('.product-discount-badge__visual');
    const fallback = this.querySelector('[data-product-discount-fallback]');

    const s = String(pct);
    if (valueEl) valueEl.textContent = s;
    if (sr) sr.textContent = srTemplate.replace('__NUM__', s);
    visual?.removeAttribute('hidden');
    fallback?.setAttribute('hidden', '');
    if (fallback) fallback.textContent = '';
  }

  #showSaleFallbackMode(label) {
    const sr = this.querySelector('[data-product-discount-sr]');
    const visual = this.querySelector('.product-discount-badge__visual');
    const fallback = this.querySelector('[data-product-discount-fallback]');

    if (sr) sr.textContent = label;
    visual?.setAttribute('hidden', '');
    if (fallback) {
      fallback.textContent = label;
      fallback.removeAttribute('hidden');
    }
  }

  #clearModes() {
    const visual = this.querySelector('.product-discount-badge__visual');
    const fallback = this.querySelector('[data-product-discount-fallback]');
    const sr = this.querySelector('[data-product-discount-sr]');
    visual?.setAttribute('hidden', '');
    fallback?.setAttribute('hidden', '');
    if (fallback) fallback.textContent = '';
    if (sr) sr.textContent = '';
  }

  #onVariantUpdate = (event) => {
    const detail = event.detail;
    const resource = detail?.resource;
    if (!resource) return;

    const pct = percentOff(resource.compare_at_price, resource.price);
    const tpl = window.Theme?.translations?.product_badge_percent_off_js;
    const saleFallback = window.Theme?.translations?.product_badge_sale_fallback;
    const productLevelSale = this.dataset.productLevelSale === 'true';

    if (pct != null && typeof tpl === 'string' && tpl.length) {
      this.#showPercentMode(pct, tpl);
      return;
    }

    if (productLevelSale && typeof saleFallback === 'string') {
      this.#showSaleFallbackMode(saleFallback);
      return;
    }

    this.#clearModes();
  };
}

if (!customElements.get('product-discount-badge')) {
  customElements.define('product-discount-badge', ProductDiscountBadge);
}
```

### 3) Integração no card: `blocks/_product-card-gallery.liquid`
Substitui a badge “Sale” por:

```liquid
{% render 'product-discount-badge',
  product: product,
  variant: product.selected_or_first_available_variant,
  context: 'card',
  sale_color_scheme: settings.badge_sale_color_scheme,
  badge_strip: false
%}
```

### 4) Integração na PDP: `snippets/product-media-gallery-content.liquid`
Insere o badge strip dentro de `<media-gallery>`:

```liquid
{% if closest.product != blank %}
  {% render 'product-discount-badge',
    product: closest.product,
    variant: closest.product.selected_or_first_available_variant,
    context: 'pdp',
    sale_color_scheme: settings.badge_sale_color_scheme,
    badge_strip: true
  %}
{% endif %}
```

E adiciona CSS para posicionamento do strip (PDP).

### 5) Carregamento do JS: `snippets/scripts.liquid`

```liquid
<script src="{{ 'product-discount-badge.js' | asset_url }}" type="module" fetchpriority="low"></script>
```

Também adiciona templates em `Theme.translations` para o JS:

```liquid
product_badge_percent_off_js: {{ 'content.product_badge_percent_off' | t: percent: '__NUM__', value: '__NUM__' | json }},
product_badge_sale_fallback: {{ 'content.product_badge_sale' | t | json }},
```

### 6) Traduções
Adicionar em `locales/*.json`:
- `content.product_badge_percent_off`: `{{ percent }}% OFF`
- `content.product_badge_off_word`: `OFF`

## Port para o Dawn
- Dawn tem card e PDP bem diferentes. A estratégia recomendada é manter:
  - **Liquid** para render inicial (card + PDP)
  - **JS** apenas para atualizar em troca de variante na PDP/card quando a UI troca sem reload
- No Dawn, a troca de variante geralmente atualiza preço/HTML via `fetch` de seção:
  - você pode recalcular em JS com `variant.price` e `variant.compare_at_price` (JSON do produto)
  - ou renderizar novamente o snippet via section rendering.

