import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client    = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const QUESTIONS_TABLE = process.env.QUESTIONS_TABLE;
const TESTS_TABLE     = process.env.TESTS_TABLE;

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
  const params = event.queryStringParameters || {};

  try {
    // ── GET /admin/questions?testId=xxx — list questions for a test ────────
    if (method === "GET") {
      const testId = params.testId;
      if (!testId) {
        return response(400, { success: false, error: "testId query param is required" });
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName:                 QUESTIONS_TABLE,
          IndexName:                 "testId-index",
          KeyConditionExpression:    "#testId = :testId",
          ExpressionAttributeNames:  { "#testId": "testId" },
          ExpressionAttributeValues: { ":testId": testId },
        })
      );

      const questions = (result.Items || []).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );

      return response(200, { success: true, data: { questions, total: questions.length } });
    }

    // ── POST /admin/questions — create a question ──────────────────────────
    if (method === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { success: false, error: "Invalid JSON body" });
      }

      const {
        testId, testGroup, section, level, type,
        question, options, correctAnswerIds, imageUrl, order,
      } = body;

      if (!testId)      return response(400, { success: false, error: "testId is required" });
      if (!testGroup)   return response(400, { success: false, error: "testGroup is required" });
      if (!type)        return response(400, { success: false, error: "type is required" });
      if (!question?.trim()) return response(400, { success: false, error: "question text is required" });
      if (!options || !Array.isArray(options) || options.length < 2) {
        return response(400, { success: false, error: "At least 2 options are required" });
      }

      const now        = new Date().toISOString();
      const questionId = randomUUID();

      await docClient.send(
        new PutCommand({
          TableName: QUESTIONS_TABLE,
          Item: {
            questionId,
            testId,
            testGroup,
            section:          section          || null,
            level:            level            || "medium",
            type,
            question:         question.trim(),
            imageUrl:         imageUrl         || null,
            options,
            correctAnswerIds: correctAnswerIds || [],
            isActive:         true,
            order:            order            ?? 0,
            createdAt:        now,
            updatedAt:        now,
          },
        })
      );

      // ── Increment totalQuestions on the test ───────────────────────────
      try {
        await docClient.send(
          new UpdateCommand({
            TableName:                 TESTS_TABLE,
            Key:                       { testId },
            UpdateExpression:          "ADD totalQuestions :one SET updatedAt = :now",
            ExpressionAttributeValues: { ":one": 1, ":now": now },
          })
        );
      } catch (e) {
        console.warn("Could not increment totalQuestions:", e.message);
      }

      return response(201, { success: true, data: { questionId } });
    }

    return response(405, { success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("Error in admin questions:", error);
    return response(500, { success: false, error: "Operation failed" });
  }
};
