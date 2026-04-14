# Tarefa 03 — Exibição de parcelamento (regras configuráveis)

## Objetivo
Exibir parcelamento informativo com regras do tema:
- Máx. parcelas (ex.: 12x)
- Mínimo por parcela (ex.: R$ 5,00 / 50)
- Exibir em: **card**, **PDP**, **total do carrinho**
- Cálculo respeitando \(n \le max\) e \(valor\_parcela \ge mínimo\)

## Configurações (Horizon)
Em `config/settings_schema.json`:
- `show_merchant_installments` (liga/desliga)
- `installments_max`
- `installments_min_per_payment` (valor em moeda major, convertido para centavos)
- `installments_show_disclaimer`

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/installments-display.liquid`
- Calcula o número de parcelas possível:
  - `n_by_min = floor(price_cents / min_cents)`
  - `n = min(installments_max, n_by_min)`
  - se `n < 2` não renderiza
- Calcula o valor por parcela usando “ceil em Liquid”:
  - `per_cents = (price_cents + n - 1) / n`
- Renderização:
  - Produto/card: `<div class="installments-display...">`
  - Carrinho: `<installments-display-dynamic ...data-*>` (atualiza via JS)

Código completo:

```liquid
{%- liquid
  assign show_feature = settings.show_merchant_installments
  assign max_p = settings.installments_max | default: 12 | plus: 0
  assign min_major = settings.installments_min_per_payment | default: 0 | plus: 0
  assign min_cents = min_major | times: 100

  assign render_ok = false
  assign n = 0
  assign per_cents = 0

  if show_feature and price_cents != blank and price_cents > 0 and max_p >= 2 and min_cents > 0
    if variant == blank or variant.available
      assign n_by_min = price_cents | divided_by: min_cents
      if n_by_min < 1
        assign n_by_min = 1
      endif
      assign n = max_p
      if n_by_min < n
        assign n = n_by_min
      endif
      if n >= 2
        assign per_cents = price_cents | plus: n | minus: 1 | divided_by: n
        assign render_ok = true
      endif
    endif
  endif
-%}

{%- if render_ok -%}
  {%- liquid
    if context == 'cart'
      assign use_cc = settings.currency_code_enabled_cart_total
    elsif template.name == 'product'
      assign use_cc = settings.currency_code_enabled_product_pages
    else
      assign use_cc = settings.currency_code_enabled_product_cards
    endif

    if use_cc
      assign per_money = per_cents | money_with_currency
    else
      assign per_money = per_cents | money
    endif

    assign display_text = 'content.installments_display_text' | t: count: n, amount: per_money
  -%}

  {% if context == 'cart' %}
    <installments-display-dynamic
      class="installments-display installments-display--cart cart-totals__installments-custom"
      data-price-cents="{{ price_cents }}"
      data-max-installments="{{ max_p }}"
      data-min-cents-per-payment="{{ min_cents }}"
      data-use-currency="{{ use_cc }}"
      data-money-format="{% if use_cc %}{{ shop.money_with_currency_format | escape }}{% else %}{{ shop.money_format | escape }}{% endif %}"
      data-currency="{{ cart.currency.iso_code | escape }}"
      data-template-js="{{ 'content.installments_display_template_js' | t | escape }}"
    >
      <p class="installments-display__text cart-primary-typography">{{ display_text }}</p>
    </installments-display-dynamic>
  {% else %}
    <div
      ref="installmentsDisplay"
      class="installments-display installments-display--product"
    >
      <p class="installments-display__text">{{ display_text }}</p>
      {% if settings.installments_show_disclaimer %}
        <p class="installments-display__note">{{ 'content.installments_display_disclaimer' | t }}</p>
      {% endif %}
    </div>
  {% endif %}
{%- endif -%}

