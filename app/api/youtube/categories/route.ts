import { NextResponse } from "next/server";
import {
  quotaErrorReasons,
  validateSupportedRegion,
} from "../../../../lib/youtube-region";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

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

function jsonResponse(body: unknown, status: number, cacheControl: string) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

export async function GET(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "YouTube API key is not configured.", errorCode: "api_key_missing" },
      500,
      "no-store, max-age=0"
    );
  }

  const requestedRegionCode = new URL(request.url).searchParams.get("regionCode");
  const regionCode = requestedRegionCode?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(regionCode)) {
    return jsonResponse(
      { error: "Select a valid YouTube region.", errorCode: "invalid_region" },
      400,
      "no-store, max-age=0"
    );
  }

  try {
    const regionError = await validateSupportedRegion(regionCode, apiKey);
    if (regionError) {
      return jsonResponse(
        { error: regionError.error, errorCode: regionError.errorCode },
        regionError.status,
        "no-store, max-age=0"
      );
    }

    const categoriesUrl = new URL(`${YOUTUBE_API_URL}/videoCategories`);
    categoriesUrl.search = new URLSearchParams({
      part: "snippet",
      regionCode,
      key: apiKey,
    }).toString();

    const response = await fetch(categoriesUrl, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorData =
        (await response.json().catch(() => null)) as
          | YouTubeApiErrorResponse
          | null;
      const reason = errorData?.error?.errors?.[0]?.reason ?? "";
      const quotaExceeded = quotaErrorReasons.includes(reason);

      return jsonResponse(
        {
          error: quotaExceeded
            ? "YouTube's category quota has been exceeded."
            : "Could not load categories for this region.",
          errorCode: quotaExceeded ? "quota_exceeded" : "categories_unavailable",
        },
        response.status,
        "no-store, max-age=0"
      );
    }

    const data = (await response.json()) as YouTubeCategoriesResponse;
    const categories = (data.items ?? [])
      .filter((item) => item.snippet.assignable)
      .map((item) => ({ id: item.id, name: item.snippet.title }));

    return jsonResponse(
      { categories },
      200,
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=300"
    );
  } catch (error) {
    console.error("Could not load YouTube categories:", error);

    return jsonResponse(
      {
        error: "Could not connect to YouTube to load categories.",
        errorCode: "network_error",
      },
      500,
      "no-store, max-age=0"
    );
  }
}
