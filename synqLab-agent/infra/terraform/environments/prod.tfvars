# Prod environment overrides
project_id  = "project-41f6f4ea-8a21-4190-a8a"
region      = "us-central1"
environment = "prod"

cluster_name           = "synqlab-cluster"
release_channel        = "STABLE"
master_authorized_cidr = "YOUR_OFFICE_CIDR/32"   # restrict API access in prod

foldx_bucket_name = "project-41f6f4ea-8a21-4190-a8a-assets-prod"

domain         = "app.synqlab.ai"   # your GoDaddy domain
enable_ingress = true
