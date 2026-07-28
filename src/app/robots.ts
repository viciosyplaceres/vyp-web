import type { MetadataRoute } from "next";

const SITIO = "https://www.viciosyplaceres.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/galeria/", "/musica"],
      disallow: [
        "/admin",
        "/api/",
        "/chat",
        "/login",
        "/miembros",
        "/perfil",
        "/registro",
      ],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
