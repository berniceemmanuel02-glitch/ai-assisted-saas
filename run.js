process.env.PAYSTACK_SECRET_KEY = "test_fake_key_for_paystack_tests";
process.env.PAYSTACK_MOCK = "true";
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only";
process.env.FLUTTERWAVE_SECRET_HASH = "test-flutterwave-hash-for-unit-tests-only";

const { spawn } = require("node:child_process");

const server = spawn("node", ["backend/server.js"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

server.on("error", (err) => {
  console.error("Failed to start test server:", err.message);
  process.exit(1);
});

let serverReady = false;
server.stdout.on("data", (data) => {
  process.stdout.write(data);
  if (data.toString().includes("server running")) {
    serverReady = true;
  }
});

server.stderr.on("data", (data) => {
  process.stderr.write(data);
});

setTimeout(() => {
  if (!serverReady) {
    console.error("Server did not start within timeout");
    server.kill("SIGTERM");
    process.exit(1);
  }

  const child = spawn("node", ["--test", "--test-concurrency=1"], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    server.kill("SIGTERM");
    process.exit(code);
  });
}, 10000);
