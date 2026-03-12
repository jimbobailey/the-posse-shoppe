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
    const body = JSON.parse(event.body || "{}");
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