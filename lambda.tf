# 1. 🆕 Crear el recurso de la Lambda Layer apuntando al ZIP generado por GitHub
resource "aws_lambda_layer_version" "node_dependencies" {
  filename            = "${path.module}/build/layer.zip" # Ruta al ZIP final
  layer_name          = "${var.project_name}-dependencies-${var.environment}"
  compatible_runtimes = ["nodejs20.x"]

  # 🆕 Cambiamos esto para evitar el error de "archivo no encontrado" en el inicio del plan
  source_code_hash = textencodebase64(filemd5("${path.module}/build/layer.zip"), "UTF-8")
}

# 2. Crear la función Lambda apuntando al ZIP de código generado por GitHub
resource "aws_lambda_function" "examenes" {
  function_name    = "${var.project_name}-${var.function_name}-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = var.runtime
  filename         = "${path.module}/build/lambda.zip" # Ruta al ZIP final
  source_code_hash = textencodebase64(filemd5("${path.module}/build/lambda.zip"), "UTF-8")
  timeout          = 15
  memory_size      = var.lambda_memory

  layers = [aws_lambda_layer_version.node_dependencies.arn]

  environment {
    variables = {
      TABLE_RECETAS   = var.tabla_examenes
      TABLE_USUARIOS        = var.tabla_usuarios
      NODE_ENV              = var.environment
      
    }
  }
}
