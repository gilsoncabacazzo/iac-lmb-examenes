# Rol base que permite a AWS activar la función Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-${var.function_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Adjuntar política para que la Lambda guarde logs en CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 🔍 Obtiene dinámicamente los datos de la cuenta de AWS activa
data "aws_caller_identity" "current" {}

# 2. Creamos la política de IAM basada en datos (Data Source)
data "aws_iam_policy_document" "lambda_dynamodb_policy" {
  statement {
    actions = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
    ]
    effect = "Allow"

    # Generamos dinámicamente los ARNs para cada tabla de la lista
    resources = flatten([
    for tabla in local.tablas_lista : [
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/tbl-${var.project_name}-${tabla}-${var.environment}",
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/tbl-${var.project_name}-${tabla}-${var.environment}/index/*"
    ]
])
  }
  # 🔒 Regla 2: Solo lectura estricta para la tabla de usuarios (Validación Multi-tenant)
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query"
    ]

    # Apuntamos directo al ARN de la tabla de usuarios utilizando tu variable existente
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/tbl-${var.project_name}-usuarios-${var.environment}",
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/tbl-${var.project_name}-usuarios-${var.environment}/index/*"

    ]
  }
}

resource "aws_iam_policy" "lambda_dynamodb_policy" {
  name        = "${var.project_name}-${var.function_name}-db-policy-${var.environment}"
  description = "Permisos a tablas dynamoDb"
  policy = data.aws_iam_policy_document.lambda_dynamodb_policy.json
}

# Vincular la política de DynamoDB al rol de la Lambda
resource "aws_iam_role_policy_attachment" "lambda_db_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy.arn
}

