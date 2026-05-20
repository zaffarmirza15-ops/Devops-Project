const express = require("express");

const PORT = Number(process.env.PORT || 3004);

const app = express();
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    service: "payment-service",
    status: "ok"
  });
});

app.post("/payments", (request, response) => {
  const { orderId, amountCents, paymentMethod, customerEmail } = request.body;

  if (!orderId || !amountCents || !paymentMethod || !customerEmail) {
    response.status(400).json({
      error: "orderId, amountCents, paymentMethod, and customerEmail are required"
    });
    return;
  }

  if (paymentMethod === "fail") {
    response.status(402).json({
      status: "failed",
      transactionId: null,
      reason: "Mock payment failure requested for classroom demo"
    });
    return;
  }

  response.json({
    status: "approved",
    transactionId: `txn_${Math.random().toString(36).slice(2, 10)}`,
    orderId,
    amountCents,
    paymentMethod
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`payment-service listening on ${PORT}`);
});

