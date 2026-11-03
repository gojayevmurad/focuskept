import type { MetadataRoute } from "next";
import { brand } from "@/src/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    // The proxy adds the visitor's locale.
    start_url: "/focus?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0E1110",
    theme_color: "#0E1110",
    categories: ["productivity", "education"],
    lang: "en",
    dir: "auto",
    prefer_related_applications: false,
    // Long-press / right-click actions on the installed icon.
    shortcuts: [
      {
        name: "Start focusing",
        short_name: "Focus",
        url: "/focus?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Review due cards",
        short_name: "Review",
        url: "/app/review?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
