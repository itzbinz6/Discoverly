
import { NextResponse } from "next/server";

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
  statistics?: { viewCount?: string };
};

type YouTubeVideosResponse = {
  nextPageToken?: string;
  items?: YouTubeVideo[];
};

type YouTubeApiErrorResponse = {
  error?: {
    errors?: Array<{ reason?: string }>;
  };
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

const quotaErrorReasons = [
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
];

function isSupportedRegionItem(
  item: unknown
): item is { snippet: { gl: string; name: string } } {
  if (!item || typeof item !== "object" || !("snippet" in item)) {
    return false;
  }

  const snippet = item.snippet;
  return Boolean(
    snippet &&
      typeof snippet === "object" &&
      "gl" in snippet &&
      typeof snippet.gl === "string" &&
      /^[A-Z]{2}$/.test(snippet.gl) &&
      "name" in snippet &&
      typeof snippet.name === "string" &&
      snippet.name.trim()
  );
}

async function validateSupportedRegion(
  regionCode: string,
  apiKey: string
): Promise<NextResponse | null> {
  const regionsUrl = new URL(`${YOUTUBE_API_URL}/i18nRegions`);
  regionsUrl.search = new URLSearchParams({
    part: "snippet",
    hl: "en_US",
    key: apiKey,
  }).toString();

  const response = await fetch(regionsUrl, {
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    const errorData =
      (await response.json().catch(() => null)) as
        | YouTubeApiErrorResponse
        | null;
    const reason = errorData?.error?.errors?.[0]?.reason ?? "";
    const quotaExceeded = quotaErrorReasons.includes(reason);

    return noStoreJson(
      {
        error: quotaExceeded
          ? "The YouTube API quota has been exceeded. Please try again later."
          : "Could not verify YouTube's supported regions.",
        errorCode: quotaExceeded
          ? "quota_exceeded"
          : "region_list_unavailable",
      },
      response.status
    );
  }

  const regionsData = (await response.json().catch(() => null)) as
    | { items?: unknown[] }
    | null;
  if (
    !regionsData ||
    !Array.isArray(regionsData.items) ||
    regionsData.items.length === 0 ||
    !regionsData.items.every(isSupportedRegionItem)
  ) {
    return noStoreJson(
      {
        error: "YouTube returned an invalid supported-region list.",
        errorCode: "region_list_unavailable",
      },
      502
    );
  }

  if (!regionsData.items.some((item) => item.snippet.gl === regionCode)) {
    return noStoreJson(
      {
        error: "This region is not supported by YouTube.",
        errorCode: "invalid_region",
      },
      400
    );
  }

  return null;
}

export async function GET(request: Request) {
  let requestMode = "search";

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return noStoreJson(
        { error: "YouTube API key is not configured." },
        500
      );
    }

    const { searchParams } = new URL(request.url);
    requestMode = searchParams.get("mode") ?? "search";
    const query = searchParams.get("q")?.trim() ?? "";
    const categoryId = searchParams.get("categoryId")?.trim();
    const requestedRegionCode = searchParams.get("regionCode");
    const pageToken = searchParams.get("pageToken")?.trim();
    const requestedMaxResults = searchParams.get("maxResults");
    const maxResults = requestedMaxResults
      ? Number(requestedMaxResults)
      : requestMode === "trending"
        ? 9
        : 30;

    if (requestMode !== "search" && requestMode !== "trending") {
      return noStoreJson({ error: "Invalid YouTube request mode." }, 400);
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

    if (requestMode === "trending") {
      const regionCode = requestedRegionCode?.trim().toUpperCase() ?? "";

      if (requestedRegionCode === null && categoryId) {
        return noStoreJson(
          {
            error: "Categories are not available for YouTube default.",
            errorCode: "category_unavailable",
          },
          400
        );
      }

      if (requestedRegionCode !== null) {
        if (!/^[A-Z]{2}$/.test(regionCode)) {
          return noStoreJson(
            {
              error: "Select a valid YouTube region.",
              errorCode: "invalid_region",
            },
            400
          );
        }

        const regionValidationResponse = await validateSupportedRegion(
          regionCode,
          apiKey
        );
        if (regionValidationResponse) return regionValidationResponse;
      }

      const trendingUrl = new URL(`${YOUTUBE_API_URL}/videos`);
      const trendingParams = new URLSearchParams({
        part: "snippet,contentDetails,statistics",
        chart: "mostPopular",
        maxResults: String(maxResults),
        key: apiKey,
      });

      if (regionCode) {
        trendingParams.set("regionCode", regionCode);
      }

      if (categoryId) {
        trendingParams.set("videoCategoryId", categoryId);
      }

      if (pageToken) {
        trendingParams.set("pageToken", pageToken);
      }

      trendingUrl.search = trendingParams.toString();

      const categoriesRequest = regionCode
        ? (() => {
            const categoriesUrl = new URL(
              `${YOUTUBE_API_URL}/videoCategories`
            );
            categoriesUrl.search = new URLSearchParams({
              part: "snippet",
              regionCode,
              key: apiKey,
            }).toString();
            return fetch(categoriesUrl, { next: { revalidate: 3600 } })
              .then(async (response) => {
                if (!response.ok) {
                  const errorData =
                    (await response.json().catch(() => null)) as
                      | YouTubeApiErrorResponse
                      | null;
                  const reason =
                    errorData?.error?.errors?.[0]?.reason ?? "";
                  return {
                    data: null,
                    error: quotaErrorReasons.includes(reason)
                      ? "YouTube's category quota has been exceeded."
                      : "Could not load categories for this region.",
                  };
                }

                return {
                  data: (await response.json()) as YouTubeCategoriesResponse,
                  error: "",
                };
              })
              .catch(() => ({
                data: null,
                error: "Could not connect to YouTube to load categories.",
              }));
          })()
        : Promise.resolve({ data: null, error: "" });

      const [trendingResponse, categoriesResponse] = await Promise.all([
        fetch(trendingUrl, { cache: "no-store" }),
        categoriesRequest,
      ]);

      if (!trendingResponse.ok) {
        const errorData =
          (await trendingResponse.json().catch(() => null)) as
            | YouTubeApiErrorResponse
            | null;
        const reason = errorData?.error?.errors?.[0]?.reason ?? "";
        const errorCode =
          reason === "videoChartNotFound"
            ? "chart_unavailable"
            : quotaErrorReasons.includes(reason)
              ? "quota_exceeded"
              : "youtube_api_error";

        console.error("YouTube Trending error:", errorData ?? trendingResponse.statusText);

        return noStoreJson(
          {
            error:
              errorCode === "chart_unavailable"
                ? regionCode
                  ? "YouTube's most-popular chart is unavailable for this region or category."
                  : "YouTube's default most-popular chart is unavailable."
                : errorCode === "quota_exceeded"
                  ? "The YouTube API quota has been exceeded. Please try again later."
                  : "Could not retrieve YouTube Trending videos.",
            errorCode,
          },
          trendingResponse.status
        );
      }

      const trendingData =
        (await trendingResponse.json()) as YouTubeVideosResponse;
      const categories = (categoriesResponse.data?.items ?? []).filter(
        (item) => item.snippet.assignable
      );
      const categoryNames = new Map(
        categories.map((item) => [item.id, item.snippet.title])
      );

      const videos = (trendingData.items ?? []).map((video) => ({
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
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        categoryId: video.snippet.categoryId ?? "",
        category:
          categoryNames.get(video.snippet.categoryId ?? "") ?? "Other",
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      }));

      return noStoreJson({
        videos,
        categories: categories.map((item) => ({
          id: item.id,
          name: item.snippet.title,
        })),
        categoriesError: categoriesResponse.error || null,
        nextPageToken: trendingData.nextPageToken ?? null,
      });
    }

    const requestedOrder = searchParams.get("order");
    const order = requestedOrder === "date" ? "date" : "relevance";

    if (requestedOrder && !["date", "relevance"].includes(requestedOrder)) {
      return noStoreJson({ error: "Invalid YouTube search order." }, 400);
    }

    if (!query) {
      return noStoreJson({ error: "A search query is required." }, 400);
    }

    const requestedSearchRegionCode = searchParams.get("regionCode");
    const searchRegionCode = requestedSearchRegionCode
      ?.trim()
      .toUpperCase();
    if (!searchRegionCode || !/^[A-Z]{2}$/.test(searchRegionCode)) {
      return noStoreJson(
        { error: "Select a valid YouTube region.", errorCode: "invalid_region" },
        400
      );
    }

    const regionValidationResponse = await validateSupportedRegion(
      searchRegionCode,
      apiKey
    );
    if (regionValidationResponse) return regionValidationResponse;

    const searchUrl = new URL(`${YOUTUBE_API_URL}/search`);

    const youtubeParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: String(maxResults),
      order,
      q: query,
      regionCode: searchRegionCode,
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
      regionCode: searchRegionCode,
      key: apiKey,
    }).toString();

    const [searchResponse, categoriesResponse] = await Promise.all([
      fetch(searchUrl, { cache: "no-store" }),
      fetch(categoriesUrl, {
        next: { revalidate: 3600 },
      }),
    ]);

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
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        categoryId: video.snippet.categoryId ?? "",
        category:
          categoryNames.get(video.snippet.categoryId ?? "") ?? "Other",
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      }];
    });

    return noStoreJson({
      videos,
      categories: (categories ?? []).map((item) => ({
        id: item.id,
        name: item.snippet.title,
      })),
      nextPageToken: searchData.nextPageToken ?? null,
    });
  } catch {
    console.error("YouTube API route request failed.");

    return noStoreJson(
      {
        error:
          requestMode === "trending"
            ? "Could not connect to YouTube Trending. Please check your connection and retry."
            : "Something went wrong while fetching videos.",
        ...(requestMode === "trending" ? { errorCode: "network_error" } : {}),
      },
      500
    );
  }
}
