const API_BASE = "https://ai-assisted-saas-ypgu.onrender.com";

const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem("salesbook_token");
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: "POST", body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: "PUT", body: JSON.stringify(body) }); },
  delete(path) { return this.request(path, { method: "DELETE" }); },
};

window.api = api;
