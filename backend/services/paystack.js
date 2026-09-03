const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getPaystackConfig() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !secretKey.trim()) {
    return { configured: false };
  }
  return {
    configured: true,
    secretKey,
    baseUrl: PAYSTACK_BASE_URL,
  };
}

function getMockResponse(url) {
  if (url.includes("/transaction/initialize")) {
    return {
      ok: true,
      json: async () => ({
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://checkout.paystack.com/mock",
          access_code: "mock_access_code",
          reference: "SCH-MOCK-" + Date.now().toString(36).toUpperCase(),
        },
      }),
    };
  }

  if (url.includes("/transaction/verify")) {
    return {
      ok: true,
      json: async () => ({
        status: true,
        message: "Verification successful",
        data: {
          status: "success",
          amount: 500000,
          currency: "NGN",
          reference: "SCH-MOCK-" + Date.now().toString(36).toUpperCase(),
          paid_at: new Date().toISOString(),
          transaction_date: new Date().toISOString(),
          channel: "card",
          customer: { email: "mock@example.com" },
        },
      }),
    };
  }

  return { ok: false, json: async () => ({ status: false, message: "Not found" }) };
}

async function initializePaystackTransaction({ email, amountKobo, reference, metadata = {}, callbackUrl }) {
  const config = getPaystackConfig();
  if (!config.configured) {
    return { initialized: false, error: "Paystack secret key is not configured" };
  }

  if (process.env.PAYSTACK_MOCK === "true") {
    const mockRes = getMockResponse(`${PAYSTACK_BASE_URL}/transaction/initialize`);
    const data = await mockRes.json();
    return {
      initialized: true,
      reference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  }

  const payload = {
    email,
    amount: amountKobo,
    reference,
    metadata,
  };
  if (callbackUrl) {
    payload.callback_url = callbackUrl;
  }

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.status !== true) {
      return { initialized: false, error: data.message || "Paystack initialization failed" };
    }

    return {
      initialized: true,
      reference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  } catch (error) {
    return { initialized: false, error: error.message };
  }
}

async function verifyPaystackTransaction({ reference }) {
  const config = getPaystackConfig();
  if (!config.configured) {
    return { verified: false, error: "Paystack secret key is not configured" };
  }

  if (process.env.PAYSTACK_MOCK === "true") {
    const mockRes = getMockResponse(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`);
    const data = await mockRes.json();
    const transaction = data.data;
    const isSuccessful = transaction.status === "success";

    return {
      verified: true,
      successful: isSuccessful,
      amount: transaction.amount,
      currency: transaction.currency,
      reference: transaction.reference,
      paidAt: transaction.paid_at || transaction.transaction_date,
      channel: transaction.channel,
      customer: transaction.customer,
      error: isSuccessful ? null : `Transaction status: ${transaction.status}`,
    };
  }

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.secretKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok || data.status !== true) {
      return { verified: false, error: data.message || "Paystack verification failed" };
    }

    const transaction = data.data;
    const isSuccessful = transaction.status === "success";

    return {
      verified: true,
      successful: isSuccessful,
      amount: transaction.amount,
      currency: transaction.currency,
      reference: transaction.reference,
      paidAt: transaction.paid_at || transaction.transaction_date,
      channel: transaction.channel,
      customer: transaction.customer,
      error: isSuccessful ? null : `Transaction status: ${transaction.status}`,
    };
  } catch (error) {
    return { verified: false, error: error.message };
  }
}

function verifyPaystackWebhookSignature({ payload, signature, secretKey }) {
  if (!secretKey || !secretKey.trim()) {
    return { valid: false, error: "Paystack secret key is not configured" };
  }

  try {
    const crypto = require("crypto");
    const hash = crypto.createHmac("sha512", secretKey).update(payload).digest("hex");
    const isValid = hash === signature;

    return { valid: isValid, error: isValid ? null : "Invalid webhook signature" };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

module.exports = {
  getPaystackConfig,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
};
