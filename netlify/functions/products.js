const { getStore, connectLambda } = require("@netlify/blobs");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeColor(color) {
  if (!color || typeof color !== "object") {
    return null;
  }

  const name = String(color.name || "").trim();
  const hex = String(color.hex || "").trim();

  if (!name || !hex) {
    return null;
  }

  return { name, hex };
}

function normalizeProduct(product) {
  const hasColors = !!product.hasColors;
  const colors = hasColors
    ? toArray(product.colors).map(normalizeColor).filter(Boolean)
    : [];

  return {
    id: product.id || String(Date.now()),
    category: product.category === "laser" ? "laser" : "3d",
    name: product.name || "",
    price: Number(product.price || 0),
    desc: product.desc ?? product.description ?? "",
    mediaType: product.mediaType === "video" ? "video" : "image",
    img: product.img || "",
    hasColors: hasColors && colors.length > 0,
    colors: hasColors ? colors : []
  };
}

async function loadProducts(store) {
  let products = toArray(await store.get("catalog", { type: "json" }));

  products = products
    .filter((item) => item && String(item.id) !== "__global_colors__")
    .map(normalizeProduct);

  await store.set("catalog", JSON.stringify(products));

  return products;
}

async function saveProducts(store, products) {
  await store.set("catalog", JSON.stringify(products));
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  connectLambda(event);

  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const products = await loadProducts(store);
    return json(200, products);
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    let products = await loadProducts(store);

    if (body.action === "add" && body.product) {
      const incoming = normalizeProduct(body.product);

      const exists = products.some(
        (p) => String(p.id) === String(incoming.id)
      );

      if (exists) {
        return json(400, {
          success: false,
          message: "Product ID already exists"
        });
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
          message: "Product not found for edit"
        });
      }

      await saveProducts(store, products);

      return json(200, {
        success: true,
        products
      });
    }

    if (body.action === "delete" && body.id) {
      products = products.filter(
        (p) => String(p.id) !== String(body.id)
      );

      await saveProducts(store, products);

      return json(200, {
        success: true,
        products
      });
    }

    return json(400, {
      success: false,
      message: "Invalid action"
    });
  }

  return json(405, {
    success: false,
    message: "Method not allowed"
  });
};