# Tarefa 04 — Nova seção “Vídeo e Texto”

## Objetivo
Criar uma seção “Vídeo e Texto” baseada na seção “Imagem e Texto”, com:
- mesmas opções de layout/estilo (cores, largura, posição, altura, etc.)
- mídia de vídeo suportando:
  - upload Shopify (arquivo)
  - URL do YouTube
  - URL do Vimeo
- validações:
  - se inválido, **não renderiza** no storefront
  - mostra placeholder **somente no editor** (design mode)
- responsivo (player mantém proporção)

## Arquivos (Horizon)

### 1) `sections/video-and-text.liquid`
- Define a seção e valida se existe vídeo válido:
  - Shopify video: `section.settings.video`
  - Externo: `section.settings.external_video_url` com `.id` e `.type`
- Em storefront, se não tem vídeo válido, aplica estado “missing media”.
- Renderiza a mídia via snippet `video-and-text-media`.

Trecho (validação + render):

```liquid
{% liquid
  assign has_valid_video = false
  assign vs = section.settings.video_source | default: 'shopify'
  if vs == 'shopify' and section.settings.video != blank
    assign has_valid_video = true
  endif
  if vs == 'external' and section.settings.external_video_url != blank
    assign ev_check = section.settings.external_video_url
    if ev_check.id != blank and ev_check.type != blank
      assign has_valid_video = true
    endif
  endif

  assign missing_media_storefront = false
  if has_valid_video == false and request.design_mode == false
    assign missing_media_storefront = true
  endif
%}

...
{% render 'video-and-text-media', section: section %}
```

### 2) `snippets/video-and-text-media.liquid`
- Decide fonte (`video_source`):
  - `shopify`: usa `video_tag` com autoplay/loop/playsinline
  - `external`: gera `<iframe>` de YouTube ou Vimeo com parâmetros de autoplay/loop
- Fallback no editor (`request.design_mode`): mostra texto `content.video_with_text_editor_empty`
- CSS do frame/viewport com `aspect-ratio: 16 / 9`

Código completo:

```liquid
{%- liquid
  assign src = section.settings.video_source | default: 'shopify'
  assign has_valid = false

  if src == 'shopify' and section.settings.video != blank
    assign has_valid = true
  endif

  if src == 'external' and section.settings.external_video_url != blank
    assign ev0 = section.settings.external_video_url
    assign ev0_type = ev0.type | downcase
    if ev0.id != blank
      if ev0_type == 'youtube' or ev0_type == 'vimeo'
        assign has_valid = true
      endif
    endif
  endif
-%}

<div
  class="
    media-block
    spacing-style
    {% if section.settings.video_layout == 'contain' %}media-block--contain{% endif %}
    {% unless has_valid %}media-block--video-text-empty{% endunless %}
  "
  style="
    --vtt-fit: {{ section.settings.video_layout | default: 'cover' | strip }};
  "
>
  {%- if has_valid -%}
    <div class="video-and-text__frame">
      <div class="video-and-text__viewport">
        {%- if src == 'shopify' -%}
          {{
            section.settings.video
            | video_tag:
              image_size: '2500x',
              autoplay: section.settings.video_autoplay,
              loop: section.settings.video_loop,
              muted: section.settings.video_autoplay,
              controls: true,
              playsinline: true,
              class: 'video-and-text__video-el'
          }}
        {%- else -%}
          {%- liquid
            assign external_title = section.settings.external_video_alt | default: shop.name | escape
            assign ev = section.settings.external_video_url
            assign ev_type = ev.type | downcase
            assign ap = section.settings.video_autoplay
            assign lp = section.settings.video_loop
          -%}
          {%- if ev_type == 'youtube' -%}
            {%- liquid
              assign video_src = 'https://www.youtube.com/embed/' | append: ev.id | append: '?rel=0&playsinline=1&controls=1'
              if ap
                assign video_src = video_src | append: '&autoplay=1&mute=1'
              endif
              if lp
                assign video_src = video_src | append: '&loop=1&playlist=' | append: ev.id
              endif
            -%}
            <iframe
              src="{{ video_src }}"
              class="video-and-text__iframe"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              title="{{ external_title }}"
              loading="lazy"
            ></iframe>
          {%- elsif ev_type == 'vimeo' -%}
            {%- liquid
              assign video_src = 'https://player.vimeo.com/video/' | append: ev.id | append: '?byline=0&title=0'
              if ap
                assign video_src = video_src | append: '&autoplay=1&muted=1'
              endif
              if lp
                assign video_src = video_src | append: '&loop=1'
              endif
            -%}
            <iframe
              src="{{ video_src }}"
              class="video-and-text__iframe"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowfullscreen
              title="{{ external_title }}"
              loading="lazy"
            ></iframe>
          {%- endif -%}
        {%- endif -%}
      </div>
    </div>
  {%- elsif request.design_mode -%}
    <div class="video-and-text__frame">
      <div class="video-and-text__viewport video-and-text__viewport--placeholder">
        <p class="video-and-text__editor-placeholder-text paragraph">
          {{- 'content.video_with_text_editor_empty' | t -}}
        </p>
      </div>
    </div>
  {%- endif -%}
</div>

{% stylesheet %}
  .video-and-text__frame {
    width: 100%;
    height: 100%;
    min-height: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(0.75rem, 3vw, 1.75rem);
    box-sizing: border-box;
  }

  .video-and-text__viewport {
    --vtt-radius: max(var(--border-radius, 0.5rem), 0.75rem);
    position: relative;
    width: 100%;
    max-width: min(100%, 56rem);
    margin-inline: auto;
    aspect-ratio: 16 / 9;
    border-radius: var(--vtt-radius);
    overflow: hidden;
    background: rgb(var(--color-foreground-rgb) / 0.05);
    border: 1px solid rgb(var(--color-foreground-rgb) / 0.08);
    box-shadow:
      0 4px 6px -1px rgb(var(--color-shadow-rgb, 0 0 0) / 0.08),
      0 20px 40px -12px rgb(var(--color-shadow-rgb, 0 0 0) / 0.18);
  }

  .video-and-text__viewport--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(1rem, 4vw, 2rem);
    aspect-ratio: 16 / 9;
    min-height: 10rem;
    border-style: dashed;
    border-width: 2px;
    background: rgb(var(--color-foreground-rgb) / 0.04);
    box-shadow: none;
  }

  .video-and-text__iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  .video-and-text__viewport video,
  .video-and-text__video-el {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: var(--vtt-fit, cover);
    object-position: center;
    display: block;
  }

  .video-and-text__editor-placeholder-text {
    margin: 0;
    max-width: 22rem;
    text-align: center;
    font-size: 0.95em;
    line-height: 1.45;
    color: rgb(var(--color-foreground-rgb) / 0.72);
  }

  .media-block--video-text-empty:not(:has(.video-and-text__viewport--placeholder)) {
    display: none;
  }
{% endstylesheet %}
```

## Port para o Dawn
- Copiar `sections/video-and-text.liquid` e `snippets/video-and-text-media.liquid` para o Dawn.
- Ajustar CSS/estruturas de grid para usar o layout do Dawn (classes e variáveis podem ser diferentes).
- Garantir que o schema da seção do Dawn tenha:
  - `video` (Shopify hosted video)
  - `external_video_url` (url do tipo video)
  - toggles autoplay/loop
  - texto alt para embed

