const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
export const quotaErrorReasons = [
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
];

type YouTubeApiErrorResponse = {
  error?: {
    errors?: Array<{ reason?: string }>;
  };
};

type RegionValidationError = {
  error: string;
  errorCode: string;
  status: number;
};

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

export async function validateSupportedRegion(
  regionCode: string,
  apiKey: string
): Promise<RegionValidationError | null> {
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

    return {
      error: quotaExceeded
        ? "The YouTube API quota has been exceeded. Please try again later."
        : "Could not verify YouTube's supported regions.",
      errorCode: quotaExceeded ? "quota_exceeded" : "region_list_unavailable",
      status: response.status,
    };
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
    return {
      error: "YouTube returned an invalid supported-region list.",
      errorCode: "region_list_unavailable",
      status: 502,
    };
  }

  if (!regionsData.items.some((item) => item.snippet.gl === regionCode)) {
    return {
      error: "This region is not supported by YouTube.",
      errorCode: "invalid_region",
      status: 400,
    };
  }

  return null;
}
