const { getStore, connectLambda } = require("@netlify/blobs");

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

async function loadCleanData(store) {
  let products = ensureArray(await store.get("catalog", { type: "json" }));
  let globalColors = ensureArray(await store.get("globalColors", { type: "json" }));

  const legacyGlobalRecord = products.find(
    (item) => String(item.id) === "__global_colors__"
  );

  if (legacyGlobalRecord) {
    const legacyColors = ensureArray(legacyGlobalRecord.colors);

    if (!globalColors.length && legacyColors.length) {
      globalColors = legacyColors;
      await store.set("globalColors", JSON.stringify(globalColors));
    }

    products = products.filter((item) => String(item.id) !== "__global_colors__");
    await store.set("catalog", JSON.stringify(products));
  }

  return { products, globalColors };
}

exports.handler = async (event) => {
  connectLambda(event);

  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const { products, globalColors } = await loadCleanData(store);

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
    let { products, globalColors } = await loadCleanData(store);

    if (body.action === "saveGlobalColors") {
      globalColors = ensureArray(body.globalColors);
      await store.set("globalColors", JSON.stringify(globalColors));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "add" && body.product) {
      const exists = products.some(
        (p) => String(p.id) === String(body.product.id)
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

      products.push(body.product);
      await store.set("catalog", JSON.stringify(products));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "edit" && body.product) {
      let found = false;

      products = products.map((p) => {
        if (String(p.id) === String(body.product.id)) {
          found = true;
          return body.product;
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