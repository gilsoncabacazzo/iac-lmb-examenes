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
    const normalizedHeaders = Object.keys(headers).reduce((acc, key) => {
      acc[key.toLowerCase()] = headers[key];
      return acc;
    }, {});

    const consultorio_id = normalizedHeaders['consultorio_id'];
    const usuario_id = normalizedHeaders['usuario_id'];

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
        if (pathParameters.examen_id) {
          return await obtenerExamenPorId(pathParameters.examen_id, consultorio_id);
        } else {
          return await listarExamenesPorConsultorio(consultorio_id);
        }

      case "PUT":
        if (!pathParameters.examen_id) {
          return response(400, { error: "Se requiere el 'examen_id' en la ruta para actualizar." });
        }
        return await actualizarExamen(pathParameters.examen_id, body, consultorio_id);

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
    turno_id: data.turno_id || null,
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

async function listarExamenesPorConsultorio(consultorio_id) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "consultorio_id",
    KeyConditionExpression: "consultorio_id = :cid",
    ExpressionAttributeValues: {
      ":cid": consultorio_id
    }
  }));

  return response(200, { data: result.Items || [] });
}

async function actualizarExamen(examen_id, data, consultorio_id) {
  const existing = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { examen_id }
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
    Key: { examen_id },
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