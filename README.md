# Discoverly — UI rebuild (preview)

A responsive Next.js + TypeScript recreation of the supplied Discoverly desktop and mobile references.

## Run locally
1. Install Node.js 20.9 or newer.
2. Open this folder in VS Code or a terminal.
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Run `npm run build` to check the production build.

## Current scope
- Rebuilt the main visual composition: muted sage background, forest-green hero, lime accent, serif headings, neumorphic controls, interest chips, inset filter controls, featured pick, match-score rings, trending cards, and Continue Watching progress track.
- Search and interest/category controls filter the illustrative cards locally. The sort control supports popularity order, example match-score order, and a basic date-label sort.
- Bookmark buttons are visual/local state only and do not persist after refresh.

## Not implemented yet
This is a UI prototype, not a connected product. Cards, metadata, match scores, and Continue Watching progress are example content. There is no YouTube API connection, real relevance model, login, persistent bookmarks/preferences, backend, or browser extension sync. Do not present example scores as verified ranking results.

## Next phase
Visually compare the UI against both supplied references, adjust remaining differences, then choose a real video data source and define the relevance-score formula before connecting search.
