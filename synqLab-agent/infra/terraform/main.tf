# ═══════════════════════════════════════════════════════════════════
# SynqLab — Root Terraform Configuration
#
# Wires all modules together and creates shared resources.
#
# Bootstrap (first time):
#   1. Comment out the backend "gcs" block in versions.tf
#   2. terraform init && terraform apply -target=module.storage
#   3. Uncomment the backend block
#   4. terraform init -migrate-state
#   5. terraform apply
# ═══════════════════════════════════════════════════════════════════

locals {
  labels = {
    project     = "synqlab"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ─── Networking ─────────────────────────────────────────────────
module "network" {
  source = "./modules/network"

  project_id    = var.project_id
  region        = var.region
  vpc_name      = var.vpc_name
  subnet_cidr   = var.subnet_cidr
  pods_cidr     = var.pods_cidr
  services_cidr = var.services_cidr
  labels        = local.labels
}

# ─── GKE Autopilot ──────────────────────────────────────────────
module "gke" {
  source = "./modules/gke"

  project_id             = var.project_id
  region                 = var.region
  cluster_name           = "${var.cluster_name}-${var.environment}"
  network_id             = module.network.vpc_id
  subnet_id              = module.network.subnet_id
  pods_range_name        = module.network.pods_range_name
  services_range_name    = module.network.services_range_name
  release_channel        = var.release_channel
  master_authorized_cidr = var.master_authorized_cidr
  environment            = var.environment
  labels                 = local.labels
}

# ─── Artifact Registry ─────────────────────────────────────────
module "artifact_registry" {
  source = "./modules/artifact-registry"

  project_id    = var.project_id
  region        = var.region
  repository_id = var.registry_name
  labels        = local.labels
}

# ─── IAM + Workload Identity ───────────────────────────────────
module "iam" {
  source = "./modules/iam"

  project_id     = var.project_id
  cluster_name   = module.gke.cluster_name
  namespace      = "synqlab"
  sa_name        = "synqlab-workload"
  registry_id    = module.artifact_registry.repository_id
  assets_bucket  = module.storage.assets_bucket_name
  labels         = local.labels

  depends_on = [module.gke]  # Workload pool only exists after GKE cluster is created
}

# ─── GCS Storage (FoldX binary, TF state bucket) ───────────────
module "storage" {
  source = "./modules/storage"

  project_id        = var.project_id
  region            = var.region
  assets_bucket     = var.foldx_bucket_name
  tf_state_bucket   = "${var.project_id}-terraform-state"
  labels            = local.labels
}

# ─── Global Static IP for Ingress ──────────────────────────────
resource "google_compute_global_address" "ingress" {
  count   = var.enable_ingress ? 1 : 0
  name    = "synqlab-ingress-ip"
  project = var.project_id
}

# ─── Google-Managed SSL Certificate (if domain is set) ─────────
resource "google_compute_managed_ssl_certificate" "synqlab" {
  count   = var.domain != "" ? 1 : 0
  name    = "synqlab-cert"
  project = var.project_id

  managed {
    domains = [var.domain]
  }
}
