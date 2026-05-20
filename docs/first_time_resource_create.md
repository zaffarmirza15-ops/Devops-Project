aws sts get-caller-identity
aws configure


## Step 0: Assign CLI Variables for Reusibilty
$Region = "us-east-1"
$ProjectName = "ecs-commerce-demo"
$Tag = "v1"
$Bucket_Name = "ecs-commerce-demo-terraform-state-bucket"

## Step 1: Create State Bucket for Terraform State Management

aws s3api create-bucket --bucket "$Bucket_Name" --region us-east-1
aws s3api put-bucket-versioning --bucket "$Bucket_Name" --versioning-configuration Status=Enabled

## Step 2: Do not deploy ECS as of now
Make sure terraform.tfvars has:
deploy_ecs_services  = false

## Step 3: Initialize, Plan & Apply Terraform file to create AWS Resources

cd .\infra\terraform
terraform init -backend-config="backend.hcl"
terraform plan -out=tfplan
terraform apply tfplan

cd ..\..


## Step 4: Building Service Images & pushing them to AWS ECR

### Docker Desktop should be running

$AccountId = aws sts get-caller-identity --query Account --output text
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$Region = "us-east-1"

# Login to AWS ECR from local machine
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry

### Docker Images Build, Tag & Push to ECR
docker build -t "$ProjectName-frontend:$Tag" .\apps\frontend
docker tag "$ProjectName-frontend:$Tag" "$Registry/$ProjectName-frontend:$Tag"
docker push "$Registry/$ProjectName-frontend:$Tag"

docker build -t "$ProjectName-gateway:$Tag" .\services\gateway
docker tag "$ProjectName-gateway:$Tag" "$Registry/$ProjectName-gateway:$Tag"
docker push "$Registry/$ProjectName-gateway:$Tag"

docker build -t "$ProjectName-catalog:$Tag" .\services\catalog
docker tag "$ProjectName-catalog:$Tag" "$Registry/$ProjectName-catalog:$Tag"
docker push "$Registry/$ProjectName-catalog:$Tag"

docker build -t "$ProjectName-cart:$Tag" .\services\cart
docker tag "$ProjectName-cart:$Tag" "$Registry/$ProjectName-cart:$Tag"
docker push "$Registry/$ProjectName-cart:$Tag"

docker build -t "$ProjectName-order:$Tag" .\services\order
docker tag "$ProjectName-order:$Tag" "$Registry/$ProjectName-order:$Tag"
docker push "$Registry/$ProjectName-order:$Tag"

docker build -t "$ProjectName-payment:$Tag" .\services\payment
docker tag "$ProjectName-payment:$Tag" "$Registry/$ProjectName-payment:$Tag"
docker push "$Registry/$ProjectName-payment:$Tag"

docker build -t "$ProjectName-notification:$Tag" .\services\notification
docker tag "$ProjectName-notification:$Tag" "$Registry/$ProjectName-notification:$Tag"
docker push "$Registry/$ProjectName-notification:$Tag"


Now edit terraform.tfvars and change:
deploy_ecs_services = true

cd .\infra\terraform
terraform plan -out=tfplan2
terraform apply tfplan2



terraform destroy