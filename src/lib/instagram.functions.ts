import { createServerFn } from "@tanstack/react-start";

export const getMedia = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => {
    if (!input || typeof input.url !== "string" || input.url.length > 500) {
      throw new Error("رابط غير صالح");
    }
    return { url: input.url.trim() };
  })
  .handler(async ({ data }) => {
    const { parseShortcode, fetchMediaByShortcode } = await import("./instagram.server");
    const shortcode = parseShortcode(data.url);
    if (!shortcode) throw new Error("الرابط غير صحيح، تأكد من نسخ رابط المنشور أو الريلز");
    return fetchMediaByShortcode(shortcode);
  });

export const getProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => {
    if (!input || typeof input.username !== "string" || input.username.length > 200) {
      throw new Error("اسم مستخدم غير صالح");
    }
    return { username: input.username.trim() };
  })
  .handler(async ({ data }) => {
    const { parseUsername, fetchProfileByUsername } = await import("./instagram.server");
    const username = parseUsername(data.username);
    if (!username) throw new Error("اسم المستخدم غير صحيح");
    return fetchProfileByUsername(username);
  });
