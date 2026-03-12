const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const store = getStore("products");

  if (event.httpMethod === "GET") {
    const data = await store.get("catalog", { type: "json" }) || [];
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body);

    let products = await store.get("catalog", { type: "json" }) || [];

    if (body.action === "add") {
      products.push(body.product);
    }

    if (body.action === "delete") {
      products = products.filter(p => p.id !== body.id);
    }

    if (body.action === "edit") {
      products = products.map(p => p.id === body.product.id ? body.product : p);
    }

    await store.set("catalog", JSON.stringify(products));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  }

  return {
    statusCode: 405,
    body: "Method not allowed"
  };
};