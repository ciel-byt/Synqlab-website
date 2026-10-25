# ═══════════════════════════════════════════════════════════════════
# IAM Module — Service Accounts + Workload Identity
# ═══════════════════════════════════════════════════════════════════

# GCP Service Account that K8s pods will impersonate via Workload Identity
resource "google_service_account" "workload" {
  project      = var.project_id
  account_id   = var.sa_name
  display_name = "SynqLab Workload Identity SA"
}

# ── Workload Identity binding ──────────────────────────────────
# Allows the K8s SA "synqlab" in namespace "synqlab" to act as this GCP SA
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.namespace}/${var.sa_name}]"
}

# ── Artifact Registry reader (pull images) ─────────────────────
resource "google_project_iam_member" "registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.workload.email}"
}

# ── GCS object admin (Avatar uploads + FoldX binary) ────────────
resource "google_storage_bucket_iam_member" "assets_admin" {
  bucket = var.assets_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.workload.email}"
}
