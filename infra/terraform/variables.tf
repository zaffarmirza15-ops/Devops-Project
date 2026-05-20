variable "aws_region" {
  description = "AWS region for the demo stack."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix used for AWS resources."
  type        = string
  default     = "ecs-commerce-demo"
}

variable "vpc_cidr" {
  description = "CIDR block for the demo VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
  default     = ["10.40.1.0/24", "10.40.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets."
  type        = list(string)
  default     = ["10.40.11.0/24", "10.40.12.0/24"]
}

variable "availability_zones" {
  description = "Optional availability zones. Leave empty to use the first two available zones in the region."
  type        = list(string)
  default     = []
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "commerce"
}

variable "db_username" {
  description = "PostgreSQL admin username used by the demo services."
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL password used by the demo services."
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Container image tag to deploy from ECR."
  type        = string
  default     = "v1"
}

variable "deploy_ecs_services" {
  description = "Set to true after images are pushed so ECS starts the services."
  type        = bool
  default     = false
}

variable "cloud_map_namespace" {
  description = "Private DNS namespace for service discovery inside ECS."
  type        = string
  default     = "commerce.local"
}

variable "api_gateway_stage" {
  description = "API Gateway stage name."
  type        = string
  default     = "prod"
}

variable "tags" {
  description = "Extra tags to apply to the stack."
  type        = map(string)
  default = {
    Environment = "demo"
    Owner       = "classroom"
  }
}
