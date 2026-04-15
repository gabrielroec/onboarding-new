# Tarefa 07 — Menu exclusivo por tag do cliente (Dawn)

Este documento é um guia “de A a Z” para implementar no **tema Dawn (Online Store 2.0)** um item extra no menu principal que aponta para uma **coleção exclusiva**, mas aparece **somente** para clientes **logados** que possuem uma **tag específica** (ex.: `funcionario`).

> **Importante (limitação)**: isso **não protege** a coleção por URL. É apenas um controle de **visibilidade do link** no menu. Quem tiver o link ainda pode abrir a coleção.

---

## 1) Entendendo o Dawn (onde mexer e por quê)

No Dawn, o menu principal nasce em `sections/header.liquid`:

- O menu é um setting do tipo **`link_list`**.
- O header renderiza o menu em **dois contextos**:
  - **Mobile drawer**: `snippets/header-drawer.liquid`
  - **Desktop**: `snippets/header-dropdown-menu.liquid` ou `snippets/header-mega-menu.liquid` (conforme `menu_type_desktop`)

Isso define a regra de ouro:

- a decisão “mostra ou não mostra o link exclusivo?” deve ser calculada **uma vez** no `header.liquid`
- e repassada para os snippets com `{% render %}`, porque `render` **não herda** variáveis `assign` do arquivo pai

---

## 2) Requisito funcional

Mostrar um item extra no menu, apontando para uma coleção configurada, quando:

- o cliente está logado (`customer` existe)
- e `customer.tags` contém a tag configurada (ex.: `funcionario`)

O item extra deve aparecer em:

- menu desktop (dropdown **e** mega)
- menu mobile drawer

---

## 3) Configuração pelo editor do tema (o que a loja consegue editar)

Os settings ficam **na seção Header** (não em “Configurações do tema”).

Na seção **Header**, adicionamos:

- **Tag do cliente** (`exclusive_menu_customer_tag`)
- **Coleção exclusiva** (`exclusive_menu_collection`)
- **Texto do link** (`exclusive_menu_label`) — opcional, com fallback para o título da coleção

---

## 4) Arquivos envolvidos

### 4.1 Código (Liquid)

- `sections/header.liquid`
- `snippets/header-drawer.liquid`
- `snippets/header-dropdown-menu.liquid`
- `snippets/header-mega-menu.liquid`
- `snippets/customer-exclusive-nav-link.liquid` (novo/ajustado)

### 4.2 Traduções do schema (Editor do tema)

- `locales/en.default.schema.json`
- `locales/pt-BR.schema.json`

---

## 5) Implementação (código pronto para copiar)

### 5.1 `sections/header.liquid` — settings no schema

No schema de `sections/header.liquid`, dentro do array `"settings": [...]`, adicione este bloco (ele deve ficar em uma posição lógica do editor; neste projeto ele entra antes de “spacing/padding”):

```json
{
  "type": "header",
  "content": "t:sections.header.settings.header__exclusive_menu.content"
},
{
  "type": "paragraph",
  "content": "t:sections.header.settings.paragraph__exclusive_menu.content"
},
{
  "type": "text",
  "id": "exclusive_menu_customer_tag",
  "label": "t:sections.header.settings.exclusive_menu_customer_tag.label",
  "info": "t:sections.header.settings.exclusive_menu_customer_tag.info",
  "default": "employee-access"
},
{
  "type": "collection",
  "id": "exclusive_menu_collection",
  "label": "t:sections.header.settings.exclusive_menu_collection.label",
  "info": "t:sections.header.settings.exclusive_menu_collection.info"
},
{
  "type": "text",
  "id": "exclusive_menu_label",
  "label": "t:sections.header.settings.exclusive_menu_label.label",
  "info": "t:sections.header.settings.exclusive_menu_label.info",
  "default": "Exclusivo"
}
```

#### Por que os defaults não são vazios?

O Shopify pode rejeitar schema de seção quando `type: "text"` usa `default: ""`. Por isso usamos valores padrão.
Na prática, o QA/merchant vai configurar no editor (ex.: tag `funcionario`).

---

### 5.2 `sections/header.liquid` — cálculo da regra (uma vez só)

Logo após a definição do `header_tag` (antes do HTML do header), calcule:

