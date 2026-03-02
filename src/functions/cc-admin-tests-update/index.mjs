import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client    = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TESTS_TABLE = process.env.TESTS_TABLE;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
  "Content-Type": "application/json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

// ── Allowed update fields ─────────────────────────────────────────────────────

const ALLOWED = ["testName", "status", "durationMins", "description", "targetClasses", "totalQuestions"];
const VALID_STATUSES = ["active", "inactive"];

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const testId = event.pathParameters?.testId;
    if (!testId) {
      return response(400, { success: false, error: "testId path parameter is required" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, error: "Invalid JSON body" });
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return response(400, { success: false, error: "status must be 'active' or 'inactive'" });
    }

    const updates = { updatedAt: new Date().toISOString() };
    for (const field of ALLOWED) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 1) {
      return response(400, { success: false, error: "No valid fields to update" });
    }

    const parts  = [];
    const names  = {};
    const values = {};
    for (const [key, val] of Object.entries(updates)) {
      parts.push(`#${key} = :${key}`);
      names[`#${key}`]  = key;
      values[`:${key}`] = val;
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName:                 TESTS_TABLE,
        Key:                       { testId },
        UpdateExpression:          `SET ${parts.join(", ")}`,
        ExpressionAttributeNames:  names,
        ExpressionAttributeValues: values,
        ConditionExpression:       "attribute_exists(testId)",
        ReturnValues:              "ALL_NEW",
      })
    );

    return response(200, { success: true, data: result.Attributes });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(404, { success: false, error: "Test not found" });
    }
    console.error("Error updating test:", error);
    return response(500, { success: false, error: "Failed to update test" });
  }
};
