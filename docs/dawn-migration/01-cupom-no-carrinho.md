# Tarefa 01 — Aplicação de cupom no carrinho (sem app)

## Objetivo
Adicionar no carrinho um campo para o cliente inserir **código de cupom**, com:
- validação imediata (após aplicar)
- feedback de sucesso/erro
- possibilidade de remover um ou todos os cupons aplicados
- atualização do carrinho/total via HTML de seção (sem recarregar página)

> Importante: no Shopify, a diferença entre “desconto de produto” e “desconto de pedido” é definida **na criação do desconto** (Admin). O tema só envia o **discount code** e renderiza o resultado que a Shopify devolve.

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/cart-discount-form.liquid`
- Renderiza o UI (accordion) + `<cart-discount-component>`
- Lista cupons já aplicados (cart-level e line-level allocations)
- Botão “Remover todos” + pills para remover individualmente
- Expõe `data-success-template` para o JS montar a mensagem de sucesso

Código completo:

```liquid
{% liquid
  assign discount_codes = cart.cart_level_discount_applications | where: 'type', 'discount_code' | map: 'title'
  for item in cart.items
    for allocation in item.line_level_discount_allocations
      if allocation.discount_application.type == 'discount_code'
        assign discount_codes = item.line_level_discount_allocations | slice: forloop.index0 | map: 'discount_application' | map: 'title' | concat: discount_codes
      endif
    endfor
  endfor

  assign discount_codes = discount_codes | uniq

  if discount_codes.size == 0
    assign disclosure_expanded = false
  else
    assign disclosure_expanded = true
  endif

  assign discount_input_id = 'cart-discount-input-' | append: section_id
%}

<accordion-custom class="cart-discount">
  <details
    class="details"
    {% if disclosure_expanded %}
      open
    {% endif %}
  >
    <summary class="cart-discount__summary">
      <span class="cart-discount__label cart-primary-typography">{{ 'content.discount' | t }}</span>

      <span class="cart-totals__icon">
        {{- 'icon-plus.svg' | inline_asset_content -}}
      </span>
    </summary>

    <div class="details-content">
      <div id="cart-discount-disclosure-{{ section_id }}">
        <cart-discount-component
          {% if section_id != blank %}
            data-section-id="{{ section_id }}"
          {% endif %}
          data-success-template="{{ 'content.discount_code_applied_success' | t | escape }}"
        >
          <div class="cart-discount__content">
            <form
              on:submit="/applyDiscount"
              onsubmit="return false;"
              class="cart-discount__form"
            >
              <label
                for="{{ discount_input_id }}"
                class="visually-hidden"
              >
                {{- 'accessibility.discount' | t -}}
              </label>
              <input
                id="{{ discount_input_id }}"
                class="cart-discount__input"
                type="text"
                name="discount"
                autocomplete="off"
                size="8"
                placeholder="{{ 'content.discount_code' | t }}"
                required
                {% if cart.empty? %}
                  disabled
                {% endif %}
              >
              <button
                type="submit"
                class="button cart-discount__button"
              >
                {{ 'actions.apply' | t }}
              </button>
            </form>
          </div>

          <div
            class="cart-discount__success cart-primary-typography hidden"
            ref="cartDiscountSuccess"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></div>

          <div
            class="cart-discount__error hidden"
            role="alert"
            aria-live="assertive"
            ref="cartDiscountError"
          >
            <span class="svg-wrapper">
              {{- 'icon-error.svg' | inline_asset_content -}}
            </span>
            <small
              class="cart-discount__error-text cart-primary-typography hidden"
              ref="cartDiscountErrorDiscountCode"
            >
              {{ 'content.discount_code_error' | t }}
            </small>
            <small
              class="cart-discount__error-text cart-primary-typography hidden"
              ref="cartDiscountErrorShipping"
            >
              {{ 'content.shipping_discount_error' | t }}
            </small>
          </div>

          {% if discount_codes.size > 0 %}
            <div class="cart-discount__toolbar">
              <button
                type="button"
                class="button button-secondary cart-discount__remove-all"
                on:click="/removeAllDiscounts"
              >
                {{ 'actions.remove_all_discounts' | t }}
              </button>
            </div>
          {% endif %}

          <ul class="cart-discount__codes">
            {% for discount_code in discount_codes %}
              <li
                class="cart-discount__pill"
                data-discount-code="{{ discount_code }}"
                aria-label="{{ 'accessibility.discount_applied' | t: code: discount_code }}"
              >
                <p class="cart-discount__pill-code">
                  {{ discount_code }}
                </p>
                <button
                  type="button"
                  on:click="/removeDiscount"
                  class="cart-discount__pill-remove svg-wrapper svg-wrapper--smaller button-unstyled"
                  aria-label="{{ 'actions.remove_discount' | t: code: discount_code }}"
                >
                  {{- 'icon-filters-close.svg' | inline_asset_content -}}
                </button>
              </li>
            {% endfor %}
          </ul>
        </cart-discount-component>
      </div>
    </div>
  </details>
