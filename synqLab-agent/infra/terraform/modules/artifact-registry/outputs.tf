output "repository_id" {
  value = google_artifact_registry_repository.docker.repository_id
}

output "registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "docker_push_prefix" {
  description = "Use as image prefix: docker tag myimage <prefix>/myimage:tag"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
