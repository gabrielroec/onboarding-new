# Tarefa 06 — Produtos relacionados em posts de blog (via metacampo)

## Objetivo
Permitir ao lojista selecionar manualmente até **4 produtos** em um artigo do blog e renderizar uma seção “Produtos relacionados” **somente quando** o metacampo estiver preenchido.

## Dependência de dados (Admin Shopify)
- Metacampo no objeto **Blog post / Article**:
  - Namespace: `custom`
  - Key: `related_products`
  - Tipo: **lista de referências de produto**
  - (Recomendado) limite no Admin: 4

## Arquivo (Horizon) e o que foi feito

### `sections/article-related-products.liquid`
- Lê `article.metafields.custom.related_products.value`
- Conta itens válidos e limita a 4
- Renderiza uma lista com `resource-card` dentro de um `resource-list`
- Oculta a seção quando não há produtos

Código (completo do núcleo + render):

```liquid
{% liquid
  assign mf = article.metafields.custom.related_products
  assign related_raw = mf.value
  assign count = 0

  if mf != blank and related_raw != blank
    for p in related_raw
      if count >= 4
        break
      endif
      if p != blank
        assign count = count | plus: 1
      endif
    endfor
  endif
%}

{% if count > 0 %}
  {% capture list_items %}
    {% liquid
      assign rendered = 0
      assign first_item = true
    %}
    {% for product in related_raw %}
      {% if rendered >= 4 %}
        {% break %}
      {% endif %}
      {% if product != blank %}
        {% unless first_item %}
          <!--@list/split-->
        {% endunless %}
        {% assign first_item = false %}
        <div class="resource-list__item">
          {% render 'resource-card',
            resource_type: 'product',
            resource: product,
            image_aspect_ratio: '4 / 5',
            image_hover: true,
            image_sizes: '(min-width: 750px) 25vw, 50vw'
          %}
        </div>
        {% assign rendered = rendered | plus: 1 %}
      {% endif %}
    {% endfor %}
  {% endcapture %}

  {% liquid
    assign list_items_array = list_items | strip | split: '<!--@list/split-->'
  %}

  <div class="section-background color-{{ section.settings.color_scheme }}"></div>
  <div
    class="
      section
      section--{{ section.settings.section_width }}
      color-{{ section.settings.color_scheme }}
      section-resource-list
      spacing-style
      gap-style
      article-related-products
    "
    style="
      {% render 'spacing-style', settings: section.settings %}
      {% render 'gap-style', value: section.settings.gap %}
    "
  >
    <div
      class="section-resource-list__header"
      style="--horizontal-alignment: {{ section.settings.heading_alignment }};"
    >
      {% if section.settings.heading != blank %}
        <h2 class="h4 article-related-products__heading">{{ section.settings.heading | escape }}</h2>
      {% endif %}
    </div>

    {% render 'resource-list',
      list_items: list_items,
      list_items_array: list_items_array,
      settings: section.settings,
      slide_count: count,
      content_type: 'products',
      test_id: 'article-related-products-grid'
    %}
  </div>
{% endif %}
```

## Integração
- Template do artigo inclui a seção (`templates/article.json` no Horizon).

## Port para o Dawn
- Criar `sections/article-related-products.liquid` no Dawn (mesmo conceito).
- Integrar no template do artigo do Dawn:
  - `templates/article.json` (OS 2.0) adicionando a seção abaixo do conteúdo.
- Adaptar o layout:
  - Dawn usa `card-product`/`product-grid` em vez de `resource-card` (provável ajuste).

