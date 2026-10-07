# madeleinehoffman — personal website

A single-page personal site that lives on GitHub Pages. Warm serif type
sits directly on slow water: the background is a WebGL shader that drifts
on its own, changes colour with the time of day, and answers every click
or tap with a small hand-drawn-looking ripple.

No frameworks, no build step. Three files do all the work:

| File | What it is |
| --- | --- |
| `index.html` | The content: Home, Currently, Projects, Dance, Contact. |
| `style.css` | Typography (Fraunces for headings, Lora for text), layout, the slowly drifting gradient on the name, wavy links, sections. |
| `ocean.js` | The water: swells, chop, lighting, the day-cycle palette, and the click-to-ripple effect. |

## Editing the content

Everything you'd normally edit is plain HTML in `index.html`. Each
`<section>` is one part of the site; the paragraphs and links inside it
are just text. The Dance section's videos are `<iframe>`s; to add one,
copy a `<div class="video">…</div>` block and change the `src`.

## Previewing locally

Any static file server works. For example:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. To preview the water at a specific
time of day, add `?hour=19.5` (0–24) to the URL. To watch the whole day
go by in two minutes, add `?cycle=120`.

## Publishing on GitHub Pages

1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick
   `main` and the `/ (root)` folder, and save.
3. After a minute the site is live at
   `https://mnhoffman.github.io/personal-website/`.

Every merge into `main` republishes the site automatically.

To serve it at `https://mnhoffman.github.io/` instead, rename the
repository to `mnhoffman.github.io`. To use a custom domain, add it under
**Settings → Pages → Custom domain** and point your DNS at GitHub.

The `.nojekyll` file tells Pages to publish the files exactly as they are.

## Tuning the water

Everything lives near the top of `ocean.js`:

- `KEYS` — the palette through the day. Each row is
  `[hour, deep, mid, shallow, glow]` with colours as 0–1 RGB. Dawn and
  sunset lean on the old site's lavender (#9B8BC7) and orange (#EDA074);
  midday is blue; night is indigo. Add, remove or recolour rows freely.
- `currentHour()` — the water wanders about forty minutes either side of
  the real time so the colour is never quite still.
- `swell()` — the big slow waves. Lower the amplitudes for a calmer sea.
- `chop()` — fine surface texture. Set its weight in `height()` to `0.0`
  for glassy water.
- `ripples()` — `front` controls how far a ring travels, `wob` how
  wobbly its outline is, and the `smoothstep(0.9, 2.4, age)` how quickly
  it fades.

The site respects `prefers-reduced-motion`: the water slows almost to a
stop and only animates while a ripple is alive.
