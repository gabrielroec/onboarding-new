# Tarefa 08 — Bloco “Compre junto” na PDP

## Objetivo
Criar um bloco na PDP que:
- lê um metacampo de produto (produto complementar)
- mostra título/preço do complementar
- tem um botão “Adicionar os 2 itens ao carrinho”
- ao clicar, adiciona **produto atual + complementar** em uma operação
- só aparece se o complementar existir e estiver disponível

## Dependência de dados (Admin Shopify)
Metacampo no produto (existe fallback):
- `product.metafields.custom.product_recommended` **ou**
- `product.metafields.custom.complementary_product`

Tipo recomendado: referência de produto.

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/product-buy-together.liquid`
- Descobre o complementar via metafield (`.value` e fallback)
- Escolhe uma variante disponível do complementar
- Renderiza `<product-buy-together>` com:
  - `data-complementary-variant-id`
  - `data-section-id`
- UI: imagem + nome + preço (com compare_at se houver) + botão + área de erro

Trecho núcleo:

```liquid
{% liquid
  assign product = closest.product
  if request.visual_preview_mode and product == blank
    assign product = collections.all.products.first
  endif

  assign complementary_raw = product.metafields.custom.product_recommended
  if complementary_raw == blank
    assign complementary_raw = product.metafields.custom.complementary_product
  endif
  assign complementary = complementary_raw.value
  if complementary == blank and complementary_raw != blank
    assign complementary = complementary_raw
  endif

  assign comp_variant = nil
  if complementary != blank
    assign comp_variant = complementary.selected_or_first_available_variant
    if comp_variant.available == false
      for v in complementary.variants
        if v.available
          assign comp_variant = v
          break
        endif
      endfor
    endif
  endif

  assign show_block = false
  if complementary != blank and comp_variant != blank and comp_variant.available
    assign show_block = true
  endif
%}
```

### 2) `assets/product-buy-together.js`
- Define `<product-buy-together>` (web component)
- Ao clicar:
  - pega o variant id atual via `product-form-component form input[name=id]`
  - monta payload `items: [{id: mainVariantId, quantity}, {id: complementaryVariantId, quantity: 1}]`
  - chama `Theme.routes.cart_add_url` (Ajax)
  - dispara eventos de carrinho (`CartAddEvent` / `CartErrorEvent`)
- Trata selling plan do produto principal quando existir

Código (núcleo do add):

```js
const items = [{ id: Number(mainVariantId), quantity: mainQty }, { id: Number(complementaryId), quantity: 1 }];
...
const cfg = fetchConfig('json', { body: JSON.stringify(payload) });
const res = await fetch(Theme.routes.cart_add_url, {
  ...cfg,
  headers: { ...cfg.headers, Accept: 'application/json' },
});
```

### 3) `blocks/product-buy-together.liquid`
- Bloco para ser colocado na PDP (render do snippet + CSS visual do card).

### 4) Scripts
Carregamento em `snippets/scripts.liquid` no contexto de produto:

```liquid
{% if template == 'product' or template.name == 'product' or request.page_type == 'product' %}
  <script src="{{ 'product-buy-together.js' | asset_url }}" type="module" fetchpriority="low"></script>
{% endif %}
```

## Port para o Dawn
- Criar os 3 arquivos no Dawn:
  - `snippets/product-buy-together.liquid`
  - `blocks/product-buy-together.liquid` (ou seção/bloco equivalente do Dawn)
  - `assets/product-buy-together.js`
- Integrar no template de produto do Dawn:
  - `templates/product.json` adicionando o bloco/section
- Ajustar a forma de obter o variant id no Dawn:
  - Dawn usa `<product-form>` / `form[action="/cart/add"]` e inputs similares, mas estrutura muda.

