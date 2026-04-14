(() => {
  const formatMoneyCents = (cents, currency, locale) => {
    const cur = currency || 'USD';
    const loc = locale && locale.length ? locale : undefined;
    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };

  const computeInstallments = (priceCents, maxInstallments, minCentsPerPayment) => {
    if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
    if (!Number.isFinite(maxInstallments) || maxInstallments < 2) return null;
    if (!Number.isFinite(minCentsPerPayment) || minCentsPerPayment <= 0) return null;

    let nByMin = Math.floor(priceCents / minCentsPerPayment);
    if (nByMin < 1) nByMin = 1;
    const n = Math.min(maxInstallments, nByMin);
    if (n < 2) return null;

    const perCents = Math.ceil(priceCents / n);
    return { n, perCents };
  };

  class InstallmentsDisplayDynamic extends HTMLElement {
    connectedCallback() {
      this._unsubscribe =
        typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined'
          ? subscribe(PUB_SUB_EVENTS.cartUpdate, (payload) => {
              const cart = payload?.cartData;
              if (!cart || typeof cart.total_price !== 'number') return;
              this.dataset.priceCents = String(cart.total_price);
              this.paint();
            })
          : null;

      queueMicrotask(() => this.paint());
    }

    disconnectedCallback() {
      if (typeof this._unsubscribe === 'function') this._unsubscribe();
      this._unsubscribe = null;
    }

    paint() {
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
      const currency = this.dataset.currency ?? '';
      const locale = this.dataset.locale ?? '';
      const formatted = formatMoneyCents(result.perCents, currency, locale);
      const tpl = this.dataset.templateJs ?? '';
      p.textContent = tpl.replaceAll('[count]', String(result.n)).replaceAll('[amount]', formatted);
    }
  }

  if (!customElements.get('installments-display-dynamic')) {
    customElements.define('installments-display-dynamic', InstallmentsDisplayDynamic);
  }
})();
