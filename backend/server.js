const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/plans", require("./routes/plans"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/usage", require("./routes/usage"));
app.use("/api/products", require("./routes/products"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/invoices", require("./routes/invoices"));

app.post("/api/payments/paystack/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) {
    return res.status(400).json({ message: "Missing signature" });
  }

  const crypto = require("crypto");
  const hash = crypto.createHmac("sha512", secret).update(JSON.stringify(req.body)).digest("hex");
  if (hash !== signature) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.body;
  if (event.event === "charge.success") {
    const reference = event.data.reference;
    const invoices = require("./data/store").invoices.getAll();
    const idx = invoices.findIndex((i) => i.invoiceNumber === reference);
    if (idx !== -1) {
      const updated = invoices[idx];
      updated.status = "paid";
      updated.paidAt = new Date().toISOString();
      require("fs").writeFileSync(require("path").join(__dirname, "data", "invoices.json"), JSON.stringify([...invoices.slice(0, idx), updated, ...invoices.slice(idx + 1)], null, 2));
    }
  }

  res.status(200).json({ received: true });
});

app.post("/api/payments/flutterwave/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["verif-hash"];
  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secret || !signature || signature !== secret) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.body;
  if (event.event === "charge.completed" && event.data.status === "successful") {
    const txRef = event.data.tx_ref;
    const invoices = require("./data/store").invoices.getAll();
    const idx = invoices.findIndex((i) => i.invoiceNumber === txRef);
    if (idx !== -1) {
      const updated = invoices[idx];
      updated.status = "paid";
      updated.paidAt = new Date().toISOString();
      require("fs").writeFileSync(require("path").join(__dirname, "data", "invoices.json"), JSON.stringify([...invoices.slice(0, idx), updated, ...invoices.slice(idx + 1)], null, 2));
    }
  }

  res.status(200).json({ received: true });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