</accordion-custom>
```

### 2) `assets/cart-discount.js`
- Define `<cart-discount-component>` (web component)
- `applyDiscount`: chama `cart/update.js` com `{ discount: "CODE1,CODE2", sections: [sectionId] }`
- Detecta erro de cupom **não aplicável** via `data.discount_codes[].applicable === false`
- Atualiza a seção do carrinho via HTML retornado em `data.sections[sectionId]` (morph)
- `removeDiscount` e `removeAllDiscounts` fazem o mesmo fluxo com lista de cupons reduzida

Código completo:

```js
import { Component } from '@theme/component';
import { morphSection } from '@theme/section-renderer';
import { DiscountUpdateEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';
import { cartPerformance } from '@theme/performance';

function getCartUpdateJsUrl() {
  if (typeof window.Shopify !== 'undefined' && window.Shopify.routes?.root) {
    const root = window.Shopify.routes.root;
    const path = 'cart/update.js';
    return root.endsWith('/') ? `${root}${path}` : `${root}/${path}`;
  }
  const base = window.Theme?.routes?.cart_update_url ?? '/cart/update';
  return base.includes('.js') ? base : `${base}.js`;
}

function flashDiscountSuccess(sectionId, code, template) {
  if (!sectionId || !code) return;
  const sectionEl = document.getElementById(`shopify-section-${sectionId}`);
  const host = sectionEl?.querySelector('cart-discount-component');
  const successEl = host?.querySelector('[ref="cartDiscountSuccess"]');
  if (!(successEl instanceof HTMLElement)) return;
  const text = (template || '').replace('[code]', code);
  successEl.textContent = text;
  successEl.classList.remove('hidden');
}

class CartDiscount extends Component {
  requiredRefs = [
    'cartDiscountError',
    'cartDiscountErrorDiscountCode',
    'cartDiscountErrorShipping',
    'cartDiscountSuccess',
  ];

  #activeFetch = null;

  #createAbortController() {
    if (this.#activeFetch) {
      this.#activeFetch.abort();
    }
    const abortController = new AbortController();
    this.#activeFetch = abortController;
    return abortController;
  }

  #setLoading(on) {
    this.classList.toggle('cart-discount--loading', on);
    this.setAttribute('aria-busy', on ? 'true' : 'false');
    const form = this.querySelector('.cart-discount__form');
    if (form instanceof HTMLFormElement) {
      for (const el of form.querySelectorAll('button, input')) {
        if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
          el.toggleAttribute('disabled', on);
        }
      }
    }
    for (const btn of this.querySelectorAll('.cart-discount__pill-remove, .cart-discount__remove-all')) {
      if (btn instanceof HTMLButtonElement) btn.toggleAttribute('disabled', on);
    }
  }

  #clearFeedback() {
    const { cartDiscountError, cartDiscountErrorDiscountCode, cartDiscountErrorShipping, cartDiscountSuccess } =
      this.refs;
    cartDiscountError.classList.add('hidden');
    cartDiscountErrorDiscountCode.classList.add('hidden');
    cartDiscountErrorShipping.classList.add('hidden');
    cartDiscountSuccess.classList.add('hidden');
    cartDiscountSuccess.textContent = '';
  }

  applyDiscount = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const discountInput = form.querySelector('input[name="discount"]');
    if (!(discountInput instanceof HTMLInputElement) || typeof this.dataset.sectionId !== 'string') return;

    const discountCodeValue = discountInput.value.trim();
    if (!discountCodeValue) return;

    const abortController = this.#createAbortController();
    const successTemplate = this.dataset.successTemplate ?? '';

    const existingDiscounts = this.#existingDiscounts();
    if (existingDiscounts.includes(discountCodeValue)) return;

    this.#clearFeedback();
    this.#setLoading(true);

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({
          discount: [...existingDiscounts, discountCodeValue].join(','),
          sections: [this.dataset.sectionId],
        }),
      });

      const response = await fetch(getCartUpdateJsUrl(), {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      if (
        data.discount_codes?.find((discount) => {
          return discount.code === discountCodeValue && discount.applicable === false;
        })
      ) {
        discountInput.value = '';
        this.#handleDiscountError('discount_code');
        return;
      }

      const newHtml = data.sections[this.dataset.sectionId];
      const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
      const section = parsedHtml.getElementById(`shopify-section-${this.dataset.sectionId}`);
      const discountPills = section?.querySelectorAll('.cart-discount__pill') || [];
      if (section) {
        const codesFromDom = Array.from(discountPills)
          .map((element) => (element instanceof HTMLLIElement ? element.dataset.discountCode : null))
          .filter(Boolean);
        if (
          codesFromDom.length === existingDiscounts.length &&
          codesFromDom.every((code) => existingDiscounts.includes(code)) &&
          data.discount_codes?.find((discount) => {
            return discount.code === discountCodeValue && discount.applicable === true;
          })
        ) {
          this.#handleDiscountError('shipping');
          discountInput.value = '';
          return;
        }
      }

      document.dispatchEvent(new DiscountUpdateEvent(data, this.id));
      morphSection(this.dataset.sectionId, newHtml);
      queueMicrotask(() => flashDiscountSuccess(this.dataset.sectionId, discountCodeValue, successTemplate));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    } finally {
      this.#activeFetch = null;
      this.#setLoading(false);
      cartPerformance.measureFromEvent('discount-update:user-action', event);
    }
  };

  removeDiscount = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      (event instanceof KeyboardEvent && event.key !== 'Enter') ||
      !(event instanceof MouseEvent) ||
      !(event.target instanceof HTMLElement) ||
      typeof this.dataset.sectionId !== 'string'
    ) {
      return;
    }

    const pill = event.target.closest('.cart-discount__pill');
    if (!(pill instanceof HTMLLIElement)) return;

    const discountCode = pill.dataset.discountCode;
    if (!discountCode) return;

    const existingDiscounts = this.#existingDiscounts();
    const index = existingDiscounts.indexOf(discountCode);
    if (index === -1) return;

    existingDiscounts.splice(index, 1);

    const abortController = this.#createAbortController();
    this.#clearFeedback();
    this.#setLoading(true);

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({
          discount: existingDiscounts.join(','),
          sections: [this.dataset.sectionId],
        }),
      });

      const response = await fetch(getCartUpdateJsUrl(), {
        ...config,
        signal: abortController.signal,
      });

      const responseData = await response.json();

      document.dispatchEvent(new DiscountUpdateEvent(responseData, this.id));
      morphSection(this.dataset.sectionId, responseData.sections[this.dataset.sectionId]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    } finally {
      this.#activeFetch = null;
      this.#setLoading(false);
    }
  };

  removeAllDiscounts = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!(event.target instanceof HTMLElement) || typeof this.dataset.sectionId !== 'string') return;

    const abortController = this.#createAbortController();
    this.#clearFeedback();
    this.#setLoading(true);

    try {
      const config = fetchConfig('json', {
        body: JSON.stringify({
          discount: '',
          sections: [this.dataset.sectionId],
        }),
      });

      const response = await fetch(getCartUpdateJsUrl(), {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      document.dispatchEvent(new DiscountUpdateEvent(data, this.id));
      morphSection(this.dataset.sectionId, data.sections[this.dataset.sectionId]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    } finally {
      this.#activeFetch = null;
      this.#setLoading(false);
    }
  };

  #handleDiscountError(type) {
    const { cartDiscountError, cartDiscountErrorDiscountCode, cartDiscountErrorShipping } = this.refs;
    const target = type === 'discount_code' ? cartDiscountErrorDiscountCode : cartDiscountErrorShipping;
    cartDiscountError.classList.remove('hidden');
    target.classList.remove('hidden');
  }

  #existingDiscounts() {
    const discountCodes = [];
    const discountPills = this.querySelectorAll('.cart-discount__pill');
    for (const pill of discountPills) {
      if (pill instanceof HTMLLIElement && typeof pill.dataset.discountCode === 'string') {
        discountCodes.push(pill.dataset.discountCode);
      }
    }
    return discountCodes;
  }
}

