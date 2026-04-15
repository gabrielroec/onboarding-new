(() => {
  if (!window.routes?.cart_add_url || typeof fetchConfig !== 'function') return;

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

  const addSingleItem = async ({ variantId, sections, sectionsUrl }) => {
    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    const formData = new FormData();
    formData.append('id', variantId);
    formData.append('quantity', '1');
    if (sections && sections.length) {
      formData.append('sections', sections);
      formData.append('sections_url', sectionsUrl || window.location.pathname);
    }

    config.body = formData;

    const response = await fetch(`${routes.cart_add_url}`, config);
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
            // Fluxo simples e compatível com Dawn:
            // 1) adiciona produto atual
            // 2) adiciona recomendado + seções para atualizar drawer/notification
            await addSingleItem({
              variantId: currentId,
            });

            const data = await addSingleItem({
              variantId: recId,
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
