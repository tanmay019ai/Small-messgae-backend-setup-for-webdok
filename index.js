import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Twilio client
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Home route (for quick check)
app.get("/", (req, res) => {
  res.send("✅ Local Shopify-Twilio backend is running");
});

// Simple test route to send a manual SMS (use this first)
app.get("/test-message", async (req, res) => {
  try {
    const to = req.query.to; // optional: pass ?to=+91XXXXXXXXXX
    if (!to) return res.status(400).send("Provide ?to=+91XXXXXXXXXX in URL for testing");

    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE.replace(/\s+/g, ""), // remove spaces
      to,
      body: "Test SMS from your local Shopify-Twilio backend ✅"
    });

    console.log("✅ Test SMS sent, SID:", message.sid);
    return res.send({ ok: true, sid: message.sid });
  } catch (err) {
    console.error("Error sending test SMS:", err);
    return res.status(500).send({ ok: false, error: err.message });
  }
});

// Webhook: Order created (Shopify -> POST here)
app.post("/webhook/order-created", async (req, res) => {
  try {
    const body = req.body;
    console.log("➡️ /webhook/order-created received:", JSON.stringify(body, null, 2));

    const phone = body?.customer?.phone;
    const name = body?.customer?.first_name || "Customer";
    const orderId = body?.name || body?.id || "unknown";

    if (!phone) {
      console.log("⚠️ No phone found on order - skipping SMS");
      return res.status(200).send("No phone number on order");
    }

    // Send SMS via Twilio
    const msg = await client.messages.create({
      from: process.env.TWILIO_PHONE.replace(/\s+/g, ""),
      to: phone,
      body: `Hey ${name}, your order ${orderId} has been placed successfully!`
    });

    console.log(`📲 SMS sent to ${phone} (SID: ${msg.sid})`);
    return res.status(200).send("SMS sent");
  } catch (err) {
    console.error("❌ Error in order-created webhook:", err);
    return res.status(500).send("Server error");
  }
});

// Webhook: Order fulfilled (Shopify -> POST here)
app.post("/webhook/order-fulfilled", async (req, res) => {
  try {
    const body = req.body;
    console.log("➡️ /webhook/order-fulfilled received:", JSON.stringify(body, null, 2));

    const order = body?.order || body; // Shopify may send fulfillment object or order directly
    const phone = order?.customer?.phone;
    const name = order?.customer?.first_name || "Customer";
    const orderId = order?.name || order?.id || "unknown";

    if (!phone) {
      console.log("⚠️ No phone found on order - skipping delivery SMS");
      return res.status(200).send("No phone number on order");
    }

    const msg = await client.messages.create({
      from: process.env.TWILIO_PHONE.replace(/\s+/g, ""),
      to: phone,
      body: `Hi ${name}, your order ${orderId} has been delivered. Enjoy!`
    });

    console.log(`📲 Delivery SMS sent to ${phone} (SID: ${msg.sid})`);
    return res.status(200).send("Delivery SMS sent");
  } catch (err) {
    console.error("❌ Error in order-fulfilled webhook:", err);
    return res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Local server running on http://localhost:${PORT}`));
