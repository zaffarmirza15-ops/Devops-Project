const cors = require("cors");
const express = require("express");

const PORT = Number(process.env.PORT || 8080);
const serviceUrls = {
  catalog: process.env.CATALOG_SERVICE_URL || "http://catalog-service:3001",
  cart: process.env.CART_SERVICE_URL || "http://cart-service:3002",
  order: process.env.ORDER_SERVICE_URL || "http://order-service:3003",
  notification: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3005"
};

const app = express();

app.use(cors());
app.use(express.json());

async function forwardJson(method, targetUrl, body) {
  const response = await fetch(targetUrl, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `Upstream request failed: ${targetUrl}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function sendError(response, error) {
  response.status(error.statusCode || 500).json({
    error: error.message,
    details: error.payload || null
  });
}

app.get("/health", (_request, response) => {
  response.json({
    service: "gateway-service",
    status: "ok",
    services: serviceUrls
  });
});

app.get("/catalog/products", async (_request, response) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.catalog}/products`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/catalog/products/:id", async (request, response) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.catalog}/products/${request.params.id}`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/cart/:cartId", async (request, response) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.cart}/cart/${request.params.cartId}`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/cart/:cartId/items", async (request, response) => {
  try {
    const payload = await forwardJson(
      "POST",
      `${serviceUrls.cart}/cart/${request.params.cartId}/items`,
      request.body
    );
    response.status(201).json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/cart/:cartId/items/:productId", async (request, response) => {
  try {
    const payload = await forwardJson(
      "DELETE",
      `${serviceUrls.cart}/cart/${request.params.cartId}/items/${request.params.productId}`
    );
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.delete("/cart/:cartId", async (request, response) => {
  try {
    const payload = await forwardJson("DELETE", `${serviceUrls.cart}/cart/${request.params.cartId}`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/orders", async (_request, response) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.order}/orders`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/orders", async (request, response) => {
  try {
    const payload = await forwardJson("POST", `${serviceUrls.order}/orders`, request.body);
    response.status(201).json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/notifications", async (_request, response) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.notification}/notifications`);
    response.json(payload);
  } catch (error) {
    sendError(response, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`gateway-service listening on ${PORT}`);
});
