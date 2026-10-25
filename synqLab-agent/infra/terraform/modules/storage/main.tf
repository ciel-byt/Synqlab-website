# ═══════════════════════════════════════════════════════════════════
# Storage Module — GCS buckets for TF state + FoldX assets
# ═══════════════════════════════════════════════════════════════════

# ─── Terraform state bucket ────────────────────────────────────
resource "google_storage_bucket" "tf_state" {
  name          = var.tf_state_bucket
  project       = var.project_id
  location      = var.region
  storage_class = "STANDARD"

  # Prevent accidental deletion of state
  force_destroy = false

  versioning {
    enabled = true
  }

  # Lifecycle: delete non-current versions after 90 days
  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
  labels                      = var.labels
}

# ─── Assets bucket (FoldX binary, model weights, etc.) ─────────
resource "google_storage_bucket" "assets" {
  name          = var.assets_bucket
  project       = var.project_id
  location      = var.region
  storage_class = "STANDARD"

  force_destroy = false

  uniform_bucket_level_access = true
  labels                      = var.labels
}
