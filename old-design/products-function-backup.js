const { getStore, connectLambda } = require("@netlify/blobs");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function normalizeHex(value) {
  const hex = cleanString(value);
  if (!hex) return "";
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function normalizeColor(color) {
  if (!color || typeof color !== "object") return null;

  const name = cleanString(color.name);
  const hex = normalizeHex(color.hex);

  if (!name || !hex) return null;

  return { name, hex };
}

function sameColor(a, b) {
  return (
    cleanString(a?.name).toLowerCase() === cleanString(b?.name).toLowerCase() &&
    normalizeHex(a?.hex).toLowerCase() === normalizeHex(b?.hex).toLowerCase()
  );
}

function normalizeCategory(category) {
  const value = cleanString(category).toLowerCase();

  if (value === "laser") return "laser";
  if (value === "boombox") return "boombox";
  if (value === "stl-personal") return "stl-personal";
  if (value === "stl-commercial") return "stl-commercial";
  if (value === "affiliate") return "affiliate";

  return "3d";
}

function normalizeProduct(product) {
  const category = normalizeCategory(product.category);

  const requestedColors = toArray(product.colors)
    .map(normalizeColor)
    .filter(Boolean);

  const allowColors = category === "3d" || category === "laser" || category === "boombox";
  const hasColors = allowColors && !!product.hasColors && requestedColors.length > 0;

  return {
    id: cleanString(product.id) || String(Date.now()),
    category,
    name: cleanString(product.name),
    price: Number(product.price || 0),
    desc: cleanString(product.desc ?? product.description),
    mediaType:
      category === "3d" || category === "laser" || category === "boombox"
        ? cleanString(product.mediaType) === "video"
          ? "video"
          : "image"
        : "image",
    img: cleanString(product.img),
    hasColors,
    colors: hasColors ? requestedColors : [],
    link: category === "affiliate" ? cleanString(product.link) : ""
  };
}

async function loadProducts(store) {
  const raw = await store.get("catalog", { type: "json" });
  let products = toArray(raw);

  products = products
    .filter((item) => item && typeof item === "object")
    .filter((item) => cleanString(item.id) !== "__global_colors__")
    .map((item) => {
      const cleaned = { ...item };
      delete cleaned.globalColors;
      delete cleaned.useGlobalColors;
      return normalizeProduct(cleaned);
    });

  return products;
}

async function saveProducts(store, products) {
  await store.set("catalog", JSON.stringify(products));
}

async function loadColorLibrary(store) {
  const raw = await store.get("colorLibrary", { type: "json" });
  const colors = toArray(raw).map(normalizeColor).filter(Boolean);
  return colors;
}

async function saveColorLibrary(store, colors) {
  await store.set("colorLibrary", JSON.stringify(colors));
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore("products");

  try {
    const type = cleanString(event.queryStringParameters?.type).toLowerCase();

    if (event.httpMethod === "GET" && type === "colors") {
      const colors = await loadColorLibrary(store);
      return json(200, colors);
    }

    if (event.httpMethod === "GET") {
      const products = await loadProducts(store);
      return json(200, products);
    }

    if (event.httpMethod !== "POST") {
      return json(405, {
        success: false,
        message: "Method not allowed."
      });
    }

    const body = JSON.parse(event.body || "{}");

    if (body.action === "addColor" && body.color) {
      const colors = await loadColorLibrary(store);
      const incoming = normalizeColor(body.color);

      if (!incoming) {
        return json(400, {
          success: false,
          message: "Valid color name and hex are required."
        });
      }

      const exists = colors.some((color) => sameColor(color, incoming));
      if (exists) {
        return json(400, {
          success: false,
          message: "That color already exists in the library."
        });
      }

      colors.push(incoming);
      await saveColorLibrary(store, colors);

      return json(200, {
        success: true,
        colors
      });
    }

    if (body.action === "updateColor" && body.color && Number.isInteger(body.index)) {
      const colors = await loadColorLibrary(store);
      const incoming = normalizeColor(body.color);

      if (!incoming) {
        return json(400, {
          success: false,
          message: "Valid color name and hex are required."
        });
      }

      if (body.index < 0 || body.index >= colors.length) {
        return json(404, {
          success: false,
          message: "Color not found for update."
        });
      }

      colors[body.index] = incoming;
      await saveColorLibrary(store, colors);

      return json(200, {
        success: true,
        colors
      });
    }

    if (body.action === "deleteColor" && Number.isInteger(body.index)) {
      const colors = await loadColorLibrary(store);

      if (body.index < 0 || body.index >= colors.length) {
        return json(404, {
          success: false,
          message: "Color not found for delete."
        });
      }

      colors.splice(body.index, 1);
      await saveColorLibrary(store, colors);

      return json(200, {
        success: true,
        colors
      });
    }

    let products = await loadProducts(store);

    if (body.action === "add" && body.product) {
      const incoming = normalizeProduct(body.product);

      if (!incoming.name) {
        return json(400, {
          success: false,
          message: "Item name is required."
        });
      }

      if (!incoming.img) {
        return json(400, {
          success: false,
          message: "Image or media filename is required."
        });
      }

      if (incoming.category === "affiliate" && !incoming.link) {
        return json(400, {
          success: false,
          message: "Affiliate URL is required."
        });
      }

      const exists = products.some((p) => String(p.id) === String(incoming.id));
      if (exists) {
        incoming.id = String(Date.now());
      }

      products.push(incoming);
      await saveProducts(store, products);

      return json(200, {
        success: true,
        products
      });
    }

    if (body.action === "edit" && body.product) {
      const incoming = normalizeProduct(body.product);

      if (!incoming.name) {
        return json(400, {
          success: false,
          message: "Item name is required."
        });
      }

      if (!incoming.img) {
        return json(400, {
          success: false,
          message: "Image or media filename is required."
        });
      }

      if (incoming.category === "affiliate" && !incoming.link) {
        return json(400, {
          success: false,
          message: "Affiliate URL is required."
        });
      }

      let found = false;

      products = products.map((p) => {
        if (String(p.id) === String(incoming.id)) {
          found = true;
          return incoming;
        }
        return p;
      });

      if (!found) {
        return json(404, {
          success: false,
          message: "Item not found for edit."
        });
      }

      await saveProducts(store, products);

      return json(200, {
        success: true,
        products
      });
    }

    if (body.action === "delete" && body.id) {
      const beforeCount = products.length;
      products = products.filter((p) => String(p.id) !== String(body.id));

      if (products.length === beforeCount) {
        return json(404, {
          success: false,
          message: "Item not found for delete."
        });
      }

      await saveProducts(store, products);

      return json(200, {
        success: true,
        products
      });
    }

    return json(400, {
      success: false,
      message: "Invalid action."
    });
  } catch (error) {
    console.error("products function error:", error);
    return json(500, {
      success: false,
      message: "Server error in products function."
    });
  }
};