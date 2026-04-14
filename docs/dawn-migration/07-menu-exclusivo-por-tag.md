# Tarefa 07 — Exibição de coleção exclusiva no menu (por tag do cliente)

## Objetivo
Exibir um item extra no menu principal (desktop + drawer + navigation bar mobile) **somente** quando:
- cliente está logado (`customer`)
- cliente possui uma `customer.tags` específica configurada (ex.: `funcionario`)

O item aponta para uma coleção configurável no tema.

## Configuração (Horizon)
Em `config/settings_schema.json`:
- `customer_exclusive_tag`
- `customer_exclusive_collection`
- `customer_exclusive_menu_label`

## Arquivos (Horizon) e o que foi feito

### 1) `snippets/customer-exclusive-nav-link.liquid`
- Normaliza tag e compara com `customer.tags`
- Calcula “active” quando está na coleção
- Renderiza em 3 variantes:
  - `desktop` (menu-list)
  - `navigation_bar` (barra mobile)
  - `drawer` (menu drawer)

Código completo:

```liquid
{% liquid
  assign show_exclusive = false
  assign exclusive_coll = settings.customer_exclusive_collection
  assign tag_needle = settings.customer_exclusive_tag | strip | downcase
  assign menu_label = settings.customer_exclusive_menu_label | strip

  if customer and tag_needle != blank and menu_label != blank and exclusive_coll != blank
    for customer_tag in customer.tags
      assign t_norm = customer_tag | strip | downcase
      if t_norm == tag_needle
        assign show_exclusive = true
        break
      endif
    endfor
  endif

  assign exclusive_link_active = false
  if show_exclusive and template.name == 'collection' and collection and exclusive_coll.handle == collection.handle
    assign exclusive_link_active = true
  endif
%}

{% if show_exclusive %}
  {% case variant %}
    {% when 'desktop' %}
      <li
        role="presentation"
        class="menu-list__list-item"
        on:focus="/activate"
        on:blur="/deactivate"
        on:pointerenter="/activate"
        on:pointerleave="/deactivate"
      >
        <a
          href="{{ exclusive_coll.url }}"
          data-skip-node-update="true"
          class="menu-list__link{% if exclusive_link_active %} menu-list__link--active{% endif %}"
          ref="menuitem"
        >
          <span class="menu-list__link-title">{{ menu_label | escape }}</span>
        </a>
      </li>

    {% when 'navigation_bar' %}
      <li>
        <a
          href="{{ exclusive_coll.url }}"
          id="MenuItem-customer-exclusive"
          class="menu-list__item"
          {% if exclusive_link_active %}
            aria-current="page"
          {% endif %}
        >
          {{- menu_label | escape -}}
        </a>
      </li>

    {% when 'drawer' %}
      <li
        style="--menu-drawer-animation-index: {{ animation_index }};"
        class="{%- if block_settings.drawer_accordion -%}menu-drawer__list-item--deep{%- else -%}menu-drawer__list-item--flat{%- endif -%}{% if block_settings.drawer_dividers %} menu-drawer__list-item--divider{% endif %}"
      >
        <a
          id="HeaderDrawer-customer-exclusive"
          href="{{ exclusive_coll.url }}"
          class="menu-drawer__menu-item menu-drawer__menu-item--mainlist menu-drawer__animated-element focus-inset{% if exclusive_link_active %} menu-drawer__menu-item--active{% endif %}"
          {% if exclusive_link_active %}
            aria-current="page"
          {% endif %}
        >
          <span class="menu-drawer__menu-item-text wrap-text">{{ menu_label | escape }}</span>
        </a>
      </li>
  {% endcase %}
{% endif %}
```

### 2) Integrações no header

#### `blocks/_header-menu.liquid`
- injeta o item:
  - na navigation bar: `variant: 'navigation_bar'`
  - no menu desktop: `variant: 'desktop'`

Trechos:

```liquid
{% render 'customer-exclusive-nav-link', variant: 'navigation_bar' %}
...
{% render 'customer-exclusive-nav-link', variant: 'desktop' %}
```

#### `snippets/header-drawer.liquid`
- injeta no drawer:

```liquid
{% render 'customer-exclusive-nav-link',
  variant: 'drawer',
  block_settings: block.settings,
  animation_index: animation_index | plus: 1
%}
```

## Port para o Dawn
- Criar `snippets/customer-exclusive-nav-link.liquid` no Dawn (mesma lógica).
- Integrar no menu do Dawn:
  - Desktop: `sections/header.liquid` (ou snippet de nav)
  - Drawer: `snippets/header-drawer.liquid` (Dawn tem um com o mesmo nome)
- Criar settings no `settings_schema.json` do Dawn:
  - tag, coleção, label

## Limitação (importante explicar)
Isso **não protege** a coleção por URL. É somente controle de visibilidade do item no menu.

