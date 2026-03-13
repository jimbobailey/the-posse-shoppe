const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  connectLambda(event);

  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const data = (await store.get("catalog", { type: "json" })) || [];
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  }

  if (event.httpMethod === "POST") {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          message: "ADMIN_PASSWORD is missing in Netlify environment variables."
        })
      };
    }

    const body = JSON.parse(event.body || "{}");

    if (String(body.password || "") !== String(ADMIN_PASSWORD)) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          message: "Unauthorized"
        })
      };
    }

    let products = (await store.get("catalog", { type: "json" })) || [];

    if (body.action === "add" && body.product) {
      products.push(body.product);
    }

    if (body.action === "delete" && body.id) {
      products = products.filter((p) => String(p.id) !== String(body.id));
    }

    if (body.action === "edit" && body.product) {
      products = products.map((p) =>
        String(p.id) === String(body.product.id) ? body.product : p
      );
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