# Tarefa 09 — Etiquetas personalizadas via Metaobjects (catálogo de labels)

## Objetivo
Permitir que o lojista aplique **múltiplas labels** em um produto via metacampo lista → metaobject, e renderizar essas labels no **card do produto**, com:
- precedência sobre badges nativas quando houver label custom
- cores configuráveis (background/text)
- suporte a campo Color da Shopify ou hex em texto

## Dependência de dados (Admin Shopify)
Produto:
- Metacampo: `custom.custom_label` (tipo **lista** de referências para metaobject)
  - fallback suportado: `custom.product_labels`

Metaobject (exemplo):
- `title` (texto)
- `background_color` e `text_color` (tipo **Color** recomendado)

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/product-card-metaobject-labels.liquid`
- Lê primeiro `product.metafields.custom.custom_label.value`, fallback `custom.product_labels.value`
- Para cada metaobject:
  - `label_title`: tenta `mo.title.value` e fallback `mo.title`
  - `background_color`:
    - se color object: `bg_src.value.rgb` → `rgb(r g b)`
    - se string: valida hex simples e prefixa `#`
  - `text_color`: mesma lógica
- Renderiza no mesmo padrão do Horizon: `.product-badges__badge product-badges__badge--rectangle`

Código completo:

```liquid
{% liquid
  assign max = max_labels | default: settings.product_card_metaobject_labels_max | default: 3
  assign list_ref = product.metafields.custom.custom_label.value
  if list_ref == blank
    assign list_ref = product.metafields.custom.product_labels.value
  endif
  assign shown = 0
%}

{% if list_ref != blank %}
  {% for mo in list_ref %}
    {% if shown >= max %}
      {% break %}
    {% endif %}

    {% liquid
      assign label_title = mo.title.value | strip
      if label_title == blank
        assign label_title = mo.title | strip
      endif
      if label_title == blank
        continue
      endif

      assign safe_bg = ''
      assign bg_src = mo.background_color
      if bg_src == blank
        assign bg_src = mo.background_colour
      endif
      if bg_src != blank
        assign bg_obj = bg_src.value | default: bg_src
        if bg_obj.rgb != blank
          assign safe_bg = 'rgb(' | append: bg_obj.rgb | append: ')'
        else
          assign raw_bg = bg_obj | append: '' | strip
          assign hex_bg = raw_bg | remove: '#' | downcase
          if hex_bg.size == 3 or hex_bg.size == 6
            unless raw_bg contains ';' or raw_bg contains '}' or raw_bg contains 'url(' or raw_bg contains 'expression'
              if raw_bg contains '#'
                assign safe_bg = raw_bg
              else
                assign safe_bg = '#' | append: hex_bg
              endif
            endunless
          endif
        endif
      endif

      assign safe_fg = ''
      assign fg_src = mo.text_color
      if fg_src == blank
        assign fg_src = mo.text_colour
      endif
      if fg_src != blank
        assign fg_obj = fg_src.value | default: fg_src
        if fg_obj.rgb != blank
          assign safe_fg = 'rgb(' | append: fg_obj.rgb | append: ')'
        else
          assign raw_fg = fg_obj | append: '' | strip
          assign hex_fg = raw_fg | remove: '#' | downcase
          if hex_fg.size == 3 or hex_fg.size == 6
            unless raw_fg contains ';' or raw_fg contains '}' or raw_fg contains 'url(' or raw_fg contains 'expression'
              if raw_fg contains '#'
                assign safe_fg = raw_fg
              else
                assign safe_fg = '#' | append: hex_fg
              endif
            endunless
          endif
        endif
      endif

      assign shown = shown | plus: 1
    %}

    <div
      class="product-badges__badge product-badges__badge--rectangle product-badges__badge--metaobject"
      {% if safe_bg != blank or safe_fg != blank %}
        style="
          {% if safe_bg != blank %}--pcb-bg: {{ safe_bg }}; background-color: var(--pcb-bg) !important;{% endif %}
          {% if safe_fg != blank %}--pcb-fg: {{ safe_fg }}; color: var(--pcb-fg) !important;{% endif %}
        "
      {% endif %}
    >
      {{- label_title | escape -}}
    </div>
  {% endfor %}
{% endif %}
```

### 2) `blocks/_product-card-gallery.liquid`
- Detecta se existe pelo menos uma label válida
- Se existir, **substitui** badges nativas (promoção/esgotado) por labels custom:

```liquid
{% if has_custom_product_labels %}
  {% render 'product-card-metaobject-labels', product: product %}
{% elsif show_native_badge %}
  ...
{% endif %}
```

## Port para o Dawn
- Criar `snippets/product-card-metaobject-labels.liquid` no Dawn
- Integrar no snippet/section do card do Dawn (geralmente `snippets/card-product.liquid`):
  - onde hoje ele renderiza “Sale / Sold out”
- Garantir Storefront access do metacampo/metaobject
- Ajustar as classes para bater com o CSS do Dawn (ou portar a estrutura de `.product-badges` do Horizon)

