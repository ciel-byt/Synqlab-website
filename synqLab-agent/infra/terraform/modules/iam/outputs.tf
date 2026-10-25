output "gcp_service_account_email" {
  value = google_service_account.workload.email
}

output "k8s_service_account_name" {
  value = var.sa_name
}

output "workload_identity_annotation" {
  description = "Annotation to add to the K8s ServiceAccount"
  value       = "iam.gke.io/gcp-service-account=${google_service_account.workload.email}"
}
