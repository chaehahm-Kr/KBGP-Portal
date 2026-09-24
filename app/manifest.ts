import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "K SELECT Retailer Portal",
    short_name: "K SELECT Hub",
    description: "Official B2B Retailer & Store Operations Portal for K SELECT",
    start_url: "/retailer",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/symbol-Cyan-Hotpink.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/symbol-Cyan-Hotpink.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
