# Tarefa 02 — Barra de progresso de frete grátis

## Objetivo
Exibir no carrinho uma barra que mostra o progresso até um **mínimo configurável** para frete grátis:
- Mensagem “Faltam R$ X…”
- Mensagem “Parabéns…”
- Barra de progresso responsiva
- Atualização automática quando o carrinho muda

## Configuração (Horizon)
- `settings.free_shipping_minimum` em `config/settings_schema.json` (valor em moeda “major”, ex.: 50 para R$ 50).

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/free-shipping-progress.liquid`
- Calcula o mínimo em centavos e o subtotal (`cart.items_subtotal_price`)
- Renderiza `<free-shipping-progress>` com:
  - `data-threshold-cents`
  - `data-money-format` e `data-currency`
  - templates de mensagem (remaining/qualified) com placeholder `__REPLACE__`
- Inclui CSS do componente

Código completo:

```liquid
{%- assign fs_uid = section_suffix | default: 'cart' | replace: ' ', '-' -%}
{%- assign fs_major = settings.free_shipping_minimum | default: 0 | plus: 0 -%}

{%- if fs_major > 0 and cart.item_count > 0 -%}
  {%- liquid
    assign threshold_cents = fs_major | times: 100
    assign subtotal = cart.items_subtotal_price
    assign qualified = false
    if subtotal >= threshold_cents
      assign qualified = true
    endif

    assign progress_pct = subtotal | times: 100 | divided_by: threshold_cents
    if progress_pct > 100
      assign progress_pct = 100
    endif

    assign remaining_cents = threshold_cents | minus: subtotal
    if remaining_cents < 0
      assign remaining_cents = 0
    endif

    if settings.currency_code_enabled_cart_total
      assign money_format_for_bar = shop.money_with_currency_format
    else
      assign money_format_for_bar = shop.money_format
    endif

    assign remaining_money = remaining_cents | money
  -%}
<free-shipping-progress
  class="free-shipping-progress"
  data-threshold-cents="{{ threshold_cents }}"
  data-money-format="{{ money_format_for_bar | escape }}"
  data-currency="{{ cart.currency.iso_code | escape }}"
  data-template-remaining="{{ 'content.free_shipping_remaining' | t: amount: '__REPLACE__' | escape }}"
  data-template-qualified="{{ 'content.free_shipping_qualified' | t | escape }}"
>
  <p
    class="free-shipping-progress__message cart-primary-typography"
    id="free-shipping-progress-message-{{ fs_uid }}"
    aria-live="polite"
    aria-atomic="true"
  >
    {%- if qualified -%}
      {{ 'content.free_shipping_qualified' | t }}
    {%- else -%}
      {{- 'content.free_shipping_remaining' | t: amount: remaining_money -}}
    {%- endif -%}
  </p>

  <div
    class="free-shipping-progress__track"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="{{ progress_pct }}"
    aria-labelledby="free-shipping-progress-message-{{ fs_uid }}"
    aria-valuetext="{{ progress_pct }}%"
  >
    <div
      class="free-shipping-progress__fill"
      style="--free-shipping-pct: {{ progress_pct }}%;"
    ></div>
  </div>
</free-shipping-progress>
{%- endif -%}

{% stylesheet %}
  .free-shipping-progress {
    width: 100%;
    margin-block-end: var(--gap-md);
  }

  .free-shipping-progress__message {
    margin: 0 0 var(--gap-xs);
    font-size: var(--font-size--2xs);
    line-height: 1.4;
  }

  .free-shipping-progress__track {
    width: 100%;
    height: 0.5rem;
    border-radius: var(--style-border-radius-pills);
    background-color: rgb(var(--color-foreground-rgb) / 0.12);
    overflow: hidden;
  }

  .free-shipping-progress__fill {
    height: 100%;
    width: var(--free-shipping-pct, 0%);
    max-width: 100%;
    border-radius: inherit;
    background-color: var(--color-foreground);
    transition: width var(--animation-speed) var(--animation-easing);
  }

  @media (prefers-reduced-motion: reduce) {
    .free-shipping-progress__fill {
      transition: none;
    }
  }
{% endstylesheet %}
```

### 2) `assets/free-shipping-progress.js`
- Define `<free-shipping-progress>`
- Escuta eventos `cart:update` e `discount:update` (Horizon ThemeEvents)
- Recalcula mensagem e barra via `formatMoney`

Código completo:

```js
import { ThemeEvents } from '@theme/events';
import { formatMoney } from '@theme/money-formatting';