```liquid
{% liquid
  assign exclusive_allowed_tag = section.settings.exclusive_menu_customer_tag | strip
  assign exclusive_collection_setting = section.settings.exclusive_menu_collection
  assign exclusive_nav_label = section.settings.exclusive_menu_label | strip

  if exclusive_nav_label == blank and exclusive_collection_setting != blank
    assign exclusive_nav_label = exclusive_collection_setting.title
  endif

  assign show_exclusive_menu_item = false
  if customer and exclusive_allowed_tag != blank and exclusive_collection_setting != blank and exclusive_nav_label != blank
    if customer.tags contains exclusive_allowed_tag
      assign show_exclusive_menu_item = true
    endif
  endif
%}
```

#### O que cada linha faz

- `strip`: remove espaços extras no começo/fim (evita tag “` funcionario`”).
- `exclusive_nav_label`: se ficar vazio, cai no fallback `collection.title`.
- `show_exclusive_menu_item`: só ativa quando **tudo** está preenchido e o cliente tem a tag.

---

### 5.3 `sections/header.liquid` — repassar variáveis para os snippets

Quando o Dawn renderiza menu, precisamos passar as variáveis:

- `show_exclusive_menu_item`
- `exclusive_nav_label`
- `exclusive_collection`

> **Atenção**: dentro de `{% liquid %}`, mantenha o `render` em **uma linha**, para evitar erro de parser.

#### Drawer (mobile)

```liquid
{% liquid
  if section.settings.menu != blank
    render 'header-drawer', show_exclusive_menu_item: show_exclusive_menu_item, exclusive_nav_label: exclusive_nav_label, exclusive_collection: exclusive_collection_setting
  endif
%}
```

#### Desktop (dropdown/mega)

```liquid
{% liquid
  if section.settings.menu != blank
    if section.settings.menu_type_desktop == 'dropdown'
      render 'header-dropdown-menu', show_exclusive_menu_item: show_exclusive_menu_item, exclusive_nav_label: exclusive_nav_label, exclusive_collection: exclusive_collection_setting
    elsif section.settings.menu_type_desktop != 'drawer'
      render 'header-mega-menu', show_exclusive_menu_item: show_exclusive_menu_item, exclusive_nav_label: exclusive_nav_label, exclusive_collection: exclusive_collection_setting
    endif
  endif
%}
```

---

### 5.4 `snippets/customer-exclusive-nav-link.liquid` — snippet reutilizável do item extra

Crie/ajuste o snippet `snippets/customer-exclusive-nav-link.liquid` com este conteúdo:

```liquid
{% comment %}
  Item extra do menu para clientes com tag configurada (settings da seção Header).
  Parâmetros repassados pelo header (render não herda assigns do pai):
  - show_exclusive_menu_item, exclusive_collection, exclusive_nav_label
  - variant: desktop | drawer
{% endcomment %}

{% liquid
  assign exclusive_coll = exclusive_collection
  assign menu_label = exclusive_nav_label | strip

  if exclusive_coll != blank and menu_label == blank
    assign menu_label = exclusive_coll.title
  endif

  assign exclusive_link_active = false
  if show_exclusive_menu_item and exclusive_coll != blank and menu_label != blank
    if template.name == 'collection' and collection and exclusive_coll.handle == collection.handle
      assign exclusive_link_active = true
    endif
  endif
%}

{% if show_exclusive_menu_item and exclusive_coll != blank and menu_label != blank %}
  {% case variant %}
    {% when 'desktop' %}
      <li>
        <a
          id="HeaderMenu-customer-exclusive"
          href="{{ exclusive_coll.url }}"
          class="header__menu-item list-menu__item link link--text focus-inset"
          {% if exclusive_link_active %}
            aria-current="page"
          {% endif %}
        >
          <span
            {% if exclusive_link_active %}
              class="header__active-menu-item"
            {% endif %}
          >
            {{- menu_label | escape -}}
          </span>
        </a>
      </li>

    {% when 'drawer' %}
      <li>
        <a
          id="HeaderDrawer-customer-exclusive"
          href="{{ exclusive_coll.url }}"
          class="menu-drawer__menu-item list-menu__item link link--text focus-inset{% if exclusive_link_active %} menu-drawer__menu-item--active{% endif %}"
          {% if exclusive_link_active %}
            aria-current="page"
          {% endif %}
        >
          {{ menu_label | escape }}
        </a>
      </li>
  {% endcase %}
{% endif %}
```

---

### 5.5 Inserção do item extra nos menus do Dawn

O item extra deve entrar **após** o loop do menu principal, como “mais um `<li>`”.

#### `snippets/header-dropdown-menu.liquid`

