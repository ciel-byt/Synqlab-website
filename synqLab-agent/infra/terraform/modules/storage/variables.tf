variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "tf_state_bucket" {
  type = string
}

variable "assets_bucket" {
  type = string
}

variable "labels" {
  type    = map(string)
  default = {}
}