export function syncFreeShippingProgressFromCart(cart) {
  if (typeof cart?.items_subtotal_price !== 'number') return;
  for (const el of document.querySelectorAll('free-shipping-progress')) {
    if (el instanceof FreeShippingProgress) {
      el.updateFromCartPayload(cart);
    }
  }
}

class FreeShippingProgress extends HTMLElement {
  #abort;

  connectedCallback() {
    this.#abort?.abort();
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    document.addEventListener(ThemeEvents.cartUpdate, this.#onCartEvent, { signal });
    document.addEventListener(ThemeEvents.discountUpdate, this.#onCartEvent, { signal });
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = undefined;
  }

  updateFromCartPayload(cart) {
    if (typeof cart?.items_subtotal_price !== 'number') return;
    const threshold = Number(this.dataset.thresholdCents);
    if (!Number.isFinite(threshold) || threshold <= 0) return;

    if (!cart.items?.length) {
      this.hidden = true;
      return;
    }
    this.hidden = false;

    this.#paint(cart.items_subtotal_price, threshold);
  }

  #onCartEvent = (event) => {
    const e = event;
    const cart = e.detail?.resource;
    if (!cart) return;
    this.updateFromCartPayload(cart);
  };

  #paint(subtotalCents, threshold) {
    const qualified = subtotalCents >= threshold;
    let pct = Math.round((subtotalCents / threshold) * 10000) / 100;
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;

    const format = this.dataset.moneyFormat ?? '{{amount}}';
    const currency = this.dataset.currency ?? 'USD';
    const remaining = Math.max(0, threshold - subtotalCents);

    const templateRemaining = this.dataset.templateRemaining ?? '';
    const templateQualified = this.dataset.templateQualified ?? '';

    const messageEl = this.querySelector('.free-shipping-progress__message');
    const track = this.querySelector('.free-shipping-progress__track');
    const fill = this.querySelector('.free-shipping-progress__fill');

    if (messageEl instanceof HTMLElement) {
      if (qualified) {
        messageEl.textContent = templateQualified;
      } else {
        const formatted = formatMoney(remaining, format, currency);
        messageEl.textContent = templateRemaining.replace('__REPLACE__', formatted);
      }
    }

    if (track instanceof HTMLElement) {
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
      track.setAttribute('aria-valuetext', `${Math.round(pct)}%`);
    }

    if (fill instanceof HTMLElement) {
      fill.style.setProperty('--free-shipping-pct', `${pct}%`);
    }
  }
}

if (!customElements.get('free-shipping-progress')) {
  customElements.define('free-shipping-progress', FreeShippingProgress);
}
```

### 3) Integrações
- `snippets/cart-summary.liquid`: renderiza o snippet quando `settings.free_shipping_minimum > 0`.
- `snippets/scripts.liquid`: carrega o script quando `settings.free_shipping_minimum > 0`.

## Port para o Dawn

### Onde integrar
- Inserir o snippet no carrinho: `sections/main-cart-footer.liquid` (ou equivalente) perto de subtotal/total.
- Carregar o JS: Dawn geralmente usa `assets/global.js` e/ou `layout/theme.liquid`.

### Ajustes esperados
- No Dawn, a atualização do carrinho costuma ocorrer via `cart.js` + “render sections”.
  - Opção simples: em cada update de carrinho no Dawn, chamar `updateFromCartPayload(cart)` com o JSON retornado.
- Se preferir sem JS: renderizar só no servidor (sem atualização ao vivo) — menos UX, mas mais simples.

