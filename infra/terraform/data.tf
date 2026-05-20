data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  azs = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 2)

  common_tags = merge(
    {
      Project   = var.project_name
      ManagedBy = "terraform"
    },
    var.tags
  )

  service_names = [
    "frontend",
    "gateway",
    "catalog",
    "cart",
    "order",
    "payment",
    "notification"
  ]

  service_ports = {
    frontend     = 3000
    gateway      = 8080
    catalog      = 3001
    cart         = 3002
    order        = 3003
    payment      = 3004
    notification = 3005
  }

  service_cpu = {
    frontend     = 256
    gateway      = 256
    catalog      = 256
    cart         = 256
    order        = 256
    payment      = 256
    notification = 256
  }

  service_memory = {
    frontend     = 512
    gateway      = 512
    catalog      = 512
    cart         = 512
    order        = 512
    payment      = 512
    notification = 512
  }

  discovery_service_names = {
    gateway      = "gateway-service"
    catalog      = "catalog-service"
    cart         = "cart-service"
    order        = "order-service"
    payment      = "payment-service"
    notification = "notification-service"
  }
}
