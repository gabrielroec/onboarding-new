(() => {
  // TASK: 01 - Aplicação de cupom no carrinho (commit por tarefa).
  // Responsável por aplicar/remover discount codes via /cart/update.js e atualizar seções cart page/drawer.
  if (!window.routes?.cart_update_url || typeof fetchConfig !== 'function') return;

  const cartUpdateJsUrl = () => {
    const u = window.routes.cart_update_url;
    return u.endsWith('.js') ? u : `${u}.js`;
  };

  const getSectionInnerHTML = (html, selector) => {
    if (!html || !selector) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.innerHTML : '';
  };

  const getCartPageSectionConfig = () => {
    const items = document.getElementById('main-cart-items');
    const footer = document.getElementById('main-cart-footer');
    const configs = [];
    if (items?.dataset.id) {
      configs.push({ domId: 'main-cart-items', sectionKey: items.dataset.id, selector: '.js-contents' });
    }
    if (footer?.dataset.id) {
      configs.push({ domId: 'main-cart-footer', sectionKey: footer.dataset.id, selector: '.js-contents' });
    }
    configs.push(
      { domId: 'cart-icon-bubble', sectionKey: 'cart-icon-bubble', selector: '.shopify-section' },
      { domId: 'cart-live-region-text', sectionKey: 'cart-live-region-text', selector: '.shopify-section' }
    );
    return configs;
  };

  const applyCartPageSections = (data) => {
    if (!data.sections) return;
    getCartPageSectionConfig().forEach(({ domId, sectionKey, selector }) => {
      const html = data.sections[sectionKey];
      if (!html) return;
      const host = document.getElementById(domId);
      if (!host) return;
      const target = host.querySelector(selector) || host;
      const inner = getSectionInnerHTML(html, selector);
      if (inner !== '') target.innerHTML = inner;
    });
  };

  const applyDrawerSections = (data) => {
    if (!data.sections?.['cart-drawer']) return;
    const drawer = document.querySelector('cart-drawer');
    if (!drawer) return;
    const innerHtml = getSectionInnerHTML(data.sections['cart-drawer'], '#CartDrawer');
    const cartDrawerEl = drawer.querySelector('#CartDrawer');
    if (cartDrawerEl && innerHtml !== '') cartDrawerEl.innerHTML = innerHtml;

    const overlay = drawer.querySelector('#CartDrawer-Overlay');
    if (overlay) {
      overlay.addEventListener('click', () => drawer.close());
    }

    if (typeof data.item_count === 'number') {
      drawer.classList.toggle('is-empty', data.item_count === 0);
    }

    if (data.sections['cart-icon-bubble']) {
      const bubble = document.getElementById('cart-icon-bubble');
      if (bubble) {
        const innerBubble = getSectionInnerHTML(data.sections['cart-icon-bubble'], '.shopify-section');
        const target = bubble.querySelector('.shopify-section') || bubble;
        if (innerBubble !== '') target.innerHTML = innerBubble;
      }
    }
  };

  const getSectionsPayload = (root) => {
    const ctx = root.dataset.cartDiscountContext;
    if (ctx === 'drawer') {
      return {
        sections: ['cart-drawer', 'cart-icon-bubble'],
        apply: applyDrawerSections,
      };
    }
    return {
      sections: getCartPageSectionConfig().map((c) => c.sectionKey).filter(Boolean),
      apply: applyCartPageSections,
    };
  };

  const normalizeCode = (code) => (code || '').trim().toLowerCase();

  const existingCodes = (root) => {
    const out = [];
    root.querySelectorAll('.cart-discount__pill[data-discount-code]').forEach((pill) => {
      const c = pill.getAttribute('data-discount-code');
      if (c) out.push(c);
    });
    return out;
  };

  const setLoading = (root, on) => {
    root.classList.toggle('cart-discount--loading', on);
    root.querySelectorAll('button, input').forEach((el) => {
      if (on) el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('disabled');
    });
  };

  const clearMessages = (root) => {
    const ok = root.querySelector('.cart-discount__success');
    const err = root.querySelector('.cart-discount__error');
    const errText = root.querySelector('.cart-discount__error-text');
    if (ok) {
      ok.textContent = '';
      ok.setAttribute('hidden', '');
      ok.classList.add('visually-hidden');
    }
    if (err) err.setAttribute('hidden', '');
    if (errText) errText.textContent = '';
  };

  const showError = (root, message) => {
    const err = root.querySelector('.cart-discount__error');
    const errText = root.querySelector('.cart-discount__error-text');
    if (errText) errText.textContent = message || '';
    if (err) err.removeAttribute('hidden');
  };

  const showSuccess = (root, code) => {
    const tpl = root.dataset.successTemplate || '';
    const ok = root.querySelector('.cart-discount__success');
    if (!ok) return;
    ok.textContent = tpl.replace(/\[[^\]]*code[^\]]*\]/i, code).replace('[code]', code);
    ok.removeAttribute('hidden');
    ok.classList.remove('visually-hidden');
  };

  let activeController = null;

  const postDiscount = async (root, discountString) => {
    const { sections, apply } = getSectionsPayload(root);
    if (!sections.length) return;

    if (activeController) activeController.abort();
    activeController = new AbortController();

    const body = JSON.stringify({
      discount: discountString,
      sections,
      sections_url: window.location.pathname,
    });

    clearMessages(root);
    setLoading(root, true);

    try {
      const response = await fetch(cartUpdateJsUrl(), {
        ...fetchConfig('json'),
        body,
        signal: activeController.signal,
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        showError(root, window.cartStrings?.error || '');
        return;
      }

      if (data.errors) {
        const msg =
          typeof data.errors === 'string'
            ? data.errors
            : data.errors.discount?.[0] || data.message || window.cartStrings?.error || '';
        showError(root, msg);
        return;
      }

      const input = root.querySelector('.cart-discount__input');
      const attemptedCode = input?.value?.trim();

      if (attemptedCode && Array.isArray(data.discount_codes)) {
        const rejected = data.discount_codes.find(
          (d) => normalizeCode(d.code) === normalizeCode(attemptedCode) && d.applicable === false
        );
        if (rejected) {
          if (input) input.value = '';
          showError(root, window.cartDiscountStrings?.invalid || '');
          return;
        }
      }

      apply(data);

      if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-discount', cartData: data });
      }

      if (attemptedCode) {
        const ctx = root.dataset.cartDiscountContext;
        const updatedRoot = document.querySelector(`[data-cart-discount][data-cart-discount-context="${ctx}"]`);
        queueMicrotask(() => showSuccess(updatedRoot || root, attemptedCode));
        if (input) input.value = '';
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      showError(root, window.cartStrings?.error || '');
    } finally {
      activeController = null;
      setLoading(root, false);
    }
  };

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.classList.contains('cart-discount__form')) return;
      const root = form.closest('[data-cart-discount]');
      if (!root) return;
      event.preventDefault();
      const input = form.querySelector('input[name="discount"]');
      const code = input?.value?.trim();
      if (!code) return;
      const codes = existingCodes(root);
      if (codes.some((existing) => normalizeCode(existing) === normalizeCode(code))) return;
      postDiscount(root, [...codes, code].join(','));
    },
    true
  );

  document.addEventListener(
    'click',
    (event) => {
      const removeAll = event.target.closest('[data-cart-discount-remove-all]');
      const removeOne = event.target.closest('[data-cart-discount-remove]');
      if (!removeAll && !removeOne) return;
      const root = (removeAll || removeOne).closest('[data-cart-discount]');
      if (!root) return;
      event.preventDefault();
      if (removeAll) {
        postDiscount(root, '');
        return;
      }
      const pill = removeOne.closest('.cart-discount__pill');
      const code = pill?.getAttribute('data-discount-code');
      if (!code) return;
      const next = existingCodes(root).filter((c) => c !== code);
      postDiscount(root, next.join(','));
    },
    true
  );
})();
