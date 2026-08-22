import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  QueryCommand 
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "tbl-docfy-examenes-dev";

export const handler = async (event) => {
  console.log("EVENTO RECIBIDO:", JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const pathParameters = event.pathParameters || {};
    
    // Normalizar headers a minúsculas
    const headers = event.headers || {};
    const consultorio_id =
      headers["consultorio_id"] ||
      headers["Consultorio_Id"] ||
      headers["CONSULTORIO_ID"] ||
      headers["x-consultorio-id"];
    const usuario_id =
      headers["x-usuario-id"] ||
      headers["X-Usuario-Id"] ||
      headers["X-USUARIO-ID"];

    if (!consultorio_id) {
      return response(400, { error: "El header 'consultorio_id' es obligatorio." });
    }

    let body = {};
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }

    switch (httpMethod) {
      case "POST":
        return await crearExamen(body, consultorio_id, usuario_id);

      case "GET":
        switch (event.resource) {
          case "/examenes/{id}":
            return await obtenerExamenPorId(pathParameters.id, consultorio_id);
          case "/turnos/{id}/examenes":
            return await obtenerExamenesPorTurno(pathParameters.id, consultorio_id);
          default:
            return response(404, { error: "Ruta no encontrada." });
        }

      case "PUT":
        if (!pathParameters.id) {
          return response(400, { error: "Se requiere el 'id' en la ruta para actualizar." });
        }
        return await actualizarExamen(pathParameters.id, body, consultorio_id);

      default:
        return response(405, { error: `Método ${httpMethod} no permitido.` });
    }

  } catch (error) {
    console.error("Error en la Lambda de Exámenes:", error);
    return response(500, { error: "Error interno del servidor.", detalle: error.message });
  }
};

// --- OPERACIONES ---

async function crearExamen(data, consultorio_id, usuario_id) {
  const examen_id = randomUUID();
  const createdAt = new Date().toISOString();

  // Mapeo de la lista de estudios solicitados
  const estudios = Array.isArray(data.estudios) ? data.estudios.map(est => ({
    tipo: est.tipo || "Laboratorio", // Ej: Laboratorio, Imagenología
    nombre: est.nombre || "",       // Ej: Hemograma completo, Rx de tórax
    observaciones: est.observaciones || ""
  })) : [];

  const nuevoExamen = {
    examen_id,
    consultorio_id, // Atributo clave para el GSI
    usuario_id: usuario_id || "sistema",
    turno_id: data.reserva_id || null,
    paciente_id: data.paciente_id || null,
    estudios,
    estado: "PENDIENTE", // PENDIENTE o COMPLETADO
    archivo_url: data.archivo_url || null, // URL en S3 para cuando carguen el resultado
    createdAt,
    fecha_actualizacion: createdAt
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: nuevoExamen
  }));

  return response(201, { mensaje: "Examen solicitado exitosamente", data: nuevoExamen });
}

async function obtenerExamenPorId(examen_id, consultorio_id) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { examen_id }
  }));

  if (!result.Item) {
    return response(404, { error: "Examen no encontrado." });
  }

  if (result.Item.consultorio_id !== consultorio_id) {
    return response(403, { error: "No tienes permisos para ver este examen." });
  }

  return response(200, { data: result.Item });
}

async function obtenerExamenesPorTurno(turnoId, consultorioId) {
  try {
    const params = {
      TableName: TABLE_NAME, // Asegúrate de tener esta variable con el nombre de tu tabla
      IndexName: "reserva-id-index", // Nombre exacto de tu GSI en DynamoDB
      KeyConditionExpression: "turno_id = :turnoId",
      ExpressionAttributeValues: {
        ":turnoId": turnoId,
      },
    };

    const command = new QueryCommand(params);
    const result = await docClient.send(command);

    // Como un turno tiene una sola receta, evaluamos si existe algún elemento
    const examenes = result.Items && result.Items.length > 0 ? result.Items[0] : null;

    // Opcional: Si quieres validar también por seguridad que pertenezca al consultorio actual
    if (examenes && examenes.consultorio_id !== consultorioId) {
      return response(404, { error: "Examen no encontrado para este consultorio." });
    }

    return response(200, examenes); // Retorna la receta o 'null' si aún no fue creada
  } catch (error) {
    console.error("Error al obtener la examenes por turno:", error);
    return response(500, { error: "Error interno al consultar el examenes." });
  }
}

async function actualizarExamen(id, data, consultorio_id) {
  const existing = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { "examen_id":id,"createdAt":data.createdAt }
  }));

  if (!existing.Item) {
    return response(404, { error: "Examen no encontrado." });
  }

  if (existing.Item.consultorio_id !== consultorio_id) {
    return response(403, { error: "No tienes permisos para modificar este examen." });
  }

  const fecha_actualizacion = new Date().toISOString();

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { "examen_id":id },
    UpdateExpression: "SET estudios = :e, estado = :st, archivo_url = :url, fecha_actualizacion = :f",
    ExpressionAttributeValues: {
      ":e": data.estudios || existing.Item.estudios,
      ":st": data.estado || existing.Item.estado,
      ":url": data.archivo_url !== undefined ? data.archivo_url : existing.Item.archivo_url,
      ":f": fecha_actualizacion
    },
    ReturnValues: "ALL_NEW"
  }));

  return response(200, { mensaje: "Examen actualizado exitosamente", data: result.Attributes });
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS,GET,POST,PUT",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-usuario-id,x-consultorio-id,consultorio_id",
    },
    body: JSON.stringify(body)
  };
}