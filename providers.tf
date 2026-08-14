terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

 backend "s3" {
    bucket       = "gilson-terraform-states-global"
    key  = "iac-lmb-examenes/terraform.tfstate" # 👈 Unico y fijo    
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true # 🚀 Activa el bloqueo nativo en S3 (Dile adiós a DynamoDB)
  }
}

provider "aws" {
  region = var.aws_region

  # 🌟 Aquí se define la magia de los tags globales automáticos
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}