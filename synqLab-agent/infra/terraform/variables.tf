# ═══════════════════════════════════════════════════════════════════
# SynqLab — Input Variables
# ═══════════════════════════════════════════════════════════════════

# ─── Project ────────────────────────────────────────────────────
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# ─── Networking ─────────────────────────────────────────────────
variable "vpc_name" {
  description = "Name of the VPC network"
  type        = string
  default     = "synqlab-vpc"
}

variable "subnet_cidr" {
  description = "CIDR range for the primary subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR for GKE pods"
  type        = string
  default     = "10.4.0.0/14"
}

variable "services_cidr" {
  description = "Secondary CIDR for GKE services"
  type        = string
  default     = "10.8.0.0/20"
}

# ─── GKE ────────────────────────────────────────────────────────
variable "cluster_name" {
  description = "Name of the GKE Autopilot cluster"
  type        = string
  default     = "synqlab-cluster"
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "master_authorized_cidr" {
  description = "CIDR allowed to access the K8s API server"
  type        = string
  default     = "0.0.0.0/0"
}

# ─── Artifact Registry ─────────────────────────────────────────
variable "registry_name" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "synqlab"
}

# ─── Storage (GCS) ─────────────────────────────────────────────
variable "foldx_bucket_name" {
  description = "GCS bucket name for FoldX binary and other large assets"
  type        = string
  default     = "project-41f6f4ea-8a21-4190-a8a-assets"
}

# ─── Domain / Ingress ──────────────────────────────────────────
variable "domain" {
  description = "Domain name for the application (e.g., app.synqlab.io)"
  type        = string
  default     = ""
}

variable "enable_ingress" {
  description = "Whether to reserve a global static IP for Ingress"
  type        = bool
  default     = true
}
