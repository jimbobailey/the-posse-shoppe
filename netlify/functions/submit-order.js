exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "Method not allowed"
            })
        };
    }

    try {
        let nodemailer;

        try {
            nodemailer = require("nodemailer");
        } catch (requireError) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "Nodemailer failed to load: " + requireError.message
                })
            };
        }

        let order = {};
        try {
            order = JSON.parse(event.body || "{}");
        } catch (parseError) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "Invalid order data: " + parseError.message
                })
            };
        }

        const customer = order.customer || {};
        const items = Array.isArray(order.items) ? order.items : [];

        if (!customer.name || (!customer.email && !customer.phone)) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "Customer name and email or phone are required."
                })
            };
        }

        if (!items.length) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "No items were submitted."
                })
            };
        }

        const shopEmail = process.env.SHOP_EMAIL;
        const shopPass = process.env.SHOP_PASS;

        if (!shopEmail) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "SHOP_EMAIL is missing in Netlify environment variables."
                })
            };
        }

        if (!shopPass) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "SHOP_PASS is missing in Netlify environment variables."
                })
            };
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: shopEmail,
                pass: shopPass
            }
        });

        try {
            await transporter.verify();
        } catch (verifyError) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "Gmail login failed: " + verifyError.message
                })
            };
        }

        const safe = (value) => String(value || "").trim();

        let itemLinesForOwner = "";
        let itemLinesForCustomer = "";

        items.forEach((item, index) => {
            const qty = Number(item.qty || 0);
            const price = Number(item.price || 0).toFixed(2);
            const name = safe(item.name);
            const category = safe(item.category);
            const color = safe(item.selectedColor) || "Default / None";
            const lineTotal = (Number(item.qty || 0) * Number(item.price || 0)).toFixed(2);

            itemLinesForOwner +=
`${index + 1}. ${name}
   Category: ${category}
   Color: ${color}
   Qty: ${qty}
   Unit Price: $${price}
   Line Total: $${lineTotal}

`;

            itemLinesForCustomer +=
`${qty} x ${name}${color !== "Default / None" ? ` (${color})` : ""}
`;
        });

        const total = Number(order.total || 0).toFixed(2);

        const ownerEmailText =
`NEW ORDER REQUEST - THE POSSE SHOPPE

Customer Name: ${safe(customer.name)}
Customer Email: ${safe(customer.email) || "Not provided"}
Customer Phone: ${safe(customer.phone) || "Not provided"}

ORDER ITEMS:
${itemLinesForOwner}
Estimated Total: $${total}

CUSTOM REQUESTS / NOTES:
${safe(order.notes) || "None"}

Customer was shown this notice:
- Transaction is completed offsite
- Payment methods offered: PayPal, Venmo, Cash App, Zelle
- Custom colors and custom designs may be requested
- Customer should be notified if a request cannot be accommodated
`;

        try {
            await transporter.sendMail({
                from: `"The Posse Shoppe Website" <${shopEmail}>`,
                to: shopEmail,
                subject: `New Order Request from ${safe(customer.name)}`,
                text: ownerEmailText
            });
        } catch (ownerMailError) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    success: false,
                    message: "Failed sending owner email: " + ownerMailError.message
                })
            };
        }

        if (customer.email) {
            const customerEmailText =
`THE POSSE SHOPPE

Hi ${safe(customer.name)},

Your order request was received successfully.

Please expect an email from The Posse Shoppe to confirm your order details, discuss any custom requests, and complete the transaction offsite.

Accepted payment methods:
- PayPal
- Venmo
- Cash App
- Zelle

You may request custom designs and colors not listed.
If a requested color is unavailable or a custom design is beyond current design capability, you will be notified.

YOUR ORDER:
${itemLinesForCustomer}
Estimated Total: $${total}

Your Notes:
${safe(order.notes) || "None"}

Thank you,
The Posse Shoppe
`;

            try {
                await transporter.sendMail({
                    from: `"The Posse Shoppe" <${shopEmail}>`,
                    to: safe(customer.email),
                    subject: "Your Posse Shoppe order request was received",
                    text: customerEmailText
                });
            } catch (customerMailError) {
                return {
                    statusCode: 500,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        success: false,
                        message: "Owner email sent, but customer email failed: " + customerMailError.message
                    })
                };
            }
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: true,
                message: "Order sent successfully."
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "Unexpected function error: " + (error && error.message ? error.message : "Unknown error")
            })
        };
    }
};