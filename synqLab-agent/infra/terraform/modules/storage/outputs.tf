output "tf_state_bucket_name" {
  value = google_storage_bucket.tf_state.name
}

output "assets_bucket_name" {
  value = google_storage_bucket.assets.name
}

output "assets_bucket_url" {
  value = google_storage_bucket.assets.url
}
