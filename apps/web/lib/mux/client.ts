import Mux from "@mux/mux-node";

// Initialize Mux client
// Requires MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Get playback URL for an asset
export function getPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

// Get thumbnail URL for an asset
export function getThumbnailUrl(playbackId: string, options?: {
  width?: number;
  height?: number;
  time?: number;
}): string {
  const params = new URLSearchParams();
  if (options?.width) params.set("width", options.width.toString());
  if (options?.height) params.set("height", options.height.toString());
  if (options?.time) params.set("time", options.time.toString());

  const queryString = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${queryString ? `?${queryString}` : ""}`;
}

// Get animated GIF URL for an asset
export function getGifUrl(playbackId: string, options?: {
  width?: number;
  start?: number;
  end?: number;
}): string {
  const params = new URLSearchParams();
  if (options?.width) params.set("width", options.width.toString());
  if (options?.start) params.set("start", options.start.toString());
  if (options?.end) params.set("end", options.end.toString());

  const queryString = params.toString();
  return `https://image.mux.com/${playbackId}/animated.gif${queryString ? `?${queryString}` : ""}`;
}
