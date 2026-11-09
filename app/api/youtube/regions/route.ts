import { NextResponse } from "next/server";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const quotaErrorReasons = [
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
];

type YouTubeRegionsResponse = {
  items?: unknown[];
  error?: {
    errors?: Array<{ reason?: string }>;
  };
};

type YouTubeRegionItem = {
  snippet: {
    gl: string;
    name: string;
  };
};

function isYouTubeRegionItem(item: unknown): item is YouTubeRegionItem {
  if (!item || typeof item !== "object" || !("snippet" in item)) {
    return false;
  }

  const snippet = item.snippet;
  if (!snippet || typeof snippet !== "object") {
    return false;
  }

  return (
    "gl" in snippet &&
    typeof snippet.gl === "string" &&
    /^[A-Z]{2}$/.test(snippet.gl) &&
    "name" in snippet &&
    typeof snippet.name === "string" &&
    Boolean(snippet.name.trim())
  );
}

function jsonResponse(
  body: unknown,
  status: number,
  cacheControl: string
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      {
        error: "YouTube API key is not configured.",
        errorCode: "api_key_missing",
      },
      500,
      "no-store, max-age=0"
    );
  }

  try {
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
          | YouTubeRegionsResponse
          | null;
      const reason = errorData?.error?.errors?.[0]?.reason ?? "";
      const quotaExceeded = quotaErrorReasons.includes(reason);

      return jsonResponse(
        {
          error: quotaExceeded
            ? "The YouTube API quota has been exceeded. Please try again later."
            : "Could not load YouTube's supported regions.",
          errorCode: quotaExceeded ? "quota_exceeded" : "region_list_unavailable",
        },
        response.status,
        "no-store, max-age=0"
      );
    }

    const data = (await response.json().catch(() => null)) as
      | YouTubeRegionsResponse
      | null;
    if (
      !data ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      !data.items.every(isYouTubeRegionItem)
    ) {
      return jsonResponse(
        {
          error: "YouTube returned an invalid supported-region list.",
          errorCode: "invalid_region_list",
        },
        502,
        "no-store, max-age=0"
      );
    }

    const regions = data.items.map((item) => ({
      code: item.snippet.gl.trim(),
      name: item.snippet.name.trim(),
    }));

    return jsonResponse(
      { regions },
      200,
      "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600"
    );
  } catch {
    console.error("Could not connect to YouTube to load supported regions.");

    return jsonResponse(
      {
        error: "Could not connect to YouTube to load supported regions.",
        errorCode: "network_error",
      },
      500,
      "no-store, max-age=0"
    );
  }
}
