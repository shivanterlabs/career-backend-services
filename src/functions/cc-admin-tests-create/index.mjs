import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

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
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));
  const method = event.httpMethod;

  try {
    // ── GET /admin/tests — list all tests ──────────────────────────────────
    if (method === "GET") {
      const result = await docClient.send(
        new ScanCommand({ TableName: TESTS_TABLE })
      );

      const tests = (result.Items || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      return response(200, { success: true, data: { tests, total: tests.length } });
    }

    // ── POST /admin/tests — create a new test ──────────────────────────────
    if (method === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { success: false, error: "Invalid JSON body" });
      }

      const { testName, testGroup, targetClasses, durationMins, description } = body;

      if (!testName?.trim()) {
        return response(400, { success: false, error: "testName is required" });
      }
      if (!["school", "college"].includes(testGroup)) {
        return response(400, { success: false, error: "testGroup must be 'school' or 'college'" });
      }

      const adminId = event.queryStringParameters?.adminId;
      const now     = new Date().toISOString();
      const testId  = randomUUID();

      await docClient.send(
        new PutCommand({
          TableName: TESTS_TABLE,
          Item: {
            testId,
            testName:       testName.trim(),
            testGroup,
            targetClasses:  targetClasses || [],
            status:         "inactive",
            durationMins:   durationMins  || 45,
            description:    description   || "",
            totalQuestions: 0,
            version:        "v1",
            createdBy:      adminId       || "admin",
            createdAt:      now,
            updatedAt:      now,
          },
        })
      );

      return response(201, { success: true, data: { testId } });
    }

    return response(405, { success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("Error in admin tests:", error);
    return response(500, { success: false, error: "Operation failed" });
  }
};
