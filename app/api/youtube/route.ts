
import { NextResponse } from "next/server";
import { validateSupportedRegion } from "../../../lib/youtube-region";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

type YouTubeSearchResponse = {
  nextPageToken?: string;
  items?: Array<{ id?: { videoId?: string } }>;
};

type YouTubeVideo = {
  id: string;
  snippet: {
    title: string;
    description?: string;
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
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

type YouTubeVideosResponse = {
  nextPageToken?: string;
  items?: YouTubeVideo[];
};

export async function GET(request: Request) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return noStoreJson(
        { error: "YouTube API key is not configured." },
        500
      );
    }
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const categoryId = searchParams.get("categoryId")?.trim();
    const requestedRegionCode = searchParams.get("regionCode");
    const pageToken = searchParams.get("pageToken")?.trim();
    const requestedMaxResults = searchParams.get("maxResults");
    const maxResults = requestedMaxResults
      ? Number(requestedMaxResults)
      : 9;

    const regionCode = requestedRegionCode?.trim().toUpperCase() ?? "";
    if (!/^[A-Z]{2}$/.test(regionCode)) {
      return noStoreJson(
        { error: "Select a valid YouTube region.", errorCode: "invalid_region" },
        400
      );
    }

    if (
      !Number.isInteger(maxResults) ||
      maxResults < 1 ||
      maxResults > 50
    ) {
      return noStoreJson({ error: "Invalid YouTube maxResults value." }, 400);
    }

    if (categoryId && !/^\d+$/.test(categoryId)) {
      return noStoreJson({ error: "Invalid YouTube category ID." }, 400);
    }

    const requestedOrder = searchParams.get("order");
    const order =
      requestedOrder === "date" || requestedOrder === "viewCount"
        ? requestedOrder
        : "relevance";

    if (
      requestedOrder &&
      !["date", "relevance", "viewCount"].includes(requestedOrder)
    ) {
      return noStoreJson({ error: "Invalid YouTube search order." }, 400);
    }

    if (!query) {
      return noStoreJson({ error: "A search query is required." }, 400);
    }

    const regionValidationError = await validateSupportedRegion(
      regionCode,
      apiKey
    );
    if (regionValidationError) {
      return noStoreJson(
        {
          error: regionValidationError.error,
          errorCode: regionValidationError.errorCode,
        },
        regionValidationError.status
      );
    }

    const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);

    const youtubeParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: String(maxResults),
      order,
      q: query,
      regionCode,
      key: apiKey,
    });

    if (categoryId) {
      youtubeParams.set("videoCategoryId", categoryId);
    }

    if (pageToken) {
      youtubeParams.set("pageToken", pageToken);
    }

    searchUrl.search = youtubeParams.toString();

    const searchResponse = await fetch(searchUrl, { cache: "no-store" });

    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      console.error("YouTube search error:", error);

      return noStoreJson(
        { error: "Could not retrieve YouTube videos." },
        searchResponse.status
      );
    }

    const searchData =
      (await searchResponse.json()) as YouTubeSearchResponse;

    const videoIds = [
      ...new Set(
        (searchData.items ?? [])
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (videoIds.length === 0) {
      return noStoreJson({
        videos: [],
        nextPageToken: searchData.nextPageToken ?? null,
      });
    }

    const detailsUrl = new URL(`${YOUTUBE_API_URL}/videos`);

    detailsUrl.search = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: videoIds.join(","),
      key: apiKey,
    }).toString();

    const detailsResponse = await fetch(detailsUrl, { cache: "no-store" });

    if (!detailsResponse.ok) {
      const error = await detailsResponse.json();
      console.error("YouTube video details error:", error);

      return noStoreJson(
        { error: "Could not retrieve video details." },
        detailsResponse.status
      );
    }

    const detailsData =
      (await detailsResponse.json()) as YouTubeVideosResponse;

    const videoDetailsById = new Map(
      (detailsData.items ?? []).map((video) => [video.id, video])
    );
    const videos = videoIds.flatMap((id) => {
      const video = videoDetailsById.get(id);
      if (!video) return [];

      return [{
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description ?? "",
        creator: video.snippet.channelTitle,
        thumbnail:
          video.snippet.thumbnails?.high?.url ??
          video.snippet.thumbnails?.medium?.url ??
          video.snippet.thumbnails?.default?.url ??
          "",
        views: Number(video.statistics?.viewCount ?? 0),
        likes:
          video.statistics?.likeCount === undefined
            ? undefined
            : Number(video.statistics.likeCount),
        comments:
          video.statistics?.commentCount === undefined
            ? undefined
            : Number(video.statistics.commentCount),
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        categoryId: video.snippet.categoryId ?? "",
        category: "Other",
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      }];
    });

    return noStoreJson({
      videos,
      nextPageToken: searchData.nextPageToken ?? null,
    });
  } catch (error) {
    console.error("YouTube API route request failed:", error);

    return noStoreJson(
      { error: "Could not connect to YouTube. Please check your connection and retry." },
      500
    );
  }
}
