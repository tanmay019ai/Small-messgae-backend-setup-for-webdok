import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
app.use(express.json());

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const ordersFile = path.resolve("orders.json");

// Helper to read & write order data
const readOrders = () => JSON.parse(fs.readFileSync(ordersFile, "utf-8") || "{}");
const writeOrders = (data) => fs.writeFileSync(ordersFile, JSON.stringify(data, null, 2));

// ✅ Test route
app.get("/", (req, res) => res.send("✅ Real-time Shopify Tracking Backend Running"));

// ✅ Send test SMS manually
app.get("/test-message", async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).send("Add ?to=+91XXXXXXXXXX");
  const message = await client.messages.create({
    from: process.env.TWILIO_PHONE,
    to,
    body: `Your order tracking link: ${process.env.BASE_URL}/track/test-order`,
  });
  res.send({ ok: true, sid: message.sid });
});

// 🧩 SHOPIFY WEBHOOKS

// 🟢 1. Order Created
app.post("/webhook/order-created", async (req, res) => {
  try {
    const order = req.body;
    const id = order.id || order.name || `order-${Date.now()}`;
    const phone = order?.customer?.phone;
    const name = order?.customer?.first_name || "Customer";

    if (!phone) return res.status(200).send("No phone found");

    // Save order status
    const orders = readOrders();
    orders[id] = { name, phone, status: "Confirmed" };
    writeOrders(orders);

    const trackingLink = `${process.env.BASE_URL}/track/${id}`;

    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `Hey ${name}, your order ${id} is confirmed ✅\nTrack live: ${trackingLink}`,
    });

    console.log(`📦 Order confirmed for ${phone}`);
    res.send("Order confirmation sent");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing order");
  }
});

// 🟠 2. Order Packed (custom webhook)
app.post("/webhook/order-packed", (req, res) => {
  const { order_id } = req.body;
  const orders = readOrders();
  if (orders[order_id]) {
    orders[order_id].status = "Packed";
    writeOrders(orders);
  }
  res.send("Order marked as packed");
});

// 🔵 3. Order Shipped
app.post("/webhook/order-shipped", (req, res) => {
  const { order_id } = req.body;
  const orders = readOrders();
  if (orders[order_id]) {
    orders[order_id].status = "Shipped";
    writeOrders(orders);
  }
  res.send("Order marked as shipped");
});

// 🟣 4. Order Delivered
app.post("/webhook/order-delivered", (req, res) => {
  const { order_id } = req.body;
  const orders = readOrders();
  if (orders[order_id]) {
    orders[order_id].status = "Delivered";
    writeOrders(orders);
  }
  res.send("Order marked as delivered");
});

// 🧭 TRACKING PAGE (LIVE STATUS)
app.get("/track/:id", (req, res) => {
  const { id } = req.params;
  const orders = readOrders();
  const order = orders[id];

  if (!order) {
    return res.send(`<h2>No tracking info for order: ${id}</h2>`);
  }

  const stages = ["Confirmed", "Packed", "Shipped", "Delivered"];
  const activeIndex = stages.indexOf(order.status);

  const progressHTML = stages
    .map((stage, i) => {
      const done = i <= activeIndex ? "done" : "";
      return `<div class="step ${done}">${stage}</div>`;
    })
    .join("");

  res.send(`
    <html>
      <head>
        <title>Tracking Order ${id}</title>
        <style>
          body { font-family: Poppins, sans-serif; background: #f4f4f9; text-align: center; padding: 40px; }
          h1 { color: #0070f3; }
          .track-container { display: flex; justify-content: center; gap: 25px; margin-top: 40px; }
          .step {
            position: relative;
            padding: 15px 25px;
            border-radius: 50px;
            background: #ddd;
            color: #555;
            font-weight: bold;
            transition: 0.3s;
          }
          .done {
            background: #0070f3;
            color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <h1>📦 Order Tracking</h1>
        <p>Customer: ${order.name}</p>
        <p><strong>Order ID:</strong> ${id}</p>
        <div class="track-container">${progressHTML}</div>
        <p style="margin-top:40px;">Current Status: <b>${order.status}</b></p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
