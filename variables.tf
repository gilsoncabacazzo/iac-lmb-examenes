variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Región de AWS"
}

variable "project_name" {
  type        = string
  description = "Nombre del proyecto (ej: pediatria, finanzas)"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Entorno de ejecución (dev, staging, production)"
}
variable "function_name" {
  type        = string
  default     = "lmb-examenes"
  description = "nombre de la lambda"
}

variable "dynamodb_tables_json" {
  type        = string
  description = "JSON string con la lista de tablas de DynamoDB enviado desde GitHub"
}
# Se usa únicamente para configurarla dentro de la Lambda
variable "tabla_examenes" {
  type        = string
  description = "Nombre exacto de la tabla de recetas"
}
variable "tabla_usuarios" {
  type        = string
  description = "Nombre exacto de la tabla de turnos"
}
variable "runtime" {
  type        = string
  description = "runtime de la lambda"
  default = "nodejs22.x"
}

