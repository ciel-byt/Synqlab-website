# ═══════════════════════════════════════════════════════════════════
# SynqLab — Terraform Outputs
# ═══════════════════════════════════════════════════════════════════

output "cluster_name" {
  description = "GKE cluster name"
  value       = module.gke.cluster_name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke.cluster_endpoint
  sensitive   = true
}

output "kubeconfig_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}"
}

output "registry_url" {
  description = "Artifact Registry URL for Docker images"
  value       = module.artifact_registry.registry_url
}

output "docker_push_prefix" {
  description = "Full image prefix for docker push (e.g., us-central1-docker.pkg.dev/<project-id>/synqlab)"
  value       = module.artifact_registry.docker_push_prefix
}

output "assets_bucket" {
  description = "GCS bucket for FoldX binary and assets"
  value       = module.storage.assets_bucket_name
}

output "static_ip_address" {
  description = "Reserved global static IP for Ingress (point your GoDaddy DNS here)"
  value       = var.enable_ingress ? google_compute_global_address.ingress[0].address : "N/A"
}

output "workload_identity_sa" {
  description = "GCP service account email for Workload Identity"
  value       = module.iam.gcp_service_account_email
}
