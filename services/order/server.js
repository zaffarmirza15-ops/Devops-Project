const { randomUUID } = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3003);
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@postgres:5432/commerce";
const DB_SCHEMA = process.env.DB_SCHEMA || "orders";
const DATABASE_SSL = process.env.DATABASE_SSL === "true";
const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
const CART_SERVICE_URL = process.env.CART_SERVICE_URL || "http://cart-service:3002";
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || "http://payment-service:3004";
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3005";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sanitizeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }

  return value;
}

async function withRetry(task, label) {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt === 15) {
        throw error;
      }

      console.log(`order-service retry ${attempt}/15 while waiting for ${label}`);
      await sleep(2000);
    }
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || payload.reason || `Request failed: ${url}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

const schema = sanitizeIdentifier(DB_SCHEMA);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL
    ? {
        rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED
      }
    : false
});

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        status TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        items JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

async function start() {
  await withRetry(initializeDatabase, "postgres");

  const app = express();
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      service: "order-service",
      status: "ok"
    });
  });

  app.get("/orders", async (_request, response) => {
    const result = await pool.query(
      `
        SELECT
          id,
          customer_name,
          customer_email,
          payment_method,
          payment_status,
          status,
          total_cents,
          items,
          created_at
        FROM ${schema}.orders
        ORDER BY created_at DESC
        LIMIT 20
      `
    );

    response.json({
      orders: result.rows
    });
  });

  app.post("/orders", async (request, response) => {
    const cartId = request.body.cartId;
    const customerName = request.body.customer?.name;
    const customerEmail = request.body.customer?.email;
    const paymentMethod = request.body.paymentMethod || "card";

    if (!cartId || !customerName || !customerEmail) {
      response.status(400).json({
        error: "cartId, customer.name, and customer.email are required"
      });
      return;
    }

    try {
      const cart = await fetchJson(`${CART_SERVICE_URL}/cart/${cartId}`);

      if (!cart.items?.length) {
        response.status(400).json({
          error: "Cannot checkout an empty cart"
        });
        return;
      }

      const orderId = `ord_${randomUUID().slice(0, 8)}`;
      const payment = await fetchJson(`${PAYMENT_SERVICE_URL}/payments`, {
        method: "POST",
        body: JSON.stringify({
          orderId,
          amountCents: cart.summary.totalCents,
          paymentMethod,
          customerEmail
        })
      });

      const result = await pool.query(
        `
          INSERT INTO ${schema}.orders (
            id,
            customer_name,
            customer_email,
            payment_method,
            payment_status,
            status,
            total_cents,
            items
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          RETURNING
            id,
            customer_name,
            customer_email,
            payment_method,
            payment_status,
            status,
            total_cents,
            items,
            created_at
        `,
        [
          orderId,
          customerName,
          customerEmail,
          paymentMethod,
          payment.status,
          "created",
          cart.summary.totalCents,
          JSON.stringify(cart.items)
        ]
      );

      await fetchJson(`${NOTIFICATION_SERVICE_URL}/notifications`, {
        method: "POST",
        body: JSON.stringify({
          orderId,
          recipient: customerEmail,
          channel: "email",
          status: "queued",
          message: `Order ${orderId} confirmed for ${customerName}`
        })
      });

      await fetchJson(`${CART_SERVICE_URL}/cart/${cartId}`, {
        method: "DELETE"
      });

      response.status(201).json({
        order: result.rows[0]
      });
    } catch (error) {
      response.status(error.statusCode || 500).json({
        error: error.message,
        details: error.payload || null
      });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`order-service listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error("order-service failed to start", error);
  process.exit(1);
});
