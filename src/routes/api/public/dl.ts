import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = [".cdninstagram.com", ".fbcdn.net", "cdninstagram.com"];

export const Route = createFileRoute("/api/public/dl")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u");
        const name = new URL(request.url).searchParams.get("name") || "instagram";
        if (!target) return new Response("missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("bad url", { status: 400 });
        }
        if (parsed.protocol !== "https:" || !ALLOWED.some((d) => parsed.hostname.endsWith(d))) {
          return new Response("forbidden host", { status: 403 });
        }

        const upstream = await fetch(parsed.toString(), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Referer: "https://www.instagram.com/",
          },
        });
        if (!upstream.ok || !upstream.body) {
          return new Response("upstream error", { status: 502 });
        }

        const type = upstream.headers.get("content-type") ?? "application/octet-stream";
        const ext = type.includes("video") ? "mp4" : "jpg";
        const safe = name.replace(/[^A-Za-z0-9_.-]/g, "") || "instagram";

        return new Response(upstream.body, {
          headers: {
            "Content-Type": type,
            "Content-Disposition": `attachment; filename="${safe}.${ext}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
