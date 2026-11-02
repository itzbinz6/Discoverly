
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

    // Get the search query and optional category ID.
    const query = searchParams.get("q")?.trim() ?? "";
    const categoryId = searchParams.get("categoryId")?.trim();

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

    // Build YouTube search request.
    const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);

    const searchParamsForYouTube = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "30",
      order: "relevance",
      q: query,
      regionCode: "NG",
      key: apiKey,
    });

    if (categoryId) {
      searchParamsForYouTube.set("videoCategoryId", categoryId);
    }

    searchUrl.search = searchParamsForYouTube.toString();

    // Fetch available YouTube categories.
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

    const videoIds = (searchData.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));

    // Retrieve category information.
    let categories: YouTubeCategoriesResponse["items"] = [];

    if (categoriesResponse.ok) {
      const categoriesData =
        (await categoriesResponse.json()) as YouTubeCategoriesResponse;

      categories = (categoriesData.items ?? []).filter(
        (category) => category.snippet.assignable
      );
    } else {
      console.error(
        "Could not retrieve YouTube categories:",
        await categoriesResponse.text()
      );
    }

    const categoryNames = new Map(
      (categories ?? []).map((category) => [
        category.id,
        category.snippet.title,
      ])
    );

    // Return an empty video list if no videos were found.
    if (videoIds.length === 0) {
      return NextResponse.json({
        videos: [],
        categories: (categories ?? []).map((category) => ({
          id: category.id,
          name: category.snippet.title,
        })),
      });
    }

    // Retrieve full details for the videos.
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
      categories: (categories ?? []).map((category) => ({
        id: category.id,
        name: category.snippet.title,
      })),
    });
  } catch (error) {
    console.error("YouTube API route error:", error);

    return NextResponse.json(
      { error: "Something went wrong while fetching videos." },
      { status: 500 }
    );
  }
}
