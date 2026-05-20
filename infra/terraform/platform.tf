resource "aws_ecr_repository" "service" {
  for_each = toset(local.service_names)

  name                 = "${var.project_name}-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${each.key}"
  })
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = toset(local.service_names)

  name              = "/ecs/${var.project_name}/${each.key}"
  retention_in_days = 14

  tags = local.common_tags
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cluster"
  })
}

resource "aws_service_discovery_private_dns_namespace" "main" {
  name = var.cloud_map_namespace
  vpc  = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-namespace"
  })
}

data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = local.common_tags
}

resource "aws_lb" "frontend" {
  name               = "${var.project_name}-public"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.public_alb.id]
  subnets            = aws_subnet.public[*].id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-public"
  })
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-front"
  port        = local.service_ports.frontend
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.frontend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb" "gateway" {
  name               = "${var.project_name}-private"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.private_alb.id]
  subnets            = aws_subnet.private[*].id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-private"
  })
}

resource "aws_lb_target_group" "gateway" {
  name        = "${var.project_name}-gate"
  port        = local.service_ports.gateway
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "gateway" {
  load_balancer_arn = aws_lb.gateway.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway.arn
  }
}

