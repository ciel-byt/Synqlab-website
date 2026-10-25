# ═══════════════════════════════════════════════════════════════════
# Artifact Registry Module — Docker image repository
# ═══════════════════════════════════════════════════════════════════

resource "google_artifact_registry_repository" "docker" {
  provider = google-beta

  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = "SynqLab Docker images"

  labels = var.labels

  # Clean up untagged images after 14 days
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "1209600s"  # 14 days
    }
  }

  # Keep last 10 tagged versions
  cleanup_policies {
    id     = "keep-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
}
