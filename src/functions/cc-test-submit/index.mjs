import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { randomUUID } from "crypto";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "eu-west-1" });

const TESTS_TABLE              = process.env.TESTS_TABLE;
const TEST_SESSIONS_TABLE      = process.env.TEST_SESSIONS_TABLE;
const USERS_TABLE              = process.env.USERS_TABLE;
const REPORT_GENERATE_FUNCTION = process.env.REPORT_GENERATE_FUNCTION;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
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

  try {
    // TODO: Replace with JWT extraction once auth is configured
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return response(400, { success: false, error: "userId is required" });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, error: "Invalid JSON body" });
    }

    const { testId, answers, timings, totalTimeSecs } = body;

    if (!testId) {
      return response(400, { success: false, error: "testId is required" });
    }
    if (!answers || typeof answers !== "object") {
      return response(400, { success: false, error: "answers must be an object" });
    }
    if (typeof totalTimeSecs !== "number") {
      return response(400, { success: false, error: "totalTimeSecs must be a number" });
    }

    // ── Check user hasn't already submitted ───────────────────────────────────
    const userResult = await docClient.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
    );

    if (!userResult.Item) {
      return response(404, { success: false, error: "User not found" });
    }

    // ── Look up test to get testGroup ─────────────────────────────────────────
    const testResult = await docClient.send(
      new GetCommand({ TableName: TESTS_TABLE, Key: { testId } })
    );

    if (!testResult.Item) {
      return response(404, { success: false, error: "Test not found" });
    }

    const testGroup = testResult.Item.testGroup;

    // ── Create test session ───────────────────────────────────────────────────
    const sessionId   = randomUUID();
    const now         = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: TEST_SESSIONS_TABLE,
        Item: {
          sessionId,
          userId,
          testId,
          testGroup,
          answers:       answers,
          timings:       timings || {},
          totalTimeSecs,
          status:        "submitted",
          submittedAt:   now,
          createdAt:     now,
        },
      })
    );

    // ── Mark user testCompleted = true ────────────────────────────────────────
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: "SET testCompleted = :true, reportReady = :false, updatedAt = :now",
        ExpressionAttributeValues: {
          ":true":  true,
          ":false": false,
          ":now":   now,
        },
      })
    );

    // ── Async trigger: generate report ────────────────────────────────────────
    if (REPORT_GENERATE_FUNCTION) {
      try {
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName:   REPORT_GENERATE_FUNCTION,
            InvocationType: "Event", // async fire-and-forget
            Payload:        Buffer.from(JSON.stringify({ sessionId, userId })),
          })
        );
        console.log("Report generation triggered for session:", sessionId);
      } catch (invokeErr) {
        // Non-fatal: session is saved; report generation will be retried later
        console.error("Failed to trigger report generation:", invokeErr.message);
      }
    }

    return response(200, {
      success: true,
      data: { sessionId },
    });
  } catch (error) {
    console.error("Error submitting test:", error);
    return response(500, { success: false, error: "Failed to submit test" });
  }
};
