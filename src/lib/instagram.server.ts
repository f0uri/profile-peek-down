const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Rotated so repeated searches never look like one hammering client. */
const UA_POOL = [
  UA,
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36",
];

function randomUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

/** Instagram answers 429 aggressively; retry a few times with backoff + UA rotation. */
async function fetchRetry(
  url: string,
  headers: Record<string, string>,
  attempts = 3,
): Promise<Response> {
  let res = await fetch(url, { headers });
  for (let i = 1; i < attempts && (res.status === 429 || res.status >= 500); i++) {
    await new Promise((r) => setTimeout(r, 400 * i + Math.random() * 300));
    res = await fetch(url, { headers: { ...headers, "User-Agent": randomUA() } });
  }
  return res;
}


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
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\\([^\\])/g, "$1")
    .replace(/\\/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
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


function parseCount(raw: string) {
  const v = parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(v)) return 0;
  if (/M/i.test(raw)) return Math.round(v * 1_000_000);
  if (/K/i.test(raw)) return Math.round(v * 1_000);
  return Math.round(v);
}

function extractEmbedPosts(html: string): ProfilePost[] {
  const out: ProfilePost[] = [];
  const seen = new Set<string>();
  const re = /shortcode\\*"\s*:\s*\\*"([A-Za-z0-9_-]+)\\*"([\s\S]{0,1500}?)display_url\\*"\s*:\s*\\*"(.*?)\\*"/g;
  for (const m of html.matchAll(re)) {
    const code = m[1];
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      shortcode: code,
      thumb: unescapeBlob(m[3]),
      isVideo: /is_video\\*"\s*:\s*true/.test(m[2]),
    });
    if (out.length >= 12) break;
  }
  return out;
}

