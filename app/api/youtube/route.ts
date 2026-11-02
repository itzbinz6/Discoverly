
import { NextResponse } from "next/server";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

type YouTubeSearchResponse = {
  nextPageToken?: string;
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

type YouTubeCategoriesResponse = {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      assignable: boolean;
    };
  }>;
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
    const query = searchParams.get("q")?.trim() ?? "";
    const categoryId = searchParams.get("categoryId")?.trim();
    const pageToken = searchParams.get("pageToken")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "A search query is required." },
        { status: 400 }
      );
    }

    if (categoryId && !/^\d+$/.test(categoryId)) {
      return NextResponse.json(
        { error: "Invalid YouTube category ID." },
        { status: 400 }
      );
    }

    const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);

    const youtubeParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "30",
      order: "relevance",
      q: query,
      regionCode: "NG",
      key: apiKey,
    });

    if (categoryId) {
      youtubeParams.set("videoCategoryId", categoryId);
    }

    if (pageToken) {
      youtubeParams.set("pageToken", pageToken);
    }

    searchUrl.search = youtubeParams.toString();

    const categoriesUrl = new URL(
      `${YOUTUBE_API_URL}/videoCategories`
    );

    categoriesUrl.search = new URLSearchParams({
      part: "snippet",
      regionCode: "NG",
      key: apiKey,
    }).toString();

    const [searchResponse, categoriesResponse] = await Promise.all([
      fetch(searchUrl),
      fetch(categoriesUrl, {
        next: { revalidate: 3600 },
      }),
    ]);

    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      console.error("YouTube search error:", error);

      return NextResponse.json(
        { error: "Could not retrieve YouTube videos." },
        { status: searchResponse.status }
      );
    }

    const searchData =
      (await searchResponse.json()) as YouTubeSearchResponse;

    let categories: YouTubeCategoriesResponse["items"] = [];

    if (categoriesResponse.ok) {
      const categoriesData =
        (await categoriesResponse.json()) as YouTubeCategoriesResponse;

      categories = (categoriesData.items ?? []).filter(
        (item) => item.snippet.assignable
      );
    } else {
      console.error(
        "Could not retrieve YouTube categories:",
        await categoriesResponse.text()
      );
    }

    const categoryNames = new Map(
      (categories ?? []).map((item) => [
        item.id,
        item.snippet.title,
      ])
    );

    const videoIds = (searchData.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      return NextResponse.json({
        videos: [],
        categories: (categories ?? []).map((item) => ({
          id: item.id,
          name: item.snippet.title,
        })),
        nextPageToken: searchData.nextPageToken ?? null,
      });
    }

    const detailsUrl = new URL(`${YOUTUBE_API_URL}/videos`);

    detailsUrl.search = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: videoIds.join(","),
      key: apiKey,
    }).toString();

    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      const error = await detailsResponse.json();
      console.error("YouTube video details error:", error);

      return NextResponse.json(
        { error: "Could not retrieve video details." },
        { status: detailsResponse.status }
      );
    }

    const detailsData =
      (await detailsResponse.json()) as YouTubeVideosResponse;

    const videos = (detailsData.items ?? []).map((video) => ({
      id: video.id,
      title: video.snippet.title,
      creator: video.snippet.channelTitle,
      thumbnail:
        video.snippet.thumbnails?.high?.url ??
        video.snippet.thumbnails?.medium?.url ??
        video.snippet.thumbnails?.default?.url ??
        "",
      views: Number(video.statistics?.viewCount ?? 0),
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      categoryId: video.snippet.categoryId ?? "",
      category:
        categoryNames.get(video.snippet.categoryId ?? "") ?? "Other",
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    return NextResponse.json({
      videos,
      categories: (categories ?? []).map((item) => ({
        id: item.id,
        name: item.snippet.title,
      })),
      nextPageToken: searchData.nextPageToken ?? null,
    });
  } catch (error) {
    console.error("YouTube API route error:", error);

    return NextResponse.json(
      { error: "Something went wrong while fetching videos." },
      { status: 500 }
    );
  }
}
