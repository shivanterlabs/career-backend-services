import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const USERS_TABLE = process.env.USERS_TABLE;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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
    // 🔁 TODO: Replace with JWT extraction once auth is configured
    // const userId = event.requestContext.authorizer?.claims?.sub;
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return response(400, { success: false, error: "userId is required" });
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      })
    );

    if (!result.Item) {
      return response(404, { success: false, error: "User not found" });
    }

    const user = result.Item;

    return response(200, {
      success: true,
      data: {
        userId:             user.userId,
        firstName:          user.firstName   || null,
        lastName:           user.lastName    || null,
        email:              user.email       || null,
        mobile:             user.mobile      || null,
        city:               user.city        || null,
        state:              user.state       || null,
        studentClass:       user.studentClass || null,
        testGroup:          user.testGroup   || null,
        stream:             user.stream      || null,
        subjectPerformance: user.subjectPerformance || {},
        subjectRatings:     user.subjectRatings     || {},
        testCompleted:      user.testCompleted  ?? false,
        paymentDone:        user.paymentDone    ?? false,
        reportReady:        user.reportReady    ?? false,
        aiMessagesUsed:     user.aiMessagesUsed ?? 0,
        createdAt:          user.createdAt,
        updatedAt:          user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return response(500, { success: false, error: "Failed to fetch user profile" });
  }
};

