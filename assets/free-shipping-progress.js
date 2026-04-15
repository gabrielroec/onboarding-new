(() => {
  // TASK: 02 - Barra de progresso de frete grátis (commit por tarefa).
  // Atualiza mensagem + progresso visual ao reagir a eventos de cartUpdate.
  const getSubtotalCents = (cart) => {
    if (typeof cart?.items_subtotal_price === 'number') return cart.items_subtotal_price;
    if (Array.isArray(cart?.items)) {
      return cart.items.reduce((sum, item) => sum + (item.final_line_price ?? item.line_price ?? 0), 0);
    }
    return 0;
  };

  const itemCount = (cart) => {
    if (typeof cart?.item_count === 'number') return cart.item_count;
    if (Array.isArray(cart?.items)) return cart.items.length;
    return 0;
  };

  const formatMoneyCents = (cents, currency, locale) => {
    const cur = currency || 'USD';
    const loc = locale && locale.length ? locale : undefined;
    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };

  const reducedMotion = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  class FreeShippingProgress extends HTMLElement {
    connectedCallback() {
      this._lastPct = undefined;

      this._unsubscribe =
        typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined'
          ? subscribe(PUB_SUB_EVENTS.cartUpdate, (payload) => {
              if (!payload?.cartData) return;
              this.updateFromCart(payload.cartData);
            })
          : null;

      queueMicrotask(() => {
        if (this._lastPct !== undefined) return;
        const initial = parseFloat(this.dataset.initialProgress);
        if (Number.isFinite(initial)) {
          this._lastPct = initial;
        }
      });
    }

    disconnectedCallback() {
      if (typeof this._unsubscribe === 'function') this._unsubscribe();
      this._unsubscribe = null;
    }

    /** @param {number} pctPercent 0–100 */
    paintBar(pctPercent) {
      const fill = this.querySelector('.free-shipping-progress__fill');
      if (!fill) return;

      const pct = Math.min(100, Math.max(0, pctPercent));

      if (reducedMotion()) {
        fill.classList.add('free-shipping-progress__fill--static');
        fill.style.width = `${pct}%`;
        this._lastPct = pct;
        requestAnimationFrame(() => fill.classList.remove('free-shipping-progress__fill--static'));
        return;
      }

      const fromZero = this._lastPct === undefined;

      if (fromZero) {
        fill.classList.add('free-shipping-progress__fill--static');
        fill.style.width = '0%';
        this._lastPct = 0;
        void fill.offsetWidth;
        fill.classList.remove('free-shipping-progress__fill--static');

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fill.style.width = `${pct}%`;
            this._lastPct = pct;
          });
        });
        return;
      }

      fill.style.width = `${pct}%`;
      this._lastPct = pct;
    }

    updateFromCart(cart) {
      const threshold = Number(this.dataset.thresholdCents);
      if (!Number.isFinite(threshold) || threshold <= 0) return;

      const count = itemCount(cart);
      if (!count) {
        this.hidden = true;
        return;
      }
      this.hidden = false;

      const subtotalCents = getSubtotalCents(cart);
      const qualified = subtotalCents >= threshold;
      let pct = Math.round((subtotalCents / threshold) * 10000) / 100;
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;

      const remaining = Math.max(0, threshold - subtotalCents);
      const currency = this.dataset.currency || '';
      const locale = this.dataset.locale || '';

      const templateRemaining = this.dataset.templateRemaining || '';
      const templateQualified = this.dataset.templateQualified || '';

      const messageEl = this.querySelector('.free-shipping-progress__message');
      const track = this.querySelector('.free-shipping-progress__track');

      if (messageEl) {
        if (qualified) {
          messageEl.textContent = templateQualified;
        } else {
          const formatted = formatMoneyCents(remaining, currency, locale);
          messageEl.textContent = templateRemaining.replace(/__REPLACE__/g, formatted);
        }
      }

      if (track) {
        const rounded = Math.round(pct);
        track.setAttribute('aria-valuenow', String(rounded));
        track.setAttribute('aria-valuetext', `${rounded}%`);
      }

      this.paintBar(pct);
    }
  }

  if (!customElements.get('free-shipping-progress')) {
    customElements.define('free-shipping-progress', FreeShippingProgress);
  }
})();
