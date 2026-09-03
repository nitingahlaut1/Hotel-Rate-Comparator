import {
  HotelSearchRequest,
  SearchApiResponse,
} from "../types/hotel";

const API_BASE_URL =
  process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8003";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Invokes the backend search API (POST /api/search-hotels).
 * Supports client cancellation via AbortSignal.
 */
export async function searchHotelsApi(
  request: HotelSearchRequest,
  signal?: AbortSignal,
): Promise<SearchApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/search-hotels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let errorDetail = "Unable to search hotels. Please try again.";
    try {
      const errorJson = (await response.json()) as { error?: string };
      if (response.status === 404) {
        errorDetail = "No hotels found for the selected dates.";
      } else if (response.status === 400 && errorJson.error) {
        errorDetail = errorJson.error;
      } else if (response.status === 502) {
        errorDetail = "Suppliers are currently unavailable. Please try again later.";
      }
    } catch {
      // Body not JSON
    }
    throw new ApiError(errorDetail, response.status);
  }

  return (await response.json()) as SearchApiResponse;
}

/**
 * Requests cancellation of an in-flight search workflow (POST /api/search-hotels/:workflowId/cancel).
 */
export async function cancelSearchApi(
  workflowId: string,
): Promise<{ message: string; workflowId: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/search-hotels/${encodeURIComponent(workflowId)}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new ApiError("Failed to cancel search", response.status);
  }

  return (await response.json()) as { message: string; workflowId: string };
}
