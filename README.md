# Discoverly

Discoverly is a YouTube video discovery app. It presents a personalized Discovery
feed alongside a YouTube Trending chart, with search, filters, a shared country
selection, and a persistent Watch Later list.

## Technology

- Next.js 15 with the App Router
- React 19 and TypeScript
- Supabase Auth and database access
- YouTube Data API v3

## Features

- Discovery searches use rotating, curated queries informed by saved topic
  preferences. Users can also search YouTube directly.
- Trending uses YouTube's `videos.list` `mostPopular` chart and shares a
  searchable country selector with Discovery. Visitors must choose a supported
  country before either feed loads; there is no automatic country default.
  Both feeds, including refresh and pagination, request the selected country.
- Country choices are stored in browser localStorage under
  `discoverly:country-selection:v1:guest` for guests and
  `discoverly:country-selection:v1:<user-id>` for signed-in accounts. Guest and
  account selections are kept separate and are not merged on login.
- Discovery and Trending share one category list loaded for the selected
  country, while keeping their selected categories independent.
- Discovery and Trending maintain independent filters, loading, errors, refresh,
  and pagination state.
- Best Match uses available video metadata and preferred/excluded topics.
  Excluded topics are penalized, not filtered out.
- Discovery, Trending, and manual searches share one recent-video history,
  stored under `discoverly:recent-videos:v2:<user-id-or-guest>`. Guest and
  account histories are isolated and are not merged when signing in. Videos are
  recorded only after a card is at least 50% visible. History expires after 14
  days and is capped at 100 IDs. Existing Discovery and Trending history keys
  are merged into the canonical key before being removed.
- When history filtering leaves fewer than nine candidates, a feed can request
  up to two additional pages for that load or pagination action. Users can
  explicitly show the YouTube chart results again.
- Supabase authentication supports signup, login, and persistent sessions.
  Onboarding and the preferences page store preferred and excluded topics.
- Signed-in users can save and remove videos from Watch Later; saved videos
  persist in their account.

## Requirements

- Node.js 20.9 or newer
- A Supabase project configured for the application's existing auth and data
  tables
- A Google API key with YouTube Data API v3 enabled

## Local development

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create `.env.local` in the project root and set:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   YOUTUBE_API_KEY=your-youtube-data-api-key
   ```

   Keep real credentials out of source control. The YouTube API key is used by
   the server-side route and should not be exposed in client code.

3. Start the development server:

   ```sh
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Checks

```sh
npx.cmd tsc --noEmit
npx.cmd eslint app/page.tsx app/api/youtube/route.ts app/api/youtube/categories/route.ts lib/youtube-region.ts
npm run build
```

YouTube API availability, quota limits, and regional `mostPopular` charts
depend on Google's live API response and the configured API key. Both feeds use
the selected region code, and the shared category list is loaded for that
country.
