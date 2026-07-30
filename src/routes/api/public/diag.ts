import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/diag")({
  server: { handlers: { GET: async () => {
    const out: any[] = [];
    for (const h of [
      { "User-Agent": "Mozilla/5.0", "x-ig-app-id": "936619743392459", Accept: "*/*" },
      { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
    ]) {
      const r = await fetch("https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram", { headers: h });
      const t = await r.text();
      out.push({ h, status: r.status, len: t.length, head: t.slice(0, 200) });
    }
    return Response.json(out);
  } } },
});
