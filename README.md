# Discoverly

Discoverly is a YouTube video discovery app. It presents a personalized Discovery
feed alongside a separate YouTube popularity chart for Nigeria, with search,
filters, and a persistent Watch Later list.

## Technology

- Next.js 15 with the App Router
- React 19 and TypeScript
- Supabase Auth and database access
- YouTube Data API v3

## Features

- Discovery searches use rotating, curated queries informed by saved topic
  preferences. Users can also search YouTube directly.
- Trending uses YouTube's `videos.list` `mostPopular` chart with `regionCode=NG`,
  separate category selection, refresh, and pagination.
- Discovery and Trending maintain independent filters, loading, errors, refresh,
  and pagination state.
- Best Match uses available video metadata and preferred/excluded topics.
  Excluded topics are penalized, not filtered out.
- Recent Discovery and Trending history reduces repeated videos in the browser.
  Trending history is recorded when a card is at least half visible, expires
  after 14 days, and is capped at 100 videos per account (with a separate
  guest history). Users can explicitly show the YouTube chart results again.
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
npx.cmd eslint app/page.tsx app/api/youtube/route.ts
npm run build
```

YouTube API availability, quota limits, and the Nigeria `mostPopular` chart
depend on Google's live API response and the configured API key.
