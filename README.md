# microservice-demo — Proxmox Cluster Dashboard

A small web app, running inside your Kubernetes cluster, that talks to the
Proxmox API and lets you view and start/stop the VMs your cluster runs on
(and any other VMs on the same Proxmox host) — deployed through a full
CI/CD + GitOps pipeline.

Flow: push code -> GitHub Actions builds & pushes image to GHCR -> Actions
commits new image tag to `k8s/deployment.yaml` -> ArgoCD detects the Git
change -> ArgoCD deploys it to your cluster automatically.

## Proxmox API token setup (do this once, in the Proxmox UI)

Datacenter -> Permissions -> API Tokens -> Add:
- User: root@pam (or a dedicated user)
- Token ID: k8s-dashboard
- Uncheck "Privilege Separation" for simplicity in a home lab (or scope
  permissions properly if you want to be stricter)

Copy the generated Token ID and Secret — you'll only see the secret once.

Then create the real Kubernetes Secret directly on the cluster (see
`k8s/secret.example.yaml` for the exact command) — never commit real
credentials to Git.

See the main chat instructions for full step-by-step setup (creating the
repo, installing ArgoCD, installing Prometheus/Grafana, etc).
