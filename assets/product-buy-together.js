(() => {
  if (!window.routes?.cart_add_url || typeof fetchConfig !== 'function') return;

  /** TASK: 08 — Compre junto: adiciona variante atual + recomendada num único POST /cart/add.js (items[]). */

  const getCartUi = () => document.querySelector('cart-notification') || document.querySelector('cart-drawer');

  const fetchCartState = async () => {
    const root = window?.Shopify?.routes?.root || '/';
    const response = await fetch(`${root}cart.js`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to load cart');
    return response.json();
  };

  const applyCartContents = (data) => {
    const cart = getCartUi();
    if (!cart) return;

    // cart-notification precisa de parsedState.key no topo.
    // Em add.js com items múltiplos, a key pode vir apenas em data.items[0].key.
    if (cart.tagName === 'CART-NOTIFICATION' && !data.key && Array.isArray(data.items) && data.items[0]?.key) {
      data.key = data.items[0].key;
    }

    if (cart && data.sections && typeof cart.renderContents === 'function') {
      cart.renderContents(data);
    }

    // Igual ao fluxo nativo do Dawn: garante que o drawer saia do estado "vazio".
    if (cart.classList.contains('is-empty')) {
      cart.classList.remove('is-empty');
    }
  };

  const addItemsTogether = async ({ variantIds, sections, sectionsUrl }) => {
    const payload = {
      items: variantIds.map((id) => ({ id: parseInt(String(id), 10), quantity: 1 })),
    };
    if (sections && sections.length) {
      payload.sections = sections.join(',');
      payload.sections_url = sectionsUrl || window.location.pathname;
    }

    const baseConfig = fetchConfig('javascript');
    const response = await fetch(`${routes.cart_add_url}`, {
      ...baseConfig,
      headers: {
        ...baseConfig.headers,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status || data.errors) {
      const msg =
        data.description || data.message || (typeof data.errors === 'string' ? data.errors : 'Could not add items');
      throw new Error(msg);
    }

    return data;
  };

  if (!customElements.get('product-buy-together')) {
    customElements.define(
      'product-buy-together',
      class ProductBuyTogether extends HTMLElement {
        variantUnsubscriber = undefined;

        constructor() {
          super();
          this.onClick = this.onClick.bind(this);
          this.onVariantChange = this.onVariantChange.bind(this);
        }

        connectedCallback() {
          this.button = this.querySelector('[data-buy-together-button]');
          this.errorEl = this.querySelector('[data-buy-together-error]');
          this.spinner = this.querySelector('.loading__spinner');
          this.labelSpan = this.button?.querySelector('span');
          this.recommendedVariantId = this.dataset.recommendedVariantId;
          this.productFormId = this.dataset.productFormId;
          this.sectionId = this.dataset.sectionId;
          this.strings = window.productBuyTogetherStrings?.[this.sectionId] || {};

          if (this.button) this.button.addEventListener('click', this.onClick);

          if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            this.variantUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange);
          }

          this.syncButtonState();
        }

        disconnectedCallback() {
          if (this.variantUnsubscriber) this.variantUnsubscriber();
        }

        onVariantChange(event) {
          if (!event?.data?.sectionId || event.data.sectionId !== this.sectionId) return;
          this.syncButtonState(event.data.variant);
        }

        get variantIdInput() {
          const form = document.getElementById(this.productFormId);
          return form?.querySelector('input[name="id"]');
        }

        getCurrentVariantId() {
          const input = this.variantIdInput;
          if (!input || input.disabled) return null;
          const v = input.value;
          return v ? String(v) : null;
        }

        syncButtonState(variant) {
          if (!this.button) return;
          const id = this.getCurrentVariantId();
          const unavailable =
            !id ||
            (variant && variant.available === false) ||
            (this.variantIdInput && this.variantIdInput.disabled);

          this.button.disabled = unavailable || this.button.getAttribute('aria-busy') === 'true';
        }

        setLoading(on) {
          if (!this.button) return;
          this.button.setAttribute('aria-busy', on ? 'true' : 'false');
          this.button.classList.toggle('loading', on);
          if (this.spinner) this.spinner.classList.toggle('hidden', !on);
          if (this.labelSpan) this.labelSpan.classList.toggle('visibility-hidden', on);
          if (on) {
            this.button.disabled = true;
          } else {
            this.syncButtonState();
          }
        }

        showError(msg) {
          if (!this.errorEl) return;
          this.errorEl.textContent = msg || this.strings.error || '';
          this.errorEl.hidden = !msg;
        }

        async onClick(event) {
          event.preventDefault();
          const currentId = this.getCurrentVariantId();
          const recId = this.recommendedVariantId;

          if (!currentId || !recId) {
            this.showError(this.strings.error);
            return;
          }

          this.showError('');
          this.setLoading(true);

          const cart = getCartUi();
          const sectionsToRender =
            cart && typeof cart.getSectionsToRender === 'function'
              ? cart
                  .getSectionsToRender()
                  .map((s) => s.id)
                  .filter(Boolean)
              : [];

          try {
            const data = await addItemsTogether({
              variantIds: [currentId, recId],
              sections: sectionsToRender,
              sectionsUrl: window.location.pathname,
            });

            applyCartContents(data);

            if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
              // Use estado canônico do carrinho para evitar payload parcial do add.js
              // quebrando assinantes (ex.: frete grátis mostrando NaN).
              const cartState = await fetchCartState();
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-buy-together',
                cartData: cartState,
              });
            }
          } catch (e) {
            console.error(e);
            this.showError(e.message || this.strings.error);
          } finally {
            this.setLoading(false);
            if (cart && cart.classList.contains('is-empty')) {
              cart.classList.remove('is-empty');
            }
          }
        }
      }
    );
  }
})();
