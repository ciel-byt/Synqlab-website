# ═══════════════════════════════════════════════════════════════════
# GKE Module — Standard Cluster (pd-standard boot disks)
#
# Switched from Autopilot to Standard to avoid pd-ssd boot disks
# that consume SSD quota. Single node pool with HDD for dev.
# ═══════════════════════════════════════════════════════════════════

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = var.cluster_name
  project  = var.project_id
  location = var.region

  # ── Standard mode (remove default node pool, we manage our own) ─
  remove_default_node_pool = true
  initial_node_count       = 1

  # Force default pool to use HDD (it's removed immediately, but GKE
  # still provisions it briefly and needs quota for pd-balanced otherwise)
  node_config {
    disk_type    = "pd-standard"
    disk_size_gb = 30
    machine_type = "e2-small"
  }

  # ── Networking ────────────────────────────────────────────────
  network    = var.network_id
  subnetwork = var.subnet_id

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # ── Private cluster ──────────────────────────────────────────
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # allow kubectl from outside
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.master_authorized_cidr
      display_name = "Authorized network"
    }
  }

  # ── Release channel ──────────────────────────────────────────
  release_channel {
    channel = var.release_channel
  }

  # ── Workload Identity ────────────────────────────────────────
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # ── Maintenance window (daily 2am-2pm UTC = off-peak hours) ──
  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T02:00:00Z"
      end_time   = "2024-01-01T14:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU"
    }
  }

  # ── Addons ───────────────────────────────────────────────────
  addons_config {
    gcs_fuse_csi_driver_config {
      enabled = true  # mount GCS buckets as volumes (for FoldX binary)
    }
  }

  resource_labels = var.labels

  # Prevent accidental deletion
  deletion_protection = var.environment == "prod" ? true : false
}

# ─── Node Pool — Always-on (tiny, for gateway + postgres + system) ──
resource "google_container_node_pool" "always_on" {
  provider = google-beta

  name     = "${var.cluster_name}-always-on"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.id

  node_locations = ["${var.region}-a"]

  # Fixed 1 node — always running
  autoscaling {
    min_node_count = 1
    max_node_count = 1
  }

  node_config {
    machine_type = "e2-standard-2"     # 2 vCPU, 8 GB — gateway + postgres + KEDA + monitoring
    disk_type    = "pd-standard"
    disk_size_gb = 30

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = merge(var.labels, {
      pool = "system"
    })

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── Node Pool — ML tools (scales 0-1, tainted for synqlab only) ───
resource "google_container_node_pool" "general" {
  provider = google-beta

  name     = "${var.cluster_name}-general"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.id

  node_locations = ["${var.region}-a"]

  # Scale 0-1: no cost when all ML pods are idle
  autoscaling {
    min_node_count = 0
    max_node_count = var.max_nodes
  }

  node_config {
    machine_type = var.machine_type
    disk_type    = "pd-standard"
    disk_size_gb = var.disk_size_gb

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = merge(var.labels, {
      pool = "ml"
    })

    # Taint: evicts any pod without matching toleration
    taint {
      key    = "synqlab/ml-pool"
      value  = "true"
      effect = "NO_EXECUTE"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── Node Pool — GPU (NVIDIA L4) for ML inference ──────────────
resource "google_container_node_pool" "gpu" {
  provider = google-beta

  name     = "${var.cluster_name}-gpu-l4"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.id

  # Scale 0-1: no cost when idle
  node_locations = ["${var.region}-a"]   # same zone as general pool

  autoscaling {
    min_node_count = 0
    max_node_count = 1
  }

  node_config {
    machine_type = "g2-standard-4"   # 1x L4 (24GB VRAM), 4 vCPU, 16GB RAM
    disk_type    = "pd-standard"
    disk_size_gb = 100

    guest_accelerator {
      type  = "nvidia-l4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    labels = merge(var.labels, {
      gpu = "nvidia-l4"
    })

    # Taint so only GPU-requesting pods land here
    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}
