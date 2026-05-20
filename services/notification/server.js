const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3005);
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@postgres:5432/commerce";
const DB_SCHEMA = process.env.DB_SCHEMA || "notification";
const DATABASE_SSL = process.env.DATABASE_SSL === "true";
const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

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

      console.log(`notification-service retry ${attempt}/15 while waiting for ${label}`);
      await sleep(2000);
    }
  }
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
      CREATE TABLE IF NOT EXISTS ${schema}.notifications (
        id SERIAL PRIMARY KEY,
        order_id TEXT NOT NULL,
        recipient TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
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
      service: "notification-service",
      status: "ok"
    });
  });

  app.get("/notifications", async (_request, response) => {
    const result = await pool.query(
      `
        SELECT
          id,
          order_id,
          recipient,
          channel,
          status,
          message,
          created_at
        FROM ${schema}.notifications
        ORDER BY created_at DESC
        LIMIT 20
      `
    );

    response.json({
      notifications: result.rows
    });
  });

  app.post("/notifications", async (request, response) => {
    const { orderId, recipient, channel, status, message } = request.body;

    if (!orderId || !recipient || !channel || !status || !message) {
      response.status(400).json({
        error: "orderId, recipient, channel, status, and message are required"
      });
      return;
    }

    const result = await pool.query(
      `
        INSERT INTO ${schema}.notifications (
          order_id,
          recipient,
          channel,
          status,
          message
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          order_id,
          recipient,
          channel,
          status,
          message,
          created_at
      `,
      [orderId, recipient, channel, status, message]
    );

    response.status(201).json({
      notification: result.rows[0]
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`notification-service listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error("notification-service failed to start", error);
  process.exit(1);
});
