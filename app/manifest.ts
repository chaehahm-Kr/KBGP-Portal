import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "K SELECT HUB - Retailer Portal",
    short_name: "K SELECT HUB",
    description: "Official B2B Retailer & Store Operations Portal for K SELECT HUB",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0c0c",
    theme_color: "#141414",
    orientation: "portrait",
    icons: [
      {
        src: "/hub-icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/hub-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