{% stylesheet %}
  .installments-display {
    margin: 0;
    padding-block-start: 0.35em;
    font-size: min(0.85em, var(--font-paragraph--size, 1rem));
    font-weight: var(--font-paragraph--weight, 400);
    color: rgb(var(--color-foreground-rgb) / var(--opacity-subdued-text));
    line-height: 1.35;
  }

  .installments-display__text {
    margin: 0;
  }

  .installments-display__note {
    margin: 0.35em 0 0;
    font-size: 0.92em;
    opacity: 0.9;
  }

  .cart-totals .cart-totals__installments-custom {
    width: 100%;
  }
{% endstylesheet %}
```

### 2) `assets/installments-display.js`
- Para o **carrinho**, atualiza o texto após updates:
  - `computeInstallments(priceCents, max, min)`
  - `formatMoney(perCents, moneyFormat, currency)`
  - template JS de tradução: `content.installments_display_template_js`

Código completo:

```js
import { ThemeEvents } from '@theme/events';
import { formatMoney } from '@theme/money-formatting';

export function computeInstallments(priceCents, maxInstallments, minCentsPerPayment) {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
  if (!Number.isFinite(maxInstallments) || maxInstallments < 2) return null;
  if (!Number.isFinite(minCentsPerPayment) || minCentsPerPayment <= 0) return null;

  let nByMin = Math.floor(priceCents / minCentsPerPayment);
  if (nByMin < 1) nByMin = 1;
  let n = Math.min(maxInstallments, nByMin);
  if (n < 2) return null;

  const perCents = Math.ceil(priceCents / n);
  return { n, perCents };
}

class InstallmentsDisplayDynamic extends HTMLElement {
  #abort;

  connectedCallback() {
    this.#abort?.abort();
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    document.addEventListener(ThemeEvents.cartUpdate, this.#sync, { signal });
    document.addEventListener(ThemeEvents.discountUpdate, this.#sync, { signal });
    this.#paint();
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = undefined;
  }

  #sync = (event) => {
    const cart = event.detail?.resource;
    if (!cart || typeof cart.total_price !== 'number') return;
    this.dataset.priceCents = String(cart.total_price);
    this.#paint();
  };

  #paint() {
    const priceCents = Number(this.dataset.priceCents);
    const maxP = Number(this.dataset.maxInstallments);
    const minCents = Number(this.dataset.minCentsPerPayment);
    const result = computeInstallments(priceCents, maxP, minCents);
    const p = this.querySelector('.installments-display__text');

    if (!p) return;

    if (!result) {
      this.hidden = true;
      p.textContent = '';
      return;
    }

    this.hidden = false;
    const format = this.dataset.moneyFormat ?? '{{amount}}';
    const currency = this.dataset.currency ?? 'USD';
    const formatted = formatMoney(result.perCents, format, currency);
    const tpl = this.dataset.templateJs ?? '';
    p.textContent = tpl.replace('[count]', String(result.n)).replace('[amount]', formatted);
  }
}

if (!customElements.get('installments-display-dynamic')) {
  customElements.define('installments-display-dynamic', InstallmentsDisplayDynamic);
}
```

### 3) Integrações

#### Card/PDP (preço)
Em `snippets/price.liquid`:

```liquid
{% if settings.show_merchant_installments and product_resource and hide_merchant_installments != true %}
  {% render 'installments-display',
    price_cents: installments_base_cents,
    variant: selected_variant,
    context: 'product'
  %}
{% endif %}
```

#### Carrinho (total)
Em `snippets/cart-summary.liquid`:

```liquid
{% if settings.show_merchant_installments and cart.item_count > 0 %}
  <div class="cart-totals__item cart-totals__merchant-installments">
    {% render 'installments-display', price_cents: cart.total_price, context: 'cart' %}
  </div>
{% endif %}
```

#### Scripts
Em `snippets/scripts.liquid`:

```liquid
{% if settings.show_merchant_installments %}
  <script src="{{ 'installments-display.js' | asset_url }}" type="module" fetchpriority="low"></script>
{% endif %}
```

## Port para o Dawn
- Dawn já tem “payment terms” (Shop Pay installments) e também pode ter lógica própria.
- Se quiser manter exatamente esta feature:
  - Criar `snippets/installments-display.liquid` no Dawn.
  - Chamar a partir do snippet de preço do Dawn e do footer do carrinho.
  - Carregar `installments-display.js` e acoplar no fluxo de update do carrinho do Dawn (evento/callback que recebe o JSON).

