variable "project_id" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "namespace" {
  type    = string
  default = "synqlab"
}

variable "sa_name" {
  type    = string
  default = "synqlab-workload"
}

variable "registry_id" {
  type = string
}

variable "assets_bucket" {
  type = string
}

variable "labels" {
  type    = map(string)
  default = {}
}
