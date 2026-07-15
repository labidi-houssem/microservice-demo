const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Proxmox connection config (set via env vars / k8s Secret) ---
const PROXMOX_HOST = process.env.PROXMOX_HOST;             // e.g. https://192.168.1.10:8006
const TOKEN_ID = process.env.PROXMOX_TOKEN_ID;              // e.g. root@pam!mytoken
const TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET;      // token secret value

// Proxmox commonly uses a self-signed cert; allow opting out of verification
if (process.env.PROXMOX_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

let requestCount = 0;

function proxmoxConfigured() {
  return Boolean(PROXMOX_HOST && TOKEN_ID && TOKEN_SECRET);
}

async function proxmoxRequest(apiPath, method = 'GET') {
  if (!proxmoxConfigured()) {
    throw new Error('Proxmox is not configured (missing PROXMOX_HOST / PROXMOX_TOKEN_ID / PROXMOX_TOKEN_SECRET)');
  }
  const res = await fetch(`${PROXMOX_HOST}/api2/json${apiPath}`, {
    method,
    headers: {
      Authorization: `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxmox API ${method} ${apiPath} failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.data;
}

// Health check - used by k8s liveness/readiness probes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Basic Prometheus-style metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(
    `# HELP app_requests_total Total number of requests served\n` +
    `# TYPE app_requests_total counter\n` +
    `app_requests_total ${requestCount}\n` +
    `# HELP proxmox_configured Whether Proxmox API credentials are set\n` +
    `# TYPE proxmox_configured gauge\n` +
    `proxmox_configured ${proxmoxConfigured() ? 1 : 0}\n`
  );
});

// List Proxmox nodes
app.get('/api/nodes', async (req, res) => {
  requestCount++;
  try {
    const nodes = await proxmoxRequest('/nodes');
    res.json(nodes);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// List all VMs (QEMU) across all nodes, with status
app.get('/api/vms', async (req, res) => {
  requestCount++;
  try {
    const nodes = await proxmoxRequest('/nodes');
    const allVms = [];
    for (const node of nodes) {
      const vms = await proxmoxRequest(`/nodes/${node.node}/qemu`);
      vms.forEach(vm => allVms.push({ ...vm, node: node.node }));
    }
    res.json(allVms);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Start a VM
app.post('/api/vms/:node/:vmid/start', async (req, res) => {
  try {
    const result = await proxmoxRequest(`/nodes/${req.params.node}/qemu/${req.params.vmid}/status/start`, 'POST');
    res.json({ task: result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Stop a VM
app.post('/api/vms/:node/:vmid/stop', async (req, res) => {
  try {
    const result = await proxmoxRequest(`/nodes/${req.params.node}/qemu/${req.params.vmid}/status/stop`, 'POST');
    res.json({ task: result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxmox dashboard listening on port ${PORT}`);
  console.log(`Proxmox configured: ${proxmoxConfigured()}`);
});
