import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

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
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// Derive testGroup from studentClass
const getTestGroup = (studentClass) => {
  const collegeClasses = ["11th", "12th"];
  return collegeClasses.includes(studentClass) ? "college" : "school";
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, error: "Invalid JSON body" });
    }

    const { mobile, email, authProvider } = body;

    if (!authProvider) {
      return response(400, { success: false, error: "authProvider is required" });
    }
    if (!mobile && !email) {
      return response(400, { success: false, error: "mobile or email is required" });
    }

    const userId = randomUUID();
    const now = new Date().toISOString();

    const newUser = {
      userId,
      mobile:          mobile || null,
      email:           email  || null,
      authProvider,                    // "mobile" | "google"
      firstName:       null,
      lastName:        null,
      city:            null,
      state:           null,
      studentClass:    null,
      testGroup:       null,
      stream:          null,
      subjectPerformance: {},
      subjectRatings:     {},
      testCompleted:   false,
      paymentDone:     false,
      reportReady:     false,
      aiMessagesUsed:  0,
      createdAt:       now,
      updatedAt:       now,
    };

    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: newUser,
        // Prevent overwriting if userId collision (extremely unlikely with UUID)
        ConditionExpression: "attribute_not_exists(userId)",
      })
    );

    return response(201, {
      success: true,
      data: { userId, createdAt: now },
    });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(409, { success: false, error: "User already exists" });
    }
    console.error("Error creating user:", error);
    return response(500, { success: false, error: "Failed to create user" });
  }
};
