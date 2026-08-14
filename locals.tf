# 1. Decodificamos el JSON de GitHub a una lista local de Terraform
locals {
  # Cambia 'variable.' por 'var.'
  tablas_lista = jsondecode(var.dynamodb_tables_json)
}
