# madeleinehoffman — personal website

A single-page personal site that lives on GitHub Pages. Serif type sits
directly on a living ocean: the background is a WebGL shader that rolls
slowly on its own, and every click or tap drops a ripple into it.

No frameworks, no build step. Three files do all the work:

| File | What it is |
| --- | --- |
| `index.html` | The content. Every section is marked with a `<!-- REPLACE -->` comment where your own words go. |
| `style.css` | Typography (Cormorant Garamond), layout, the shimmering name, buttons, sections. |
| `ocean.js` | The water. Swells, chop, lighting, and the click-to-ripple effect. |

## Editing the content

Open `index.html` and look for `<!-- REPLACE -->`. The sections, in order:

1. **Home** — name, tagline, two buttons, social icons.
2. **About** — a paragraph or two.
3. **Work** — a list of projects or roles; each `<li>` is one item.
4. **Contact** — one line and a button.

Swap `mailto:you@example.com` for your real address and point the social
icons at your profiles (or delete any you don't use).

## Previewing locally

Any static file server works. For example:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Opening `index.html` straight from the
filesystem also works in most browsers.)

## Publishing on GitHub Pages

1. Merge this branch into `main`.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick
   `main` and the `/ (root)` folder, and save.
4. After a minute the site is live at
   `https://mnhoffman.github.io/personal-website/`.

To serve it at `https://mnhoffman.github.io/` instead, rename the
repository to `mnhoffman.github.io`. To use a custom domain, add it under
**Settings → Pages → Custom domain** and point your DNS at GitHub.

The `.nojekyll` file tells Pages to publish the files exactly as they are.

## Tuning the water

Everything lives at the top of the fragment shader in `ocean.js`:

- `swell()` — the big slow waves. Lower the amplitudes for a calmer sea.
- `chop()` — fine surface texture. Set its weight in `height()` to `0.0` for glassy water.
- `ripples()` — `front` controls how fast a ring expands, `42.0` is the
  ring spacing, `exp(-age * 0.75)` how quickly it fades.
- The palette (`deep`, `mid`, `shal`, `foam`) sets the colours from the
  horizon down to the near shore.

The site respects `prefers-reduced-motion`: the sea slows almost to a
stop and only animates while a ripple is alive.
