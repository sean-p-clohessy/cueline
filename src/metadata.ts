// Metadata is independent of lyric sources. There is deliberately no lyric-fetching service.
export interface MetadataResult {
  id: string;
  title: string;
  artist: string;
  duration: number | null;
}
let lastRequest = 0;
let inFlight = false;
let retryAfter = 0;
const cache = new Map<string, MetadataResult[]>();
export async function searchMetadata(query: string): Promise<MetadataResult[]> {
  const key = query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    lastRequest = Math.max(
      lastRequest,
      Number(localStorage.getItem("cueline-metadata-last")) || 0,
    );
  } catch {
    /* In-memory throttling still applies when storage is blocked. */
  }
  if (inFlight || Date.now() - lastRequest < 1500 || Date.now() < retryAfter)
    throw new Error("Please wait a moment before searching again.");
  if (!navigator.onLine)
    throw new Error("You’re offline. You can still add a song manually.");
  inFlight = true;
  lastRequest = Date.now();
  try {
    localStorage.setItem("cueline-metadata-last", String(lastRequest));
  } catch {
    /* No persistent throttle available. */
  }
  try {
    const params = new URLSearchParams({
      query: key,
      fmt: "json",
      limit: "12",
      client: "CueLine-1.0.0",
    });
    // Safari may send the application agent; Chromium owns and can omit this
    // header. The client parameter also identifies this browser-only app.
    const response = await fetch(
      `https://musicbrainz.org/ws/2/recording?${params}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "CueLine/1.0.0 (https://github.com/sean-p-clohessy/cueline)",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (response.status === 503 || response.status === 429)
      retryAfter =
        Date.now() +
        Math.max(
          30000,
          (Number(response.headers.get("Retry-After")) || 30) * 1000,
        );
    if (!response.ok)
      throw new Error(
        response.status === 503 || response.status === 429
          ? "MusicBrainz is busy. Try again later, or add your song manually."
          : "MusicBrainz is unavailable. You can still add a song manually.",
      );
    const data = (await response.json()) as {
      recordings?: {
        id: string;
        title: string;
        length?: number;
        "artist-credit"?: { name: string; joinphrase?: string }[];
      }[];
    };
    const results = (data.recordings ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      artist:
        r["artist-credit"]
          ?.map((a) => a.name + (a.joinphrase ?? ""))
          .join("") ?? "",
      duration: r.length ? Math.round(r.length / 1000) : null,
    }));
    cache.set(key, results);
    return results;
  } finally {
    inFlight = false;
  }
}
