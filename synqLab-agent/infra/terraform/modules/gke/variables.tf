variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "network_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "release_channel" {
  type    = string
  default = "REGULAR"
}

variable "master_authorized_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "labels" {
  type    = map(string)
  default = {}
}

# ── Standard-mode node pool settings ─────────────────────────
variable "machine_type" {
  description = "GCE machine type for the general node pool"
  type        = string
  default     = "e2-standard-8"    # 8 vCPU, 32 GB — fits all pods after right-sizing
}

variable "disk_size_gb" {
  description = "Boot disk size in GB (pd-standard)"
  type        = number
  default     = 100
}

variable "max_nodes" {
  description = "Max nodes for the general node pool autoscaler"
  type        = number
  default     = 1   # e2-standard-8 (32 GB) fits all pods; benchmark-verified
}
