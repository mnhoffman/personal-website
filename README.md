# madeleinehoffman — personal website

A personal site that lives on GitHub Pages. The home page is a grainy
film sky that follows the time of day (dusk oranges, blue-hour indigo,
hazy daylight, stars at night) with a few lines of text on it. Every
other page is a journal lying on that sky: textured paper, a strip of
film across it, and notes scattered on the page.

No frameworks, no build step. Four files do all the work:

| File | What it is |
| --- | --- |
| `index.html` | The content: Home, Currently, Projects, Dance, Contact. |
| `style.css` | Typography (Courier Prime, Lora, Caveat for marginalia, VT323 for date stamps), the journal paper, film strips, notes. |
| `sky.js` | The sky: the day-cycle palette, slow noise, stars, the horizon silhouette, grain. Also switches the text colour when the sky is bright. |
| `pages.js` | Shows one page at a time by URL hash. |

## Editing the content

After changing `style.css`, `sky.js` or `pages.js`, bump the `?v=`
number on their links in `index.html`. Browsers and GitHub Pages cache
those files, and without the bump a visitor can get new HTML with an old
stylesheet, which looks badly broken.

Everything you'd normally edit is plain HTML in `index.html`. Each
`<section class="page">` is one page. Inside a journal page:

- `<article class="note">` is one note on the paper. Add or remove them freely.
- `<div class="strip">` is the film strip. Each `<figure class="frame">`
  is one frame. The frames currently hold placeholder sky gradients
  (`<div class="photo" style="--sky-a:…">`) with made-up captions. To use
  a real photo, replace the `.photo` div with
  `<img src="photos/your-photo.jpg" alt="">` and change the caption.
- `.hand` is handwriting, for short asides only.

The Dance strip holds the three performance videos as frames.

## Previewing locally

Any static file server works. For example:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>. To preview the sky at a specific
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

## Tuning the sky

Everything lives near the top of `sky.js`:

- `KEYS` — the palette through the day. Each row is
  `[hour, horizon, middle, zenith, glow, night]` with colours as 0–1 RGB
  and `night` from 0 to 1 fading the stars in.
- `currentHour()` — the sky wanders about twenty minutes either side of
  the real time so the colour is never quite still.
- In the shader: `t = u_time * 0.012` sets how fast the colour bands
  drift; `gf = u_time * 1.1` how fast the grain changes and the `0.06`
  how heavy it is; the `hz` line draws the horizon silhouette.
- The text colour switch happens in `updateInk()`.

The site respects `prefers-reduced-motion`: the sky holds still and only
refreshes its colours with the clock.
