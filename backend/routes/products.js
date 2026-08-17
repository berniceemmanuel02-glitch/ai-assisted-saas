const express = require("express");
const router = express.Router();
const db = require("../data/store");
const plans = require("../config/plans");
const { authMiddleware } = require("../middleware/auth");

router.post("/", authMiddleware, (req, res) => {
  try {
    const { name, price, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }

    const sub = db.subscriptions.getByUserId(req.user.id);
    const planId = sub ? sub.planId : "free";
    const limits = plans[planId].limits;
    const currentProducts = db.products.getByUserId(req.user.id);

    if (limits.products !== Infinity && currentProducts.length >= limits.products) {
      return res.status(403).json({
        message: "Product limit exceeded",
        limit: limits.products,
        current: currentProducts.length,
        plan: planId,
      });
    }

    const product = {
      id: Date.now().toString(),
      userId: req.user.id,
      name: name.trim(),
      price: price || 0,
      description: description || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.products.create(product);
    res.status(201).json({ message: "Product created", product });
  } catch (error) {
    res.status(500).json({ message: "Product creation failed", error: error.message });
  }
});

router.get("/", authMiddleware, (req, res) => {
  const products = db.products.getByUserId(req.user.id);
  res.json({ products });
});

router.get("/:id", authMiddleware, (req, res) => {
  const product = db.products.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  if (product.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  res.json({ product });
});

router.put("/:id", authMiddleware, (req, res) => {
  const { name, price, description } = req.body;

  if (!name && !price && description === undefined) {
    return res.status(400).json({ message: "Provide at least one field to update" });
  }

  const product = db.products.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  if (product.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  const updated = db.products.update(req.params.id, {
    name: name !== undefined ? name.trim() : product.name,
    price: price !== undefined ? price : product.price,
    description: description !== undefined ? description : product.description,
    updatedAt: new Date().toISOString(),
  });

  res.json({ message: "Product updated", product: updated });
});

router.delete("/:id", authMiddleware, (req, res) => {
  const product = db.products.getById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  if (product.userId !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  db.products.delete(req.params.id);
  res.json({ message: "Product deleted" });
});

module.exports = router;
