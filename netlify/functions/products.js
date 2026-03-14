const { getStore, connectLambda } = require("@netlify/blobs");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function normalizeColor(color) {
  if (!color || typeof color !== "object") return null;

  const name = cleanString(color.name);
  const hex = cleanString(color.hex);

  if (!name || !hex) return null;

  return { name, hex };
}

function normalizeProduct(product) {
  const requestedColors = toArray(product.colors)
    .map(normalizeColor)
    .filter(Boolean);

  const hasColors = !!product.hasColors && requestedColors.length > 0;

  return {
    id: cleanString(product.id) || String(Date.now()),
    category: cleanString(product.category) === "laser" ? "laser" : "3d",
    name: cleanString(product.name),
    price: Number(product.price || 0),
    desc: cleanString(product.desc ?? product.description),
    mediaType: cleanString(product.mediaType) === "video" ? "video" : "image",
    img: cleanString(product.img),
    hasColors,
    colors: hasColors ? requestedColors : []
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
    if (event.httpMethod === "GET") {
      const products = await loadProducts(store);
      return json(200, products);
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      let products = await loadProducts(store);

      if (body.action === "add" && body.product) {
        const incoming = normalizeProduct(body.product);

        if (!incoming.name) {
          return json(400, {
            success: false,
            message: "Product name is required."
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
            message: "Product name is required."
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
            message: "Product not found for edit."
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
            message: "Product not found for delete."
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
    }

    return json(405, {
      success: false,
      message: "Method not allowed."
    });
  } catch (error) {
    console.error("products function error:", error);
    return json(500, {
      success: false,
      message: "Server error in products function."
    });
  }
};