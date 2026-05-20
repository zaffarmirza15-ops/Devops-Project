const express = require("express");
const { createClient } = require("redis");

const PORT = Number(process.env.PORT || 3002);
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || "http://catalog-service:3001";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRetry(task, label) {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt === 15) {
        throw error;
      }

      console.log(`cart-service retry ${attempt}/15 while waiting for ${label}`);
      await sleep(2000);
    }
  }
}

function buildSummary(items) {
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalCents = items.reduce((total, item) => total + item.quantity * item.priceCents, 0);

  return {
    itemCount,
    totalCents
  };
}

function cartKey(cartId) {
  return `cart:${cartId}`;
}

async function fetchProduct(productId) {
  const response = await fetch(`${CATALOG_SERVICE_URL}/products/${productId}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load product");
  }

  return payload.product;
}

async function start() {
  const redis = createClient({
    url: REDIS_URL
  });

  await withRetry(() => redis.connect(), "redis");

  const app = express();
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      service: "cart-service",
      status: "ok"
    });
  });

  app.get("/cart/:cartId", async (request, response) => {
    const raw = await redis.get(cartKey(request.params.cartId));
    const items = raw ? JSON.parse(raw) : [];

    response.json({
      cartId: request.params.cartId,
      items,
      summary: buildSummary(items)
    });
  });

  app.post("/cart/:cartId/items", async (request, response) => {
    try {
      const quantity = Number(request.body.quantity || 1);

      if (!request.body.productId || Number.isNaN(quantity) || quantity < 1) {
        response.status(400).json({
          error: "productId and a positive quantity are required"
        });
        return;
      }

      const product = await fetchProduct(request.body.productId);
      const raw = await redis.get(cartKey(request.params.cartId));
      const items = raw ? JSON.parse(raw) : [];

      const existing = items.find((item) => item.productId === request.body.productId);

      if (existing) {
        existing.quantity += quantity;
      } else {
        items.push({
          productId: product.id,
          name: product.name,
          quantity,
          priceCents: product.price_cents,
          category: product.category
        });
      }

      await redis.set(cartKey(request.params.cartId), JSON.stringify(items));

      response.status(201).json({
        cartId: request.params.cartId,
        items,
        summary: buildSummary(items)
      });
    } catch (error) {
      response.status(400).json({
        error: error.message
      });
    }
  });

  app.delete("/cart/:cartId/items/:productId", async (request, response) => {
    const raw = await redis.get(cartKey(request.params.cartId));
    const items = raw ? JSON.parse(raw) : [];
    const nextItems = items.filter((item) => item.productId !== request.params.productId);

    await redis.set(cartKey(request.params.cartId), JSON.stringify(nextItems));

    response.json({
      cartId: request.params.cartId,
      items: nextItems,
      summary: buildSummary(nextItems)
    });
  });

  app.delete("/cart/:cartId", async (request, response) => {
    await redis.del(cartKey(request.params.cartId));

    response.json({
      cartId: request.params.cartId,
      items: [],
      summary: buildSummary([])
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`cart-service listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error("cart-service failed to start", error);
  process.exit(1);
});
