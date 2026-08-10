import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Download,
  Link2,
  Search,
  Copy,
  Check,
  Loader2,
  BadgeCheck,
  Lock,
  Play,
  ClipboardPaste,
  Instagram,
  Facebook,
  Youtube,
  Sparkles,
} from "lucide-react";

import type { MediaResult, ProfileResult } from "@/lib/instagram.server";
import { getMedia, getProfile } from "@/lib/instagram.functions";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type PlatformKey = "instagram" | "tiktok" | "x" | "facebook" | "youtube";

const PLATFORMS: { id: PlatformKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "instagram", label: "إنستغرام", icon: Instagram, color: "#E1306C" },
  { id: "tiktok", label: "تيك توك", icon: TikTokIcon, color: "#000000" },
  { id: "x", label: "إكس", icon: XIcon, color: "#000000" },
  { id: "facebook", label: "فيسبوك", icon: Facebook, color: "#1877F2" },
  { id: "youtube", label: "يوتيوب", icon: Youtube, color: "#FF0000" },
];

function PlatformIcon({ platform, className }: { platform: PlatformKey | string; className?: string }) {
  const p = PLATFORMS.find((x) => x.id === platform);
  if (!p) return null;
  const Icon = p.icon;
  return (
    <span className={className} style={{ color: p.color }}>
      <Icon className="size-full" />
    </span>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Save Insta — تنزيل من إنستغرام وتيك توك ويوتيوب" },
      {
        name: "description",
        content:
          "نزّل الفيديوهات والصور من إنستغرام وتيك توك وإكس وفيسبوك ويوتيوب، وابحث عن حسابات إنستغرام لنسخ البايو وتنزيل صورة البروفايل.",
      },
      { property: "og:title", content: "Save Insta — تنزيل من إنستغرام وتيك توك ويوتيوب" },
      {
        property: "og:description",
        content:
          "نزّل الفيديوهات والصور من إنستغرام وتيك توك وإكس وفيسبوك ويوتيوب، وانسخ بايو الحسابات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});




function dl(url: string, name: string) {
  return `/api/public/dl?u=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

function proxy(url: string) {
  if (!url) return "";
  return `/api/public/dl?inline=1&u=${encodeURIComponent(url)}`;
}


function nf(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function errText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const clean = msg.replace(/^Error:\s*/, "");
  return /[\u0600-\u06FF]/.test(clean) ? clean : "تعذّر جلب البيانات، حاول مرة أخرى";
}

function Segmented({
  value,
  onChange,
}: {
  value: "media" | "user";
  onChange: (v: "media" | "user") => void;
}) {
  const tabs = [
    { id: "media" as const, label: "رابط الفيديو", icon: Link2 },
    { id: "user" as const, label: "بحث بالحسابات", icon: Search },
  ];
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-full bg-fill p-1">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold transition-all duration-200 ${
              active
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground active:scale-95"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  loading: boolean;
  prefix?: string;
}) {
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) onChange(t);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-fill px-4 py-3">
        {prefix ? (
          <span className="text-[17px] font-semibold text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder={placeholder}
          dir="ltr"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={paste}
          aria-label="لصق"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition active:scale-90"
        >
          <ClipboardPaste className="size-5" />
        </button>
      </div>
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="ig-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[17px] font-bold text-primary-foreground shadow-card transition active:scale-[0.98] disabled:opacity-45"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
        {loading ? "جاري الجلب…" : "ابدأ"}
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl bg-card p-4 shadow-card">{children}</div>;
}

function MediaView({ data }: { data: MediaResult & { platform?: string } }) {
  const platform = data.platform as PlatformKey | undefined;
  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        {data.ownerPic ? (
          <img
            src={proxy(data.ownerPic)}
            alt={data.owner}
            className="size-10 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <PlatformIcon platform={platform || "instagram"} className="size-10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">@{data.owner || "media"}</p>
          <p className="text-xs text-muted-foreground">{data.items.length} ملف متاح</p>
        </div>
      </div>

      {data.caption ? (
        <p className="mb-3 line-clamp-4 whitespace-pre-line text-[14px] leading-6 text-muted-foreground">
          {data.caption}
        </p>
      ) : null}

      <div className="space-y-3">
        {data.items.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-fill">
            {item.type === "video" ? (
              <video
                src={proxy(item.url)}
                poster={item.thumb ? proxy(item.thumb) : undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[70vh] w-full bg-foreground/5 object-contain"
              />
            ) : (
              <div className="relative aspect-square w-full">
                {item.thumb ? (
                  <img
                    src={proxy(item.thumb)}
                    alt="معاينة"
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
            )}

            <a
              href={dl(item.url, `${data.shortcode}-${i + 1}`)}
              className="flex items-center justify-center gap-2 py-3 text-[16px] font-bold text-ios-blue active:opacity-60"
            >
              <Download className="size-4" />
              تنزيل {item.type === "video" ? "الفيديو" : "الصورة"}
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProfileView({ data }: { data: ProfileResult }) {
  const [copied, setCopied] = useState(false);
  const copyBio = async () => {
    await navigator.clipboard.writeText(data.biography || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="ig-gradient rounded-full p-[3px]">
          <img
            src={proxy(data.picture)}
            alt={`صورة حساب ${data.username}`}
            className="size-20 rounded-full border-2 border-card object-cover"

          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[17px] font-extrabold">{data.fullName || data.username}</p>
            {data.isVerified ? <BadgeCheck className="size-4 shrink-0 text-ios-blue" /> : null}
            {data.isPrivate ? <Lock className="size-3.5 shrink-0 text-muted-foreground" /> : null}
          </div>
          <p dir="ltr" className="truncate text-right text-[14px] text-muted-foreground">
            @{data.username}
          </p>
        </div>
      </div>

      <div className="my-4 grid grid-cols-3 divide-x divide-x-reverse divide-separator rounded-2xl bg-fill py-3 text-center">
        {[
          { l: "منشور", v: data.posts },
          { l: "متابِع", v: data.followers },
          { l: "يتابع", v: data.following },
        ].map((s) => (
          <div key={s.l}>
            <p className="text-[17px] font-extrabold">{nf(s.v)}</p>
            <p className="text-xs text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>

      {data.biography ? (
        <div className="rounded-2xl bg-fill p-3">
          <p className="whitespace-pre-line text-[14px] leading-6">{data.biography}</p>
          {data.externalUrl ? (
            <p dir="ltr" className="mt-1 truncate text-right text-[13px] text-ios-blue">
              {data.externalUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={copyBio}
          disabled={!data.biography}
          className="flex items-center justify-center gap-2 rounded-2xl bg-fill py-3 text-[15px] font-bold text-foreground transition active:scale-95 disabled:opacity-40"
        >
          {copied ? <Check className="size-4 text-ios-blue" /> : <Copy className="size-4" />}
          {copied ? "تم النسخ" : "نسخ البايو"}
        </button>
        <a
          href={dl(data.picture, `${data.username}-profile`)}
          className="ig-gradient flex items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-bold text-primary-foreground transition active:scale-95"
        >
          <Download className="size-4" />
          صورة البروفايل
        </a>
      </div>

      {data.recent.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">أحدث المنشورات</p>
          <div className="grid grid-cols-3 gap-1.5">
            {data.recent.map((p) => (
              <a
                key={p.shortcode}
                href={`https://www.instagram.com/p/${p.shortcode}/`}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-xl bg-fill"
              >
                <img
                  src={proxy(p.thumb)}
                  alt="منشور"
                  className="size-full object-cover"
                  loading="lazy"
                />

                {p.isVideo ? (
                  <Play className="absolute left-1.5 top-1.5 size-3.5 text-background drop-shadow" />
                ) : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function WelcomeSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-3xl bg-card p-6 text-center shadow-card">
        <span className="ig-gradient mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
          <Sparkles className="size-6" />
        </span>
        <p className="text-[19px] font-extrabold leading-8">لا تنسَ ذِكرَ الله</p>
        <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
          سبحان الله • الحمد لله • الله أكبر
        </p>
        <button
          onClick={onClose}
          className="ig-gradient mt-5 w-full rounded-2xl py-3 text-[16px] font-bold text-primary-foreground transition active:scale-95"
        >
          متابعة
        </button>
      </div>
    </div>
  );
}

function Home() {
  const [tab, setTab] = useState<"media" | "user">("media");
  const [urlInput, setUrlInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<(MediaResult & { platform?: string }) | null>(null);
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [welcome, setWelcome] = useState(false);

  const runMedia = useServerFn(getMedia);
  const runProfile = useServerFn(getProfile);

  useEffect(() => {
    if (!sessionStorage.getItem("dhikr-seen")) setWelcome(true);
  }, []);

  const closeWelcome = () => {
    sessionStorage.setItem("dhikr-seen", "1");
    setWelcome(false);
  };

  const lookupUser = async (value: string) => {
    const name = value.trim().replace(/^@/, "");
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      setProfile(await runProfile({ data: { username: name } }));
    } catch (e) {
      setError(errText(e));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // جلب الحساب والبايو تلقائيًا بعد التوقف عن الكتابة
  useEffect(() => {
    if (tab !== "user") return;
    const name = userInput.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_.]{2,30}$/.test(name)) return;
    const t = setTimeout(() => void lookupUser(name), 700);
    return () => clearTimeout(t);
  }, [userInput, tab]);

  const submit = async () => {
    if (tab === "user") return lookupUser(userInput);
    setLoading(true);
    setError(null);
    try {
      setMedia(await runMedia({ data: { url: urlInput } }));
    } catch (e) {
      setError(errText(e));
      setMedia(null);
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-background pb-16">
      {welcome ? <WelcomeSheet onClose={closeWelcome} /> : null}

      <header className="glass-bar sticky top-0 z-10 border-b border-separator px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          <span className="ig-gradient flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Instagram className="size-5" />
          </span>
          <div>
            <h1 className="text-[19px] font-extrabold leading-tight">Save Insta</h1>
            <p className="text-[12px] text-muted-foreground">إنستغرام • تيك توك • إكس • فيسبوك • يوتيوب</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 pt-5">
        <Segmented value={tab} onChange={setTab} />

        <Card>
          {tab === "media" ? (
            <Field
              value={urlInput}
              onChange={setUrlInput}
              onSubmit={submit}
              loading={loading}
              placeholder="https://... رابط من أي منصة"
            />
          ) : (
            <Field
              value={userInput}
              onChange={setUserInput}
              onSubmit={submit}
              loading={loading}
              prefix="@"
              placeholder="username"
            />
          )}
        </Card>

        {tab === "media" ? (
          <div className="flex flex-wrap justify-center gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              return (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-[12px] font-semibold text-muted-foreground"
                >
                  <span className="size-3.5" style={{ color: p.color }}>
                    <Icon className="size-full" />
                  </span>
                  {p.label}
                </span>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] font-semibold text-destructive">
            {error}
          </div>
        ) : null}

        {tab === "media" && media ? <MediaView data={media} /> : null}
        {tab === "user" && profile ? <ProfileView data={profile} /> : null}

        <p className="px-2 pt-2 text-center text-[12px] leading-5 text-muted-foreground">
          يدعم إنستغرام وتيك توك وإكس وفيسبوك ويوتيوب، ويعمل فقط مع المحتوى العام. احترم حقوق أصحاب المحتوى.
        </p>

        <footer className="pb-2 pt-1 text-center">
          <p className="text-[13px] font-bold">© Youssef Mansouri</p>
          <p className="text-[11px] text-muted-foreground">جميع الحقوق محفوظة</p>
        </footer>
      </div>

    </main>
  );
}
