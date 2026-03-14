const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  connectLambda(event);

  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const products = (await store.get("catalog", { type: "json" })) || [];
    const globalColors = (await store.get("globalColors", { type: "json" })) || [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: Array.isArray(products) ? products : [],
        globalColors: Array.isArray(globalColors) ? globalColors : []
      })
    };
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    let products = (await store.get("catalog", { type: "json" })) || [];

    if (body.action === "saveGlobalColors") {
      const globalColors = Array.isArray(body.globalColors) ? body.globalColors : [];

      await store.set("globalColors", JSON.stringify(globalColors));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true })
      };
    }

    if (body.action === "add" && body.product) {
      const exists = products.some((p) => String(p.id) === String(body.product.id));
      if (exists) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: false, message: "Product ID already exists" })
        };
      }
      products.push(body.product);
    }

    if (body.action === "delete" && body.id) {
      products = products.filter((p) => String(p.id) !== String(body.id));
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
          body: JSON.stringify({ success: false, message: "Product not found for edit" })
        };
      }
    }

    await store.set("catalog", JSON.stringify(products));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true })
    };
  }

  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, message: "Method not allowed" })
  };
};