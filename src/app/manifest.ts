import type { MetadataRoute } from "next";

/*
 * Lets employees add the app to their phone's home screen ("Install app" on
 * Android Chrome, Share > "Add to Home Screen" on iPhone). It then opens
 * full screen, like an app, straight to the dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shahi Lites Quotations",
    short_name: "Shahi Lites",
    description: "Lighting quotations for the Shahi Lites team.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171717", // Android launch screen: same black as the icon
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