if (!customElements.get('cart-discount-component')) {
  customElements.define('cart-discount-component', CartDiscount);
}
```

### 3) Integrações

#### `snippets/cart-summary.liquid`
- Renderiza o form quando `settings.show_add_discount_code`:

```liquid
{% if settings.show_add_discount_code %}
  {% render 'cart-discount-form', section_id: section_id %}
{% endif %}
```

#### `snippets/scripts.liquid`
- Carrega o JS quando `settings.show_add_discount_code`:

```liquid
{% if settings.show_add_discount_code %}
  <script src="{{ 'cart-discount.js' | asset_url }}" type="module" fetchpriority="low"></script>
{% endif %}
```

#### `config/settings_schema.json`
- Setting: `show_add_discount_code` (checkbox).

## Port para o Dawn (quando você fizer `theme pull`)

### Onde integrar no Dawn
- **Carrinho**: normalmente em `sections/main-cart-footer.liquid` (ou similar) e/ou `sections/main-cart-items.liquid`.
  - Inserir o snippet do formulário de cupom próximo ao total/subtotal.
- **Scripts**: adicionar o `cart-discount.js` na carga global (Dawn usa `assets/global.js`/`theme.js` e/ou `layout/theme.liquid`).

### Ajustes esperados ao portar
- Dawn não tem `@theme/component`, `morphSection`, nem eventos do Horizon.
  - Alternativa no Dawn: usar o pattern do próprio Dawn (cart drawer e `fetch` + `renderSections`).
- Se quiser manter “morph”, usar `sections` no `cart/update.js` e substituir HTML por `innerHTML` + rebind.

## Perguntas típicas de tech lead (e respostas)
- **“Como garantimos idempotência?”**
  - A aplicação junta `existingDiscounts + newCode` e ignora se já existir.
- **“Por que `cart/update.js` e não `discount` query param?”**
  - `cart/update.js` permite atualizar `discount` e pedir HTML de seções em uma chamada, ficando robusto e sem reload.
- **“E frete com cupom?”**
  - Em muitos casos a Shopify só calcula descontos de frete no checkout após endereço; por isso existe mensagem separada `shipping_discount_error`.

