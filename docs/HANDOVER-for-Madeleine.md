# Your website: where things stand

*Written 5 Nov 2026, at the end of the first Claude conversation that built the site. Read this when you come back to it or start a new conversation.*

## The site

**Live at:** https://mnhoffman.github.io/personal-website/
**Code at:** https://github.com/mnhoffman/personal-website (branch `main` is what's live; GitHub Pages republishes it within a minute or two of any change)

**What it is.** A film-photography-feeling personal site. The home page is a grainy sky that follows the real time of day in your browser (dusk oranges, blue-hour indigo, hazy day, stars at night) with your bio on it. Every other page is a cream journal sheet lying on that sky: a strip of 35mm film with your photos across the top, and torn, taped notes with the writing. The pages are Currently, Projects, Dance, Advice, Contact.

**The Advice page** holds 100-odd pages from the green notebook, straightened and cropped, in a pile that fills the sheet. Lower pages lie on top of higher ones so no page is ever fully covered. Click one to open it large; arrow keys move between them. The pile's order is fixed (it's whatever you last arranged), nothing is labelled, and "upload your own" goes to your Google Form.

## How to change things yourself (no Claude needed)

Two editor pages live inside the site. Both need the GitHub token you already set up, which lives in your browser. If you use a new browser, you'll be asked for it again: the page explains how to make one.

**Text:** https://mnhoffman.github.io/personal-website/edit/
Every piece of writing on the site, in page order, each with a toolbar (bold, italic, link, list, paragraph) and a live preview. Press Publish; live in a minute or two. Things you can't change here: the layout, the photos, which notes exist.

**Advice pile:** https://mnhoffman.github.io/personal-website/edit/advice.html
The pile exactly as the site shows it. Drag a page to move it. Hover a page for crop / white-out and remove. "Add pages" takes photos from your phone or computer. The crop is four corners you drag onto the page's corners; it straightens from there. White-out covers anything in a box with matching paper colour. Press Publish.

**Tips**
- After anything changes, hard refresh the site once (Cmd+Shift+R) if it looks stale.
- If an editor ever shows something odd, "Reload from GitHub" throws away unpublished edits and starts clean.
- The token can be revoked any time at github.com → Settings → Developer settings → Fine-grained tokens. Make a new one and paste it in the editor.

## Things that need a Claude conversation

Anything structural: a new page, a new note on a page, a new photo in a film strip, moving the charts, changing fonts or colours, the sky. Point the new conversation at the repository and at `docs/HANDOVER-for-Claude.md`, and tell it what you want. It should open a pull request for each change; you merge it on GitHub.

## Open threads and ideas we never got to

- **Home page** is the one page the scrapbook treatment never reached. One idea: your intro on a torn scrap pinned to the sky.
- **Captions** on the film-strip photos: there's an orange date-stamp style ready for them, but none are written.
- **Something on click** on the home page. The ocean's ripple was removed with the ocean; nothing replaced it. A shutter-flash that turns the page was the idea on the table.
- **Form submissions** for advice: approved pages still go into the pile by hand through the pile editor.
- **A blog post** on the Laffer-curve-of-time idea is mentioned on Currently; the site has no blog section. If you write it on Substack, link it; if you want it here, that's a new page.
- **Your Drive folder** of notebook photos and the PDF can go back to private; everything from them is in the repo.

## Things you decided along the way (so a new conversation doesn't re-ask)

- Sentence case, not lowercase. Mono headings (Courier Prime), EB Garamond body, Caveat handwriting for asides only.
- No boxes, nothing glossy. Grain and texture everywhere, but lines on the notepaper stay straight.
- Stars twinkle out of step; the sky must never flicker.
- Advice pages: no names or dates added by the site; the handwriting speaks for itself. One personal email on a page was blurred.
- Taped notes, torn edges on the notes only; the big sheet keeps straight edges.