No final do `<ul>` do menu, renderize assim:

```liquid
{% render 'customer-exclusive-nav-link',
  variant: 'desktop',
  show_exclusive_menu_item: show_exclusive_menu_item,
  exclusive_nav_label: exclusive_nav_label,
  exclusive_collection: exclusive_collection
%}
```

#### `snippets/header-mega-menu.liquid`

Mesmo render acima, no final do `<ul>`.

#### `snippets/header-drawer.liquid`

No final do `<ul>` principal do drawer:

```liquid
{% render 'customer-exclusive-nav-link',
  variant: 'drawer',
  show_exclusive_menu_item: show_exclusive_menu_item,
  exclusive_nav_label: exclusive_nav_label,
  exclusive_collection: exclusive_collection
%}
```

---

## 6) Traduções do Editor (schema)

Para o editor mostrar labels e infos, adicione as chaves em:

- `locales/pt-BR.schema.json` → dentro de `sections.header.settings`
- `locales/en.default.schema.json` → dentro de `sections.header.settings`

Chaves usadas (exemplos):

- `header__exclusive_menu.content`
- `paragraph__exclusive_menu.content`
- `exclusive_menu_customer_tag.label` / `.info`
- `exclusive_menu_collection.label` / `.info`
- `exclusive_menu_label.label` / `.info`

---

## 7) QA — como testar (passo a passo bem ABC)

Pense como QA: você precisa provar que funciona no desktop e no mobile, e que não aparece quando não deve.

### A) Preparar dois clientes

1. Vá em **Shopify Admin → Clientes**.
2. Escolha (ou crie) 2 clientes:
   - **Cliente A (com acesso)**: terá a tag `funcionario`
   - **Cliente B (sem acesso)**: não terá essa tag
3. No **Cliente A**, adicione a tag exatamente: `funcionario`
4. Salve.

### B) Preparar uma coleção exclusiva

1. Vá em **Shopify Admin → Produtos → Coleções**.
2. Crie/seleciona uma coleção que será o destino do link (ex.: “Área do Funcionário”).

### C) Configurar no Editor do Tema (Header)

1. Vá em **Shopify Admin → Loja virtual → Temas**.
2. No tema, clique em **Personalizar**.
3. Na barra lateral esquerda, clique em **Cabeçalho / Header**.
4. Ache o grupo **“Menu de coleção exclusiva”**.
5. Preencha:
   - **Tag do cliente**: `funcionario`
   - **Coleção exclusiva**: selecione a coleção criada no passo B
   - **Texto do link**: (opcional) “Área do Funcionário”
6. Clique em **Salvar**.

> **Onde fica?** Na seção **Header**. Não fica em “Configurações do tema”.

### D) Testes de comportamento (o que deve acontecer)

#### Teste 1 — não logado
1. Abra a loja em janela anônima.
2. Abra o menu no desktop.
3. Abra o menu no mobile (drawer).
4. **Esperado:** o item extra **não aparece**.

#### Teste 2 — logado sem tag
1. Faça login como **Cliente B** (sem tag).
2. Abra menu desktop e drawer.
3. **Esperado:** o item extra **não aparece**.

#### Teste 3 — logado com tag
1. Faça login como **Cliente A** (com tag `funcionario`).
2. Abra o menu desktop.
3. **Esperado:** o item extra **aparece**.
4. Abra o menu drawer.
5. **Esperado:** o item extra **aparece** no drawer também.

#### Teste 4 — clique e estado ativo
1. Clique no item extra.
2. **Esperado:** abre a coleção configurada.
3. Já na coleção, verifique se o link fica “ativo”:
   - desktop: `aria-current="page"` e/ou estilo de item ativo
   - drawer: classe `menu-drawer__menu-item--active`

### E) Testes de “falhas” de configuração

- **Tag vazia no Header**: item nunca aparece.
- **Coleção não selecionada**: item nunca aparece.
- **Label vazio**: usa o título da coleção (deve aparecer com esse texto).
- **Menu type = Dropdown**: deve funcionar.
- **Menu type = Mega**: deve funcionar.
- **Menu type = Drawer**: o desktop também usa drawer; o item deve aparecer no drawer.

---

## 8) Observações e edge cases

- **A tag precisa bater** com o que existe em `customer.tags`. Use exatamente `funcionario`.
- **Sem JavaScript**: a decisão é 100% Liquid.
- **Sem duplicar menu**: apenas inserimos um `<li>` extra, reaproveitando a estrutura original.

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

