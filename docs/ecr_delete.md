$Region = "us-east-1"
$ProjectName = "ecs-commerce-demo"

aws ecr delete-repository --repository-name "$ProjectName-frontend" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-gateway" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-catalog" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-cart" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-order" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-payment" --region $Region --force
aws ecr delete-repository --repository-name "$ProjectName-notification" --region $Region --force
