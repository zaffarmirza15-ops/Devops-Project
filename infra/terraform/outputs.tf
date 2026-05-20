output "frontend_url" {
  description = "Public URL for the Next.js storefront behind the ALB."
  value       = "http://${aws_lb.frontend.dns_name}"
}

output "api_gateway_url" {
  description = "Invoke URL for the HTTP API that fronts the gateway service."
  value       = aws_apigatewayv2_stage.main.invoke_url
}

output "ecr_repository_urls" {
  description = "ECR repositories for each container image."
  value = {
    for key, repo in aws_ecr_repository.service : key => repo.repository_url
  }
}

output "cloud_map_namespace" {
  description = "Private DNS namespace used by ECS service discovery."
  value       = aws_service_discovery_private_dns_namespace.main.name
}

output "postgres_endpoint" {
  description = "RDS PostgreSQL endpoint for the demo."
  value       = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  description = "Redis endpoint for the demo cart service."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}
