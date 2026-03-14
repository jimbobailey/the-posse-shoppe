const { getStore, connectLambda } = require("@netlify/blobs");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProduct(product) {
  return {
    id: product.id || String(Date.now()),
    category: product.category || "3d",
    name: product.name || "",
    price: Number(product.price || 0),
    desc: product.desc ?? product.description ?? "",
    mediaType: product.mediaType || "image",
    img: product.img || "",
    hasColors: !!product.hasColors,
    useGlobalColors: !!product.useGlobalColors,
    colors: toArray(product.colors)
  };
}

async function loadData(store) {
  let products = toArray(await store.get("catalog", { type: "json" }));
  let globalColors = toArray(await store.get("globalColors", { type: "json" }));

  // cleanup any old fake global-color products
  products = products.filter((item) => String(item.id) !== "__global_colors__");
  products = products.map(normalizeProduct);

  await store.set("catalog", JSON.stringify(products));

  return { products, globalColors };
}

function applyGlobalColorsToProducts(products, globalColors) {
  return products.map((product) => {
    const p = normalizeProduct(product);

    if (p.useGlobalColors) {
      return {
        ...p,
        hasColors: true,
        colors: [...globalColors]
      };
    }

    return p;
  });
}

exports.handler = async (event) => {
  connectLambda(event);

  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const { products, globalColors } = await loadData(store);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products,
        globalColors
      })
    };
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    let { products, globalColors } = await loadData(store);

    if (body.action === "saveGlobalColors") {
      globalColors = toArray(body.globalColors);

      await store.set("globalColors", JSON.stringify(globalColors));

      products = applyGlobalColorsToProducts(products, globalColors);
      await store.set("catalog", JSON.stringify(products));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "add" && body.product) {
      const incoming = normalizeProduct(body.product);

      if (incoming.useGlobalColors) {
        incoming.hasColors = true;
        incoming.colors = [...globalColors];
      }

      const exists = products.some(
        (p) => String(p.id) === String(incoming.id)
      );

      if (exists) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            message: "Product ID already exists"
          })
        };
      }

      products.push(incoming);
      await store.set("catalog", JSON.stringify(products));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "edit" && body.product) {
      const incoming = normalizeProduct(body.product);

      if (incoming.useGlobalColors) {
        incoming.hasColors = true;
        incoming.colors = [...globalColors];
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
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            message: "Product not found for edit"
          })
        };
      }

      await store.set("catalog", JSON.stringify(products));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "delete" && body.id) {
      products = products.filter(
        (p) => String(p.id) !== String(body.id)
      );

      await store.set("catalog", JSON.stringify(products));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        message: "Invalid action"
      })
    };
  }

  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: false,
      message: "Method not allowed"
    })
  };
};