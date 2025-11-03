import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();
const app = express();
app.use(express.json());

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// 🧠 In-memory storage (reset every deploy)
let orders = {};

// ✅ Root
app.get("/", (req, res) => res.send("✅ Shopify + Twilio Real-time Tracking Backend Running"));

// ✅ Test SMS route
app.get("/test-message", async (req, res) => {
  try {
    const to = req.query.to;
    if (!to) return res.status(400).send("Add ?to=+91XXXXXXXXXX");

    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to,
      body: `Test order tracking link: ${process.env.BASE_URL}/track/test-order`,
    });

    res.send({ ok: true, sid: message.sid });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// 🟢 Order Created
app.post("/webhook/order-created", async (req, res) => {
  try {
    const order = req.body;
    const id = order.id?.toString() || `order-${Date.now()}`;
    const phone = order?.customer?.phone;
    const name = order?.customer?.first_name || "Customer";

    if (!phone) return res.status(200).send("No phone found");

    orders[id] = { name, phone, status: "Confirmed" };

    const trackingLink = `${process.env.BASE_URL}/track/${id}`;
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `Hey ${name}, your order ${id} is confirmed ✅\nTrack live: ${trackingLink}`,
    });

    console.log(`✅ Order confirmed for ${phone}`);
    res.send("Order confirmation processed");
  } catch (err) {
    console.error("❌ Order-created error:", err);
    res.status(500).send("Error processing order");
  }
});

// 🟠 Packed
app.post("/webhook/order-packed", async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!orders[order_id]) return res.send("Order not found");

    orders[order_id].status = "Packed";

    const { name, phone } = orders[order_id];
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `Hey ${name}, your order ${order_id} has been packed 📦\nTrack: ${process.env.BASE_URL}/track/${order_id}`,
    });

    console.log(`📦 Order packed: ${order_id}`);
    res.send("Order marked as packed");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// 🔵 Shipped
app.post("/webhook/order-shipped", async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!orders[order_id]) return res.send("Order not found");

    orders[order_id].status = "Shipped";

    const { name, phone } = orders[order_id];
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `🚚 Hi ${name}, your order ${order_id} is now shipped!\nTrack: ${process.env.BASE_URL}/track/${order_id}`,
    });

    console.log(`🚚 Order shipped: ${order_id}`);
    res.send("Order marked as shipped");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// 🟣 Delivered
app.post("/webhook/order-delivered", async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!orders[order_id]) return res.send("Order not found");

    orders[order_id].status = "Delivered";

    const { name, phone } = orders[order_id];
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `🎉 Hi ${name}, your order ${order_id} has been delivered!\nThank you for shopping with us ❤️`,
    });

    console.log(`🎉 Order delivered: ${order_id}`);
    res.send("Order marked as delivered");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// 🧭 Tracking page (simple HTML)
app.get("/track/:id", (req, res) => {
  const { id } = req.params;
  const order = orders[id];

  if (!order) return res.send(`<h2>No tracking info found for Order ID: ${id}</h2>`);

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
        <title>Order Tracking - ${id}</title>
        <style>
          body { font-family: Poppins, sans-serif; background: #f8f9fb; text-align: center; padding: 40px; }
          h1 { color: #0070f3; }
          .track-container { display: flex; justify-content: center; gap: 25px; margin-top: 40px; }
          .step {
            padding: 15px 25px;
            border-radius: 50px;
            background: #ddd;
            color: #555;
            font-weight: 600;
            transition: 0.3s;
          }
          .done {
            background: #0070f3;
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <h1>📦 Order Tracking</h1>
        <p>Customer: <b>${order.name}</b></p>
        <p>Order ID: <b>${id}</b></p>
        <div class="track-container">${progressHTML}</div>
        <p style="margin-top:30px;">Current Status: <b>${order.status}</b></p>
      </body>
    </html>
  `);
});

// 🚀 Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
