# Handover for the next Claude

*State as of 5 Nov 2026. The owner is Madeleine Hoffman (GitHub `mnhoffman`). Read this before touching anything.*

## Working agreement (learned the hard way; follow it)

1. **Every change goes through a pull request to `main`.** Branch, commit, push, open the PR, give her the link. She merges on GitHub. Never push to `main`.
2. **Before every push, check whether the last PR was merged** (`git fetch origin main && git log origin/main..HEAD`). If it was, start a fresh branch from `origin/main` and open a *new* PR. She merges fast, often between your pushes; pushing onto a merged branch leaves orphan commits with no PR. This happened four times.
3. **Bump the asset version** on every change to `style.css`, `sky.js`, `pages.js`, `content.js` or `advice.js`: the `?v=NN` on their links in `index.html` (currently `v=48`). GitHub Pages and browsers cache hard; without the bump she sees a broken mix of old and new. The editors load their scripts with a timestamp instead, so they never need it.
4. **Render before you push.** Playwright + Chromium are installed (`/opt/node-tools/node_modules/playwright`, launch with `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`). Serve with `python3 -m http.server 8123`, open `index.html?hour=18.8#page` (`?hour=` freezes the sky), screenshot, look at it. Send her the render.
5. **Commit as her** (`-c user.name="Madeleine Hoffman" -c user.email="mnhoffman254@gmail.com"`) with the Co-Authored-By trailer. No model names in commits or code.
6. **Don't apologise for ambiguity; do what she said, show it, adjust.** She reacts to renders, not descriptions. When a direction is wrong she says so plainly; just change course.
7. **Her content edits land on `main` directly** via the editors (commits like "Update Currently (via /edit/)" and "Arrange the advice pile (via /edit/)"). Always `git fetch` and start from `origin/main` so you don't clobber them. Never regenerate `content.json` or `advice/entries.json` from stale copies.

## Taste (hard-won; don't relitigate)

- **Rejected:** elegant/luxury serif over gradients (Cormorant), uppercase letterspaced nav, hairline rules, glossy/specular anything, random hover motion, CSS-column layouts (they drop rotated items), a deckled whole-sheet with scraps/paperclips ("doesn't look right"), wobbly ruled lines.
- **Loved:** the mono headline font, torn taped notes, film strips at varied angles, the pile overlapping like real paper, shingle stacking (lower over higher), EB Garamond, cream paper with tooth, straight ruling aligned to baselines.
- **Sentence case** for now ("might change my mind").
- Film grain that *breathes* (crossfaded, ~1/s), never flickers. Stars twinkle out of step.
- She's picky about fonts and says so; take it as fast feedback, not friction.
- Less is more on the home page: no birds, shooting stars, lens flares.

## Architecture (five files do everything; no build step)

```
index.html      all pages as <section class="page">; one shown at a time by hash
style.css       everything visual; --ink flips to dark when sky is bright
sky.js          WebGL film sky; KEYS = palette by hour; data-sky attr on <html>
pages.js        hash router; sets title; "← back to the sky" links
content.js      fills [data-content] elements from content.json via marked
content.json    ALL the words (markdown). Edited by /edit/. Source of truth.
advice.js       lays out the pile (absolute positions, masonry, shingle z); exposes window.advicePile.layout
advice/         entry-NNN.jpg pages + entries.json {entries:[{src,w,h}]} in pile order
photos/         film-strip photos (1600px, metadata stripped) + the two sleep charts
vendor/         marked.umd.js (MIT)
edit/index.html + edit.js        text editor (SCHEMA lists the fields)
edit/advice.html + advice-edit.js  pile editor (drag, crop, remove, add, publish)
edit/crop.js                     four-corner perspective crop + white-out
edit/common.js                   GitHub contents API, token in localStorage key mh-site-editor-token
docs/                            these handovers
```

**Projects page** uses two independent `.col` flex columns (not the grid) so notes of different heights don't leave gaps. Left: note1 (substack), note3 (Project Donor), note4 (vibecoded list). Right: charts figure, note2 (sleep, tucked under charts with negative margin), note5 (random questions). Other pages still use the 2-column grid in `.paper`. Adding a note = add an `<article class="note nN" data-content="section.noteN">` in `index.html` (fallback text inside), the key in `content.json`, and a field in `SCHEMA` in `edit/edit.js`.

**Notes** are three layers: `.note::before` is the torn paper (SVG displacement filter `#torn`/`#torn2` in index.html, grain + mottle + tooth), `.note::after` is the ruling (own layer, `#wobble` filter, very gentle; period 1.55em phased to the first baseline), text on top. Tape is `.note > :first-child::before`.

**Advice pile**: `advice.js` `layout(entries, W, rem)` is pure; 5 columns >760px, 4 >520, else 2; page width 1.18×column; tuck 1.8rem; tilt/offset derived from a hash of the filename (stable); z = vertical position (shingles); left clamped so nothing exits the sheet; no clipping. The editor calls the same function so WYSIWYG holds. `entries.json` order = pile order. Adding pages by hand: drop JPG in `advice/`, add `{src,w,h}`.

**Processing new notebook photos by script** (if she sends a batch outside the editor): `/tmp/.../scratchpad/tools/straighten.py` won't survive; the method was: Sobel-y edge map, score rotation angles ±14° by variance of row sums, rotate, crop to largest bright low-saturation blob, flatten illumination in LAB, cap 1400px, JPEG 84. Steeply-angled photos need the perspective route (vanishing point of ruled lines → homography), which the in-browser crop now does by hand.

## Network and environment notes

- Carrd, Pinterest, friends' sites, Drive were all blocked by the environment allowlist at first. She allowed `madeleinehoffman.carrd.co`, `drive.google.com`, `drive.usercontent.google.com`. The friends' inspiration sites (harshul.org, christinecorry.com, helenatran.com, eviehu612.github.io) were never fetched; if style questions come up, ask her to allow them or describe them.
- The Google Drive connector is signed in as `mnhoffman@uchicago.edu`; the folder of notebook photos was shared to that account. 10 MB file limit on the connector; bigger files via a public link once the domain is allowed.
- Upload limit in chat is 5 images per message.

## Open items (see her handover for the human version)

- Home page untouched by scrapbook treatment; idea: intro on a torn scrap.
- Film-strip captions: `.frame figcaption` style exists (orange VT323), none written.
- No click interaction on home since the ocean went. Idea: shutter flash → next page.
- Advice form submissions still added by hand via the pile editor.
- The two editors share one token; fine-grained PAT, Contents: read/write, this repo only.

## PR history (for orientation)

1–3 ocean era and page routing · 4–5 sky/journal redesign, fonts, torn notes · 6 (closed, unmerged: still stars) · 7 photos · 8 advice page · 9–15 pile layout iterations, torn notes, straight ruling, grain, Currently update · 16 text editor · 17–21 pile editor, white-out, shingle, cache fixes · 22 home trims, lab link, Projects notes + charts, columns.
