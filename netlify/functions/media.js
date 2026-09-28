// Photo uploads for the admin page.
// POST  { password, filename, contentType, data (base64) }  -> saves the photo, returns { url: "/uploads/<key>" }
// GET   /uploads/<key>                                       -> returns the photo
const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

const MAX_BASE64 = 4 * 1024 * 1024; // about 3 MB photo
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function passwordOk(given) {
  const expected = String(process.env.ADMIN_PASSWORD || "");
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function slug(name) {
  return String(name || "photo").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
}

function keyFromEvent(event) {
  const q = event.queryStringParameters && event.queryStringParameters.key;
  if (q) return String(q);
  const parts = String(event.path || "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return last === "media" ? "" : decodeURIComponent(last);
}

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore("media");

  try {
    if (event.httpMethod === "GET") {
      const key = keyFromEvent(event);
      if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(key)) return json(404, { success: false, message: "Not found." });
      const item = await store.get(key, { type: "json" });
      if (!item || !item.data) return json(404, { success: false, message: "Not found." });
      return {
        statusCode: 200,
        headers: { "Content-Type": item.contentType || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
        body: item.data,
        isBase64Encoded: true
      };
    }

    if (event.httpMethod !== "POST") return json(405, { success: false, message: "Method not allowed." });

    const body = JSON.parse(event.body || "{}");
    if (!process.env.ADMIN_PASSWORD) return json(503, { success: false, message: "The admin password has not been set up in Netlify yet." });
    if (!passwordOk(body.password)) return json(401, { success: false, message: "Wrong admin password. Sign in again." });

    const ext = TYPES[String(body.contentType || "").toLowerCase()];
    const data = String(body.data || "").replace(/^data:[^,]*,/, "");
    if (!ext) return json(400, { success: false, message: "That file type isn't a photo. Use a JPG or PNG." });
    if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return json(400, { success: false, message: "The photo didn't come through. Try again." });
    if (data.length > MAX_BASE64) return json(413, { success: false, message: "That photo is too big. Try a smaller one." });

    const key = `${Date.now()}-${slug(body.filename)}.${ext}`;
    await store.set(key, JSON.stringify({ contentType: String(body.contentType).toLowerCase(), data }));
    return json(200, { success: true, url: `/uploads/${key}` });
  } catch (error) {
    return json(500, { success: false, message: error.message || "Upload failed." });
  }
};
