"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

const defaultCheckout = {
  customerName: "Gulraeez Gulshan",
  customerEmail: "gulraizgulshan@gmail.com",
  paymentMethod: "card"
};

function formatCurrency(amountInCents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PKR"
  }).format((amountInCents || 0) / 100);
}

function buildBrowserSafeId() {
  if (typeof window === "undefined") {
    return "demo-cart";
  }

  const cryptoApi = window.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().slice(0, 8);
  }

  if (cryptoApi?.getRandomValues) {
    const values = cryptoApi.getRandomValues(new Uint32Array(2));
    return Array.from(values, (value) => value.toString(16).padStart(8, "0"))
      .join("")
      .slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

function createCartId() {
  if (typeof window === "undefined") {
    return "demo-cart";
  }

  const existing = window.localStorage.getItem("demo-cart-id");

  if (existing) {
    return existing;
  }

  const nextId = `cart-${buildBrowserSafeId()}`;
  window.localStorage.setItem("demo-cart-id", nextId);
  return nextId;
}

export default function HomePage() {
  const [cartId, setCartId] = useState("");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({ items: [], summary: { itemCount: 0, totalCents: 0 } });
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [checkout, setCheckout] = useState(defaultCheckout);
  const [statusMessage, setStatusMessage] = useState("Loading demo services...");
  const [isBusy, setIsBusy] = useState(false);

  const architectureSteps = useMemo(
    () => [
      "1. Frontend calls the gateway through Next.js route handlers.",
      "2. Gateway forwards requests to the right microservice.",
      "3. Cart stores live data in Redis while catalog, orders, and notifications use PostgreSQL schemas.",
      "4. Order service calls payment and notification services to finish checkout.",
      "5. On ECS, the same services run on Fargate with ALB, API Gateway, Cloud Map, ECR, RDS, and ElastiCache."
    ],
    []
  );

  async function readJson(response) {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload.error || payload.details?.reason || payload.message || "Request failed";
      throw new Error(message);
    }

    return payload;
  }

  async function refreshCatalog() {
    const response = await fetch("/api/store/products", { cache: "no-store" });
    const payload = await readJson(response);
    setProducts(payload.products || []);
  }

  async function refreshCart(activeCartId) {
    const response = await fetch(`/api/store/cart/${activeCartId}`, { cache: "no-store" });
    const payload = await readJson(response);
    setCart(payload);
  }

  async function refreshOrders() {
    const response = await fetch("/api/store/orders", { cache: "no-store" });
    const payload = await readJson(response);
    setOrders(payload.orders || []);
  }

  async function refreshNotifications() {
    const response = await fetch("/api/store/notifications", { cache: "no-store" });
    const payload = await readJson(response);
    setNotifications(payload.notifications || []);
  }

  async function refreshDashboard(activeCartId) {
    await Promise.all([
      refreshCatalog(),
      refreshCart(activeCartId),
      refreshOrders(),
      refreshNotifications()
    ]);
  }

  useEffect(() => {
    const nextCartId = createCartId();
    setCartId(nextCartId);

    refreshDashboard(nextCartId)
      .then(() => setStatusMessage("Local gateway and services are ready for the classroom demo."))
      .catch((error) => {
        setStatusMessage(error.message);
      });
  }, []);

  async function runAction(action, successMessage) {
    if (!cartId) {
      return;
    }

    setIsBusy(true);
    setStatusMessage("Processing request across services...");

    try {
      await action();

      startTransition(() => {
        refreshDashboard(cartId)
          .then(() => setStatusMessage(successMessage))
          .catch((error) => setStatusMessage(error.message));
      });
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function addToCart(productId) {
    await runAction(async () => {
      const response = await fetch(`/api/store/cart/${cartId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId,
          quantity: 1
        })
      });

      await readJson(response);
    }, "Cart updated through the gateway and Redis.");
  }

  async function removeFromCart(productId) {
    await runAction(async () => {
      const response = await fetch(`/api/store/cart/${cartId}/items/${productId}`, {
        method: "DELETE"
      });

      await readJson(response);
    }, "Cart item removed.");
  }

  async function checkoutCart() {
    await runAction(async () => {
      const response = await fetch("/api/store/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cartId,
          customer: {
            name: checkout.customerName,
            email: checkout.customerEmail
          },
          paymentMethod: checkout.paymentMethod
        })
      });

      const payload = await readJson(response);
      setStatusMessage(`Order ${payload.order.id} created. Payment and notification services were called.`);
    }, "Checkout completed and the order flow touched every service.");
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Next.js + Docker Compose + AWS ECS</p>
          <h1>Cloud-Native Cluster Orchestrator</h1>
          <p className="hero-copy">
            Enterprise microservices hub tracing end-to-end telemetry across isolation boundaries: 
            Gateway, Dynamic Catalog, Session State (Redis), Ledger Core (PostgreSQL), and Event Workers.
          </p>
        </div>
        <div className="status-panel">
          <span className="status-label">Runtime Engine Metrics</span>
          <p>{statusMessage}</p>
          <div className="chip-row">
            <span className="chip">Session: {cartId || "initializing"}</span>
            <span className="chip">Ledger Blocks: {orders.length}</span>
            <span className="chip">Queues: {notifications.length}</span>
          </div>
        </div>
      </section>

      <section className="architecture-grid">
        {architectureSteps.map((step) => (
          <article className="info-card" key={step}>
            <p>{step}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">State-Managed Inventory</p>
              <h2>Catalog Service Nodes</h2>
            </div>
            <button className="secondary-button" onClick={() => refreshDashboard(cartId)} type="button">
              Sync Node State
            </button>
          </div>

          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">{product.emoji || "📦"}</div>
                <div>
                  <h3>{product.name}</h3>
                  <p className="muted" style={{ fontSize: "0.88rem", marginTop: "4px" }}>{product.description}</p>
                </div>
                <div className="product-meta">
                  <span>{product.category}</span>
                  <strong>{formatCurrency(product.price_cents)}</strong>
                </div>
                <button disabled={isBusy} onClick={() => addToCart(product.id)} type="button">
                  Commit To Buffer
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="stack">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">In-Memory Cache Layer</p>
                <h2>Redis Ephemeral Buffer</h2>
              </div>
            </div>

            <div className="cart-list">
              {cart.items?.length ? (
                cart.items.map((item) => (
                  <div className="cart-item" key={item.productId}>
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted" style={{ fontSize: "0.8rem", margin: "4px 0 0" }}>
                        Units: {item.quantity} × {formatCurrency(item.priceCents)}
                      </p>
                    </div>
                    <button disabled={isBusy} onClick={() => removeFromCart(item.productId)} type="button">
                      Purge
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-copy">Buffer state clear. Provision assets inside catalog nodes to populate telemetry.</p>
              )}
            </div>

            <div className="summary-box">
              <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Staged Objects: {cart.summary?.itemCount || 0}</span>
              <strong>{formatCurrency(cart.summary?.totalCents || 0)}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Transactional Pipelines</p>
                <h2>Orchestrate Dispatch</h2>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Identity Name
                <input
                  onChange={(event) =>
                    setCheckout((current) => ({ ...current, customerName: event.target.value }))
                  }
                  value={checkout.customerName}
                />
              </label>
              <label>
                Routing Destination (Email)
                <input
                  onChange={(event) =>
                    setCheckout((current) => ({ ...current, customerEmail: event.target.value }))
                  }
                  value={checkout.customerEmail}
                />
              </label>
              <label>
                Payment Pipeline Gateway
                <select
                  onChange={(event) =>
                    setCheckout((current) => ({ ...current, paymentMethod: event.target.value }))
                  }
                  value={checkout.paymentMethod}
                >
                  <option value="card">Simulated Visa Wire</option>
                  <option value="bank-transfer">Simulated Ledger Transfer</option>
                  <option value="fail">Force Synthetic Exception</option>
                </select>
              </label>
            </div>

            <button
              className="primary-button"
              style={{ width: "100%", marginTop: "8px" }}
              disabled={isBusy || !cart.items?.length}
              onClick={checkoutCart}
              type="button"
            >
              Execute Distributed Sync
            </button>
          </section>
        </aside>
      </section>

      <section className="bottom-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">Persistent Ledger Database</p>
              <h2>PostgreSQL Relational Tables</h2>
            </div>
          </div>

          <div className="timeline">
            {orders.length ? (
              orders.map((order) => (
                <article className="timeline-item" key={order.id}>
                  <div>
                    <strong style={{ fontFamily: "monospace", color: "var(--accent)" }}>{order.id}</strong>
                    <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0 0" }}>
                      Ref: {order.customer_name} · {order.customer_email}
                    </p>
                  </div>
                  <div className="timeline-meta">
                    <span>{order.status}</span>
                    <br />
                    <strong style={{ color: "#ffffff" }}>{formatCurrency(order.total_cents)}</strong>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-copy">No active records written to PostgreSQL cluster.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-label">Event Stream & Broker Logs</p>
              <h2>Asynchronous Message Bus</h2>
            </div>
          </div>

          <div className="timeline">
            {notifications.length ? (
              notifications.map((notification) => (
                <article className="timeline-item" style={{ borderLeftColor: "rgba(127, 0, 255, 0.8)" }} key={notification.id}>
                  <div>
                    <strong style={{ color: "#ffffff" }}>{notification.recipient}</strong>
                    <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0 0" }}>{notification.message}</p>
                  </div>
                  <div className="timeline-meta">
                    <span style={{ color: "#c084fc" }}>{notification.channel}</span>
                    <br />
                    <strong style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{notification.status}</strong>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-copy">Awaiting dynamic intercept triggers from payment services.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}