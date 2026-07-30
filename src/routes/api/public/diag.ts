import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/diag")({
  server: {
    handlers: {
      GET: async () => {
        const r = await fetch("https://www.instagram.com/p/DbYfBvRyvV0/embed/captioned/", {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        });
        const t = await r.text();
        return Response.json({
          status: r.status,
          len: t.length,
          hasSC: t.includes("shortcode_media"),
          head: t.slice(0, 150),
        });
      },
    },
  },
});
