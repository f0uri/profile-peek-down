const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type MediaItem = {
  type: "image" | "video";
  url: string;
  thumb: string;
};

export type MediaResult = {
  shortcode: string;
  caption: string;
  owner: string;
  ownerPic: string;
  items: MediaItem[];
};

export type ProfilePost = {
  shortcode: string;
  thumb: string;
  isVideo: boolean;
};

export type ProfileResult = {
  username: string;
  fullName: string;
  biography: string;
  picture: string;
  followers: number;
  following: number;
  posts: number;
  isPrivate: boolean;
  isVerified: boolean;
  externalUrl: string | null;
  recent: ProfilePost[];
};

export function parseShortcode(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(
    /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i,
  );
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{5,20}$/.test(trimmed)) return trimmed;
  return null;
}

export function parseUsername(input: string): string | null {
  let v = input.trim().replace(/^@/, "");
  const m = v.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (m) v = m[1];
  v = v.split("?")[0].split("/")[0];
  return /^[A-Za-z0-9_.]{1,30}$/.test(v) ? v.toLowerCase() : null;
}

function unescapeBlob(html: string) {
  return html
    .replace(/\\{2,}/g, "\\")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&");
}

function decodeText(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\([^\\])/g, "$1")
    .replace(/\\/g, "")
    .trim();
}


function uniq(list: string[]) {
  return Array.from(new Set(list));
}

export async function fetchMediaByShortcode(shortcode: string): Promise<MediaResult> {
  const res = await fetch(
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    { headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" } },
  );
  if (!res.ok) throw new Error("تعذر الوصول إلى المنشور");
  const text = unescapeBlob(await res.text());

  if (!/shortcode_media/.test(text)) {
    throw new Error("المنشور غير متاح أو الحساب خاص");
  }

  const videos = uniq(
    [...text.matchAll(/"video_url":"(https:\/\/[^"]+?\.mp4[^"]*)"/g)].map((m) => m[1]),
  );
  const images = uniq(
    [...text.matchAll(/"display_url":"(https:\/\/[^"]+?)"/g)].map((m) => m[1]),
  );

  const items: MediaItem[] = [];
  videos.forEach((v, i) => items.push({ type: "video", url: v, thumb: images[i] ?? images[0] ?? "" }));
  if (!videos.length) {
    images.forEach((img) => items.push({ type: "image", url: img, thumb: img }));
  } else if (images.length > videos.length) {
    images.slice(videos.length).forEach((img) => items.push({ type: "image", url: img, thumb: img }));
  }

  if (!items.length) throw new Error("لم يتم العثور على وسائط في هذا الرابط");

  const caption =
    text.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"([\s\S]*?)"\}\}\]/)?.[1] ??
    "";
  const owner = text.match(/"owner":\{[^}]*?"username":"([^"]+)"/)?.[1] ?? "";
  const ownerPic = text.match(/"profile_pic_url":"(https:\/\/[^"]+?)"/)?.[1] ?? "";

  return {
    shortcode,
    caption: decodeText(caption),
    owner,
    ownerPic,
    items,
  };
}


export async function fetchProfileByUsername(username: string): Promise<ProfileResult> {
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        "User-Agent": UA,
        "x-ig-app-id": "936619743392459",
        Accept: "*/*",
      },
    },
  );
  if (!res.ok) throw new Error("تعذر جلب بيانات الحساب");
  const json = (await res.json()) as any;
  const u = json?.data?.user;
  if (!u) throw new Error("لا يوجد حساب بهذا الاسم");

  return {
    username: u.username,
    fullName: u.full_name ?? "",
    biography: u.biography ?? "",
    picture: u.profile_pic_url_hd ?? u.profile_pic_url ?? "",
    followers: u.edge_followed_by?.count ?? 0,
    following: u.edge_follow?.count ?? 0,
    posts: u.edge_owner_to_timeline_media?.count ?? 0,
    isPrivate: !!u.is_private,
    isVerified: !!u.is_verified,
    externalUrl: u.external_url ?? null,
    recent: (u.edge_owner_to_timeline_media?.edges ?? [])
      .slice(0, 9)
      .map((e: any) => ({
        shortcode: e.node.shortcode,
        thumb: e.node.thumbnail_src ?? e.node.display_url,
        isVideo: !!e.node.is_video,
      })),
  };
}
