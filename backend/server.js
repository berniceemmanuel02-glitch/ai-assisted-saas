const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || ["http://localhost:3000", "http://localhost:5000"],
  credentials: true,
};
app.use(cors(corsOptions));

app.post("/api/payments/paystack/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) {
    return res.status(400).json({ message: "Missing signature or Paystack secret key not configured" });
  }

  if (!req.body) {
    return res.status(400).json({ message: "Missing request body" });
  }

  const crypto = require("crypto");
  const hash = crypto.createHmac("sha512", secret).update(req.body).digest("hex");
  if (hash !== signature) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = JSON.parse(req.body);
  if (event.event === "charge.success") {
    const reference = event.data.reference;
    const payments = require("./data/store").payments.getAll();
    const idx = payments.findIndex((p) => p.reference === reference);
    if (idx !== -1) {
      const updated = payments[idx];
      if (updated.status === "paid") {
        return res.status(200).json({ received: true, message: "Already processed" });
      }

      const student = require("./data/store").students.getById(updated.studentId);
      if (!student) {
        return res.status(400).json({ message: "Invalid payment: student not found" });
      }

      const fee = require("./data/store").feeStructures.getById(updated.feeStructureId);
      if (!fee || fee.schoolId !== student.schoolId) {
        return res.status(400).json({ message: "Invalid payment: fee/school mismatch" });
      }

      const expectedAmountKobo = Math.round((fee.amount || updated.amount) * 100);
      const webhookAmount = event.data.amount || 0;
      if (webhookAmount !== expectedAmountKobo) {
        return res.status(400).json({ message: "Amount mismatch" });
      }

      updated.status = "paid";
      updated.paidAt = new Date().toISOString();
      updated.updatedAt = new Date().toISOString();
      require("fs").writeFileSync(require("path").join(__dirname, "data", "payments.json"), JSON.stringify([...payments.slice(0, idx), updated, ...payments.slice(idx + 1)], null, 2));
    }
  }

  res.status(200).json({ received: true });
});

app.post("/api/payments/flutterwave/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["verif-hash"];
  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secret || !signature) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const expectedSignature = require("crypto").createHmac("sha256", secret).update(req.body).digest("hex");
  if (signature !== expectedSignature) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = JSON.parse(req.body);
  if (event.event === "charge.completed" && event.data.status === "successful") {
    const txRef = event.data.tx_ref;
    const payments = require("./data/store").payments.getAll();
    const idx = payments.findIndex((p) => p.reference === txRef);
    if (idx !== -1) {
      const updated = payments[idx];
      if (updated.status === "paid") {
        return res.status(200).json({ received: true, message: "Already processed" });
      }

      const student = require("./data/store").students.getById(updated.studentId);
      if (!student) {
        return res.status(400).json({ message: "Invalid payment: student not found" });
      }

      const fee = require("./data/store").feeStructures.getById(updated.feeStructureId);
      if (!fee || fee.schoolId !== student.schoolId) {
        return res.status(400).json({ message: "Invalid payment: fee/school mismatch" });
      }

      const expectedAmountKobo = Math.round((fee.amount || updated.amount) * 100);
      const webhookAmount = event.data.amount || 0;
      if (webhookAmount !== expectedAmountKobo) {
        return res.status(400).json({ message: "Amount mismatch" });
      }

      updated.status = "paid";
      updated.paidAt = new Date().toISOString();
      updated.updatedAt = new Date().toISOString();
      require("fs").writeFileSync(require("path").join(__dirname, "data", "payments.json"), JSON.stringify([...payments.slice(0, idx), updated, ...payments.slice(idx + 1)], null, 2));
    }
  }

  res.status(200).json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.use("/api/health", require("./routes/health"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/parent-auth", require("./routes/parent-auth"));
app.use("/api/schools", require("./routes/schools"));
app.use("/api/students", require("./routes/students"));
app.use("/api/fee-structures", require("./routes/fee-structures"));
app.use("/api/payments", require("./routes/payments").router);
app.use("/api/receipts", require("./routes/receipts"));
app.use("/api/parents", require("./routes/parents"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/plans", require("./routes/plans"));
app.use("/api/subscriptions", require("./routes/subscriptions"));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Scholapay server running on http://localhost:${PORT}`);

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.warn("WARNING: PAYSTACK_SECRET_KEY is not set. Online payments will not work.");
  }
});

module.exports = app;
