const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@postgres:5432/commerce";
const DB_SCHEMA = process.env.DB_SCHEMA || "catalog";
const DATABASE_SSL = process.env.DATABASE_SSL === "true";
const DATABASE_SSL_REJECT_UNAUTHORIZED =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

const products = [
  {
    id: "prod_camera",
    name: "Trail Camera",
    description: "A classroom-friendly product to show catalog reads from PostgreSQL.",
    priceCents: 18900,
    stock: 12,
    category: "Electronics",
    imageUrl: "camera",
    emoji: "camera"
  },
  {
    id: "prod_keyboard",
    name: "Mechanical Keyboard",
    description: "Great for explaining how carts take a price snapshot from the catalog service.",
    priceCents: 12900,
    stock: 18,
    category: "Accessories",
    imageUrl: "keyboard",
    emoji: "keyboard"
  },
  {
    id: "prod_lamp",
    name: "Studio Lamp",
    description: "Useful when you want one more product to demonstrate REST lookups by ID.",
    priceCents: 7600,
    stock: 24,
    category: "Home",
    imageUrl: "lamp",
    emoji: "lamp"
  },
  {
    id: "prod_mug",
    name: "Team Mug",
    description: "A small product that makes repeat checkout demos feel more realistic.",
    priceCents: 1900,
    stock: 55,
    category: "Lifestyle",
    imageUrl: "mug",
    emoji: "mug"
  },
  {
    id: "prod_notebook",
    name: "Field Notebook",
    description: "Pairs nicely with the notification flow because students can order multiple copies.",
    priceCents: 2300,
    stock: 33,
    category: "Stationery",
    imageUrl: "notebook",
    emoji: "notebook"
  },
  {
    id: "prod_speaker",
    name: "Pocket Speaker",
    description: "Lets you demonstrate a higher-value checkout and mock payment request.",
    priceCents: 9900,
    stock: 9,
    category: "Audio",
    imageUrl: "speaker",
    emoji: "speaker"
  }
];

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

      console.log(`catalog-service retry ${attempt}/15 while waiting for ${label}`);
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
      CREATE TABLE IF NOT EXISTS ${schema}.products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        stock INTEGER NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM ${schema}.products`);

    if (countResult.rows[0].count === 0) {
      for (const product of products) {
        await client.query(
          `
            INSERT INTO ${schema}.products (
              id,
              name,
              description,
              price_cents,
              stock,
              category,
              image_url,
              emoji
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            product.id,
            product.name,
            product.description,
            product.priceCents,
            product.stock,
            product.category,
            product.imageUrl,
            product.emoji
          ]
        );
      }
    }
  } finally {
    client.release();
  }
}

async function start() {
  await withRetry(initializeDatabase, "postgres");

  const app = express();

  app.get("/health", (_request, response) => {
    response.json({
      service: "catalog-service",
      status: "ok"
    });
  });

  app.get("/products", async (_request, response) => {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          price_cents,
          stock,
          category,
          image_url,
          emoji
        FROM ${schema}.products
        ORDER BY name ASC
      `
    );

    response.json({
      products: result.rows
    });
  });

  app.get("/products/:id", async (request, response) => {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          price_cents,
          stock,
          category,
          image_url,
          emoji
        FROM ${schema}.products
        WHERE id = $1
      `,
      [request.params.id]
    );

    if (!result.rows.length) {
      response.status(404).json({
        error: "Product not found"
      });
      return;
    }

    response.json({
      product: result.rows[0]
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`catalog-service listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error("catalog-service failed to start", error);
  process.exit(1);
});
