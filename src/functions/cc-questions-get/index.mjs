import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

const QUESTIONS_TABLE = process.env.QUESTIONS_TABLE;
const TESTS_TABLE     = process.env.TESTS_TABLE;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

// ── Derive testGroup from studentClass ────────────────────────────────────────

const getTestGroup = (studentClass) => {
  if (["11th", "12th"].includes(studentClass)) return "college";
  if (["8th", "9th", "10th"].includes(studentClass)) return "school";
  return null;
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const params = event.queryStringParameters || {};

    // Accept ?testGroup=school|college  OR  ?class=10th (auto-derived)
    let testGroup = params.testGroup;
    if (!testGroup && params.class) {
      testGroup = getTestGroup(params.class);
    }

    if (!testGroup) {
      return response(400, {
        success: false,
        error: "Query param 'testGroup' (school|college) or 'class' (8th-12th) is required",
      });
    }

    if (!["school", "college"].includes(testGroup)) {
      return response(400, {
        success: false,
        error: "testGroup must be 'school' or 'college'",
      });
    }

    // ── Find the active test for this testGroup ───────────────────────────────
    const testResult = await docClient.send(
      new QueryCommand({
        TableName: TESTS_TABLE,
        IndexName: "testGroup-status-index",
        KeyConditionExpression: "#testGroup = :testGroup AND #status = :status",
        ExpressionAttributeNames: {
          "#testGroup": "testGroup",
          "#status":    "status",
        },
        ExpressionAttributeValues: {
          ":testGroup": testGroup,
          ":status":    "active",
        },
        Limit: 1,
      })
    );

    if (!testResult.Items || testResult.Items.length === 0) {
      return response(404, {
        success: false,
        error: `No active test found for testGroup: ${testGroup}`,
      });
    }

    const activeTest = testResult.Items[0];

    // ── Fetch all active questions for this testId ────────────────────────────
    const questionsResult = await docClient.send(
      new QueryCommand({
        TableName: QUESTIONS_TABLE,
        IndexName: "testId-index",
        KeyConditionExpression: "#testId = :testId",
        FilterExpression: "#isActive = :true",
        ExpressionAttributeNames: {
          "#testId":   "testId",
          "#isActive": "isActive",
        },
        ExpressionAttributeValues: {
          ":testId": activeTest.testId,
          ":true":   true,
        },
      })
    );

    const questions = (questionsResult.Items || [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((q) => ({
        questionId: q.questionId,
        category:   q.category   || null,
        section:    q.section    || null,
        type:       q.type,
        question:   q.question,
        options:    q.options    || [],
        difficulty: q.difficulty || null,
        imageUrl:   q.imageUrl   || null,
        order:      q.order      ?? null,
      }));

    return response(200, {
      success: true,
      data: {
        testId:    activeTest.testId,
        testGroup,
        questions,
        total: questions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return response(500, { success: false, error: "Failed to fetch questions" });
  }
};