async function fetchProfileFromEmbed(username: string): Promise<ProfileResult> {
  const res = await fetchRetry(`https://www.instagram.com/${username}/embed/`, {
    "User-Agent": "Mozilla/5.0",
    Accept: "*/*",
  });
  const html = await res.text();
  const rawPic = html.match(/profile_pic_url\\*"\s*:\s*\\*"(.*?)\\*"/)?.[1] ?? "";
  // Do NOT rewrite the size segment (e.g. s100x100 -> s640x640): the CDN URL is
  // signed, so any change makes Instagram answer 403 "URL signature mismatch".
  const pic = unescapeBlob(rawPic);
  if (!res.ok || !pic) throw new Error("إنستغرام يحدّ الطلبات مؤقتًا، حاول بعد قليل");
  const fullName = decodeText(
    unescapeBlob(html.match(/full_name\\*"\s*:\s*\\*"(.*?)\\*"/)?.[1] ?? username),
  );
  const followers = Number(html.match(/followers_count\\*"\s*:\s*(\d+)/)?.[1] ?? 0);
  const biography = decodeText(
    unescapeBlob(
      html.match(/biography_with_entities\\*"[\s\S]{0,80}?text\\*"\s*:\s*\\*"(.*?)\\*"/)?.[1] ??
        html.match(/biography\\*"\s*:\s*\\*"(.*?)\\*"\s*,/)?.[1] ??
        "",
    ),
  );

  return {
    username,
    fullName,
    biography,
    picture: pic,
    followers,
    following: 0,
    posts: 0,
    isPrivate: /is_private\\*"\s*:\s*true/.test(html),
    isVerified: /is_verified\\*"\s*:\s*true/.test(html),
    externalUrl: null,
    recent: extractEmbedPosts(html),
  };
}



const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Crawler UAs get served the meta-tag version of the page and are throttled
// much less often than browser UAs.
const PAGE_UAS = [MOBILE_UA, "TelegramBot (like TwitterBot)", UA];

/** Fetches the public profile page, trying several user agents against 429s. */
async function fetchProfilePage(username: string): Promise<Response> {
  let last: Response | null = null;
  for (const ua of PAGE_UAS) {
    const res = await fetchRetry(
      `https://www.instagram.com/${username}/`,
      { "User-Agent": ua, Accept: "text/html,*/*" },
      2,
    );
    if (res.ok || res.status === 404) return res;
    last = res;
  }
  return last as Response;
}

async function fetchProfileFromPage(username: string): Promise<ProfileResult> {
  const res = await fetchProfilePage(username);
  const html = await res.text();
  if (res.status === 429 || (!res.ok && res.status !== 404)) {
    // Page is throttled — the embed endpoint is far less rate-limited.
    return fetchProfileFromEmbed(username);
  }
  if (res.status === 404 || /Page Not Found/i.test(html))
    throw new Error("لا يوجد حساب بهذا الاسم");



  const desc = html.match(/og:description" content="([^"]*)"/)?.[1] ?? "";
  const ogPic = (html.match(/og:image" content="([^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&");
  const jsonPic = unescapeBlob(
    html.match(/"profile_pic_url_hd":"(https:[^"]+)"/)?.[1] ??
      html.match(/"profile_pic_url":"(https:[^"]+)"/)?.[1] ??
      "",
  );
  const pic = jsonPic || ogPic;
  const counts = desc.match(
    /([\d.,]+[KM]?)\s*Followers,\s*([\d.,]+[KM]?)\s*Following,\s*([\d.,]+[KM]?)\s*Posts/i,
  );
  const fullName =
    decodeText(unescapeBlob(html.match(/"full_name":"([\s\S]{0,120}?)","/)?.[1] ?? "")) ||
    (desc.match(/videos from ([^(]+)\s*\(/i)?.[1]?.trim() ?? username);
  if (!pic) return fetchProfileFromEmbed(username);

  let biography = decodeText(
    unescapeBlob(html.match(/"biography":"([\s\S]*?)","/)?.[1] ?? ""),
  );
  if (!biography) {
    const quoted = desc.match(/on Instagram:\s*(?:&quot;|")([\s\S]*?)(?:&quot;|")\s*$/i)?.[1] ?? "";
    biography = quoted
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#064;/g, "@")
      .replace(/&amp;/g, "&")
      .trim();
  }

  const followersJson = Number(html.match(/"edge_followed_by":\{"count":(\d+)\}/)?.[1] ?? 0);
  const followingJson = Number(html.match(/"edge_follow":\{"count":(\d+)\}/)?.[1] ?? 0);
  const postsJson = Number(
    html.match(/"edge_owner_to_timeline_media":\{"count":(\d+)/)?.[1] ?? 0,
  );
  const externalUrl = unescapeBlob(html.match(/"external_url":"(https?:[^"]+)"/)?.[1] ?? "") || null;

  return {
    username,
    fullName: fullName.replace(/&#0?39;/g, "'").replace(/&amp;/g, "&"),
    biography,
    picture: pic,
    followers: followersJson || (counts ? parseCount(counts[1]) : 0),
    following: followingJson || (counts ? parseCount(counts[2]) : 0),
    posts: postsJson || (counts ? parseCount(counts[3]) : 0),
    isPrivate: /"is_private":true/.test(html) || /This account is private/i.test(html),
    isVerified: /"is_verified":true/.test(html),
    externalUrl,
    recent: [...html.matchAll(/"shortcode":"([A-Za-z0-9_-]+)","[\s\S]{0,600}?"display_url":"(https:[^"]+)"/g)]
      .slice(0, 9)
      .map((m) => ({
        shortcode: m[1],
        thumb: unescapeBlob(m[2]),
        isVideo: false,
      })),

  };
}

// ---------------------------------------------------------------------------
// Bio via public search snippets (works even when Instagram blocks us entirely)
// ---------------------------------------------------------------------------

type SearchInfo = { biography: string; fullName: string };

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#x27;|&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#064;/g, "@")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ");
}

function parseSnippet(text: string, username: string): SearchInfo | null {
  const u = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`([^•|\\-–—"]{0,80}?)\\(@\\s*${u}\\s*\\)`, "i");
  const bioRe = new RegExp(
    `\\(@\\s*${u}\\s*\\)[^"]{0,60}"([\\s\\S]{1,600}?)(?:"|\\u2026|\\.\\.\\.)`,
    "i",
  );
  const bio = text.match(bioRe)?.[1]?.trim() ?? "";
  const name = text.match(nameRe)?.[1]?.trim() ?? "";
  if (!bio && !name) return null;
  return { biography: bio, fullName: name };
}

/** Tries several public search engines until one yields the profile snippet. */
async function fetchInfoFromSearch(username: string): Promise<SearchInfo | null> {
  const queries = [`instagram.com/${username}/`, `"@${username}" instagram`];
  const engines = [
    (q: string) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    (q: string) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    (q: string) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`,
    (q: string) => `https://search.marginalia.nu/search?query=${encodeURIComponent(q)}`,
    (q: string) => `https://www.google.com/search?hl=en&q=${encodeURIComponent(q)}`,
  ];
  for (const q of queries) {
    for (const engine of engines) {
      try {
        const res = await fetch(engine(q), {
          headers: {
            "User-Agent": randomUA(),
            Accept: "text/html,*/*",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!res.ok) continue;
        const hit = parseSnippet(cleanHtml(await res.text()), username);
        if (hit?.biography) return hit;
      } catch {
        /* engine unavailable */
      }
    }
  }
  return null;
}

/** Bios are stable, so once found we remember them for the whole process life. */
const bioMemory = new Map<string, { biography: string; fullName: string }>();

/** Fills gaps (bio / posts / picture) from the other public sources. */
async function enrich(p: ProfileResult, fromPage = false): Promise<ProfileResult> {
  let out = p;
  if (!out.recent.length || !out.picture || !out.followers) {
    try {
      const e = await fetchProfileFromEmbed(out.username);
      out = {
        ...out,
        fullName: out.fullName || e.fullName,
        biography: out.biography || e.biography,
        picture: out.picture || e.picture,
        followers: out.followers || e.followers,
        isVerified: out.isVerified || e.isVerified,
        recent: out.recent.length ? out.recent : e.recent,
      };
    } catch {
      /* embed unavailable */
    }
  }
  if (!out.biography && !fromPage) {
    // The bio only exists on the API / profile page, never on the embed.
    try {
      const g = await fetchProfileFromPage(out.username);
      out = {
        ...out,
        biography: g.biography,
        fullName: out.fullName || g.fullName,
        picture: out.picture || g.picture,
        followers: out.followers || g.followers,
        following: out.following || g.following,
        posts: out.posts || g.posts,
        externalUrl: out.externalUrl ?? g.externalUrl,
        recent: out.recent.length ? out.recent : g.recent,
      };
    } catch {
      /* page unavailable */
    }
  }
  // Last resort for the bio: public search snippets, then process memory.
  if (!out.biography) {
    const s = await fetchInfoFromSearch(out.username);
    if (s) out = { ...out, biography: s.biography, fullName: out.fullName || s.fullName };
  }
  const remembered = bioMemory.get(out.username.toLowerCase());
  if (!out.biography && remembered?.biography) {
    out = {
      ...out,
      biography: remembered.biography,
      fullName: out.fullName || remembered.fullName,
    };
  }
  if (out.biography) {
    bioMemory.set(out.username.toLowerCase(), {
      biography: out.biography,
      fullName: out.fullName,
    });
  }
  return out;
}

const cache = new Map<string, { at: number; data: ProfileResult }>();
const TTL = 30 * 60 * 1000;
/** Coalesces concurrent lookups of the same username into one upstream call. */
const inflight = new Map<string, Promise<ProfileResult>>();

function merge(fresh: ProfileResult, prev?: ProfileResult): ProfileResult {
  if (!prev) return fresh;
  return {
    ...fresh,
    fullName: fresh.fullName || prev.fullName,
    biography: fresh.biography || prev.biography,
    picture: fresh.picture || prev.picture,
    followers: fresh.followers || prev.followers,
    following: fresh.following || prev.following,
    posts: fresh.posts || prev.posts,
    externalUrl: fresh.externalUrl ?? prev.externalUrl,
    recent: fresh.recent.length ? fresh.recent : prev.recent,
  };
}

export async function fetchProfileByUsername(username: string): Promise<ProfileResult> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  // Cached and complete enough → answer instantly, no upstream request at all.
  if (hit && Date.now() - hit.at < TTL && hit.data.biography && hit.data.picture) {
    return hit.data;
  }
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const merged = merge(await resolveProfile(username), hit?.data);
      cache.set(key, { at: Date.now(), data: merged });
      return merged;
    } catch (err) {
      // Never fail a search because Instagram throttled us: serve the last
      // known snapshot, or a search-only snapshot, instead of an error.
      if (hit?.data) return hit.data;
      if (err instanceof Error && err.message.includes("لا يوجد")) throw err;
      const s = await fetchInfoFromSearch(username);
      if (s) {
        const fallback: ProfileResult = {
          username,
          fullName: s.fullName || username,
          biography: s.biography,
          picture: "",
          followers: 0,
          following: 0,
          posts: 0,
          isPrivate: false,
          isVerified: false,
          externalUrl: null,
          recent: [],
        };
        cache.set(key, { at: Date.now(), data: fallback });
        return fallback;
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

async function resolveProfile(username: string): Promise<ProfileResult> {
  let u: any = null;
  for (let attempt = 0; attempt < 2 && !u; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 700));
    try {
      const res = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            "User-Agent": randomUA(),
            "x-ig-app-id": "936619743392459",
            Accept: "*/*",
          },
        },
      );
      if (res.status === 404) throw new Error("لا يوجد حساب بهذا الاسم");
      if (!res.ok) continue;
      u = ((await res.json()) as any)?.data?.user ?? null;
    } catch (e) {
      if (e instanceof Error && e.message.includes("لا يوجد")) throw e;
    }
  }
  if (!u) return enrich(await fetchProfileFromPage(username), true);

  return enrich({
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
  });
}

