const nodemailer = require("nodemailer");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" })
    };
  }

  try {

    const data = JSON.parse(event.body);

    const SHOP_EMAIL = process.env.SHOP_EMAIL;
    const SHOP_PASS = process.env.SHOP_PASS;

    if (!SHOP_EMAIL || !SHOP_PASS) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: "SHOP_EMAIL or SHOP_PASS missing from Netlify environment variables."
        })
      };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SHOP_EMAIL,
        pass: SHOP_PASS
      }
    });

    const orderDetails = `
Customer Name: ${data.name}

Email: ${data.email || "Not provided"}

Phone: ${data.phone || "Not provided"}

Items Ordered:
${data.items}

Order Total: $${data.total}

Custom Notes:
${data.notes || "None"}
`;

    await transporter.sendMail({
      from: SHOP_EMAIL,
      to: SHOP_EMAIL,
      subject: "New Order Request - The Posse Shoppe",
      text: orderDetails
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Order sent successfully"
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message
      })
    };

  }

};