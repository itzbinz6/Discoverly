
import { NextResponse } from "next/server";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

type YouTubeSearchResponse = {
  items?: Array<{ id?: { videoId?: string } }>;
};

type YouTubeVideo = {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    categoryId?: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: { duration: string };
  statistics?: { viewCount?: string };
};

type YouTubeVideosResponse = {
  items?: YouTubeVideo[];
};

export async function GET(request: Request) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "YouTube API key is not configured." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "A search query is required." },
        { status: 400 }
      );
    }

    const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);
    searchUrl.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "12",
      order: "relevance",
      q: query,
      key: apiKey,
    }).toString();

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      console.error("YouTube search error:", error);

      return NextResponse.json(
        { error: "Could not retrieve YouTube videos." },
        { status: searchResponse.status }
      );
    }

    const searchData = (await searchResponse.json()) as YouTubeSearchResponse;
    const videoIds = (searchData.items ?? [])
      .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    const detailsUrl = new URL(`${YOUTUBE_API_URL}/videos`);
    detailsUrl.search = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: videoIds.join(","),
      key: apiKey,
    }).toString();

    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      return NextResponse.json(
        { error: "Could not retrieve video details." },
        { status: detailsResponse.status }
      );
    }

    const detailsData = (await detailsResponse.json()) as YouTubeVideosResponse;

    const videos = (detailsData.items ?? []).map((video) => ({
      id: video.id,
      title: video.snippet.title,
      creator: video.snippet.channelTitle,
      thumbnail:
        video.snippet.thumbnails?.high?.url ??
        video.snippet.thumbnails?.medium?.url ??
        video.snippet.thumbnails?.default?.url,
      views: Number(video.statistics?.viewCount ?? 0),
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      categoryId: video.snippet.categoryId,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube API route error:", error);

    return NextResponse.json(
      { error: "Something went wrong while fetching videos." },
      { status: 500 }
    );
  }
}
