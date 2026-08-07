import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = [".cdninstagram.com", ".fbcdn.net", "cdninstagram.com"];

export const Route = createFileRoute("/api/public/dl")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("u");
        const name = params.get("name") || "instagram";
        const inline = params.get("inline") === "1";
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

        const range = request.headers.get("range");
        const upstream = await fetch(parsed.toString(), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Referer: "https://www.instagram.com/",
            ...(range ? { Range: range } : {}),
          },
        });
        if (!upstream.ok || !upstream.body) {
          return new Response("upstream error", { status: 502 });
        }

        const type = upstream.headers.get("content-type") ?? "application/octet-stream";
        const ext = type.includes("video") ? "mp4" : "jpg";
        const safe = name.replace(/[^A-Za-z0-9_.-]/g, "") || "instagram";

        const headers: Record<string, string> = {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
        };
        const len = upstream.headers.get("content-length");
        const cr = upstream.headers.get("content-range");
        if (len) headers["Content-Length"] = len;
        if (cr) headers["Content-Range"] = cr;
        headers["Content-Disposition"] = inline
          ? `inline; filename="${safe}.${ext}"`
          : `attachment; filename="${safe}.${ext}"`;
        headers["Cache-Control"] = inline ? "public, max-age=3600" : "no-store";

        return new Response(upstream.body, { status: upstream.status, headers });
      },

    },
  },
});
