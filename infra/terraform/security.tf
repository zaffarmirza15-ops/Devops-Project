resource "aws_security_group" "public_alb" {
  name        = "${var.project_name}-public-alb-sg"
  description = "Allows HTTP traffic to the public ALB."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from the internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-public-alb-sg"
  })
}

resource "aws_security_group" "private_alb" {
  name        = "${var.project_name}-private-alb-sg"
  description = "Accepts traffic from API Gateway VPC link."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-private-alb-sg"
  })
}

resource "aws_security_group" "apigw_vpc_link" {
  name        = "${var.project_name}-apigw-vpc-link-sg"
  description = "Used by API Gateway VPC link to reach the internal ALB."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-apigw-vpc-link-sg"
  })
}

resource "aws_security_group_rule" "private_alb_from_apigw" {
  type                     = "ingress"
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
  security_group_id        = aws_security_group.private_alb.id
  source_security_group_id = aws_security_group.apigw_vpc_link.id
  description              = "Allow API Gateway VPC link traffic to the internal ALB"
}

resource "aws_security_group" "frontend_service" {
  name        = "${var.project_name}-frontend-sg"
  description = "Allows traffic from the public ALB to the Next.js service."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-frontend-sg"
  })
}

resource "aws_security_group_rule" "frontend_from_public_alb" {
  type                     = "ingress"
  from_port                = local.service_ports.frontend
  to_port                  = local.service_ports.frontend
  protocol                 = "tcp"
  security_group_id        = aws_security_group.frontend_service.id
  source_security_group_id = aws_security_group.public_alb.id
  description              = "Allow ALB traffic to the Next.js container"
}

resource "aws_security_group" "services" {
  name        = "${var.project_name}-services-sg"
  description = "Shared security group for gateway and backend services."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-services-sg"
  })
}

resource "aws_security_group_rule" "services_self_ingress" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  security_group_id = aws_security_group.services.id
  self              = true
  description       = "Allow service-to-service communication inside ECS"
}

resource "aws_security_group_rule" "gateway_from_private_alb" {
  type                     = "ingress"
  from_port                = local.service_ports.gateway
  to_port                  = local.service_ports.gateway
  protocol                 = "tcp"
  security_group_id        = aws_security_group.services.id
  source_security_group_id = aws_security_group.private_alb.id
  description              = "Allow the internal ALB to reach gateway-service"
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allows ECS services to reach PostgreSQL."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-sg"
  })
}

resource "aws_security_group_rule" "rds_from_services" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.services.id
  description              = "Allow ECS services to reach PostgreSQL"
}

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allows ECS services to reach Redis."
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-redis-sg"
  })
}

resource "aws_security_group_rule" "redis_from_services" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = aws_security_group.services.id
  description              = "Allow ECS services to reach Redis"
}
