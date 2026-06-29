import type { MetadataRoute } from "next";
import { getAppName } from "@/lib/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appName = await getAppName();
  return {
    name: `${appName} Order Manager`,
    short_name: appName,
    description: `Receive, manage, track and analyse cake orders for ${appName}.`,
    id: "/",
    start_url: "/orders",
    scope: "/",
    display: "standalone",
    background_color: "#fbf6f6",
    theme_color: "#b00d28",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
