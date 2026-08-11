import type { MediaResult, MediaItem } from "./instagram.server";

export type Platform = "instagram" | "tiktok" | "x" | "facebook" | "youtube";

export function detectPlatform(url: string): Platform | null {
  const u = url.toLowerCase().trim();
  if (/(instagram\.com|instagr\.am|ig\.me)/.test(u)) return "instagram";
  if (/tiktok\.com|tiktok\.link/.test(u)) return "tiktok";
  if (/(twitter\.com|x\.com|t\.co\/)/.test(u)) return "x";
  if (/(facebook\.com|fb\.watch|fb\.me|fb\.com)/.test(u)) return "facebook";
  if (/(youtube\.com|youtube-nocookie\.com|youtu\.be)/.test(u)) return "youtube";
  // ليس رابطًا: نعتبره كود منشور إنستغرام
  if (!/^https?:\/\//.test(u) && /^[A-Za-z0-9_-]{5,20}$/.test(url.trim())) return "instagram";
  return null;
}


const COBALT = "https://co.otomir23.me/";

/** Generic resolver (YouTube / Facebook / TikTok / X fallback). */
async function viaCobalt(url: string): Promise<MediaItem[]> {
  const res = await fetch(COBALT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ url, videoQuality: "1080", filenameStyle: "basic" }),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!data) throw new Error("تعذر جلب الوسائط من هذا الرابط");
  if (data.status === "redirect" || data.status === "tunnel") {
    return [{ type: "video", url: data.url, thumb: "" }];
  }
  if (data.status === "picker" && Array.isArray(data.picker)) {
    return data.picker.map((p: any) => ({
      type: p.type === "photo" ? "image" : "video",
      url: p.url,
      thumb: p.thumb ?? p.url,
    }));
  }
  throw new Error("تعذر جلب الوسائط من هذا الرابط");
}

async function fetchTikTok(url: string): Promise<MediaResult> {
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { Accept: "application/json" },
  });
  const json = (await res.json().catch(() => null)) as any;
  const d = json?.data;
  if (d && (d.play || d.hdplay || d.images)) {
    const items: MediaItem[] = Array.isArray(d.images) && d.images.length
      ? d.images.map((img: string) => ({ type: "image" as const, url: img, thumb: img }))
      : [{ type: "video" as const, url: d.hdplay || d.play, thumb: d.cover ?? "" }];
    return {
      shortcode: String(d.id ?? ""),
      caption: d.title ?? "",
      owner: d.author?.unique_id ?? "",
      ownerPic: d.author?.avatar ?? "",
      items,
    };
  }
  return {
    shortcode: "",
    caption: "",
    owner: "",
    ownerPic: "",
    items: await viaCobalt(url),
  };
}

async function fetchX(url: string): Promise<MediaResult> {
  const id = url.match(/status(?:es)?\/(\d+)/)?.[1];
  if (id) {
    const res = await fetch(`https://api.fxtwitter.com/i/status/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    const json = (await res.json().catch(() => null)) as any;
    const t = json?.tweet;
    if (t && t.media) {
      const items: MediaItem[] = [];
      for (const v of t.media.videos ?? [])
        items.push({ type: "video", url: v.url, thumb: v.thumbnail_url ?? "" });
      for (const p of t.media.photos ?? [])
        items.push({ type: "image", url: p.url, thumb: p.url });
      if (items.length)
        return {
          shortcode: id,
          caption: t.text ?? "",
          owner: t.author?.screen_name ?? "",
          ownerPic: t.author?.avatar_url ?? "",
          items,
        };
    }
  }
  throw new Error("لا توجد صور أو فيديو في هذا المنشور");
}

async function fetchYouTube(url: string): Promise<MediaResult> {
  let caption = "";
  let thumb = "";
  let owner = "";
  try {
    const o = (await (
      await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    ).json()) as any;
    caption = o?.title ?? "";
    thumb = o?.thumbnail_url ?? "";
    owner = o?.author_name ?? "";
  } catch {
    /* metadata is optional */
  }
  const items = (await viaCobalt(url)).map((i) => ({ ...i, thumb: i.thumb || thumb }));
  return { shortcode: "", caption, owner, ownerPic: "", items };
}

export async function fetchAnyMedia(url: string): Promise<MediaResult & { platform: Platform }> {
  const platform = detectPlatform(url);
  if (!platform) throw new Error("المنصة غير مدعومة، الروابط المدعومة: انستغرام، تيك توك، إكس، فيسبوك، يوتيوب");

  if (platform === "instagram") {
    const { parseShortcode, fetchMediaByShortcode } = await import("./instagram.server");
    const shortcode = parseShortcode(url);
    if (!shortcode) throw new Error("الرابط غير صحيح، تأكد من نسخ رابط المنشور أو الريلز");
    return { ...(await fetchMediaByShortcode(shortcode)), platform };
  }
  if (platform === "tiktok") return { ...(await fetchTikTok(url)), platform };
  if (platform === "x") return { ...(await fetchX(url)), platform };
  if (platform === "youtube") return { ...(await fetchYouTube(url)), platform };

  return {
    shortcode: "",
    caption: "",
    owner: "",
    ownerPic: "",
    items: await viaCobalt(url),
    platform,
  };
}
