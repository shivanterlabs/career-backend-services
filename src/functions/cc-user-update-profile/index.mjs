import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const USERS_TABLE   = process.env.USERS_TABLE;
const REPORTS_TABLE = process.env.REPORTS_TABLE;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
  "Content-Type": "application/json",
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

// ── Allowed fields ────────────────────────────────────────────────────────────

const ALLOWED_FIELDS = [
  "firstName",
  "lastName",
  "city",
  "state",
  "studentClass",
  "stream",
  "subjectPerformance",  // { maths: "A", science: "B+" ... }
  "subjectRatings",      // { maths: 3, science: 4 ... }
  "paymentDone",         // set true after successful payment
];

// ── testGroup derived from studentClass ──────────────────────────────────────

const getTestGroup = (studentClass) => {
  if (!studentClass) return null;
  return ["11th", "12th"].includes(studentClass) ? "college" : "school";
};

// ── Valid values ──────────────────────────────────────────────────────────────

const VALID_CLASSES = ["8th", "9th", "10th", "11th", "12th"];
const VALID_STREAMS = ["Science", "Commerce", "Arts", "Not decided yet"];

// ── Mark the latest unpaid report for this user as paid ───────────────────────

const markLatestReportPaid = async (userId) => {
  if (!REPORTS_TABLE) return;
  try {
    const res = await docClient.send(new QueryCommand({
      TableName:                 REPORTS_TABLE,
      IndexName:                 "userId-index",
      KeyConditionExpression:    "#userId = :userId",
      ExpressionAttributeNames:  { "#userId": "userId" },
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward:          false, // newest first
    }));

    const unpaid = (res.Items || []).find(r => r.paymentDone === false);
    if (!unpaid) return; // no unpaid report found

    await docClient.send(new UpdateCommand({
      TableName:                 REPORTS_TABLE,
      Key:                       { reportId: unpaid.reportId },
      UpdateExpression:          "SET paymentDone = :true",
      ExpressionAttributeValues: { ":true": true },
    }));
    console.log("Marked report paid:", unpaid.reportId);
  } catch (err) {
    // Non-fatal — payment on user is already set
    console.error("Failed to mark report paid:", err.message);
  }
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return response(400, { success: false, error: "userId is required" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, error: "Invalid JSON body" });
    }

    // ── Validate class if provided ─────────────────────────────────────────────
    if (body.studentClass && !VALID_CLASSES.includes(body.studentClass)) {
      return response(400, {
        success: false,
        error: `studentClass must be one of: ${VALID_CLASSES.join(", ")}`,
      });
    }

    // ── Validate stream if provided ────────────────────────────────────────────
    if (body.stream && !VALID_STREAMS.includes(body.stream)) {
      return response(400, {
        success: false,
        error: `stream must be one of: ${VALID_STREAMS.join(", ")}`,
      });
    }

    // ── Build update expression from allowed fields only ───────────────────────
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return response(400, { success: false, error: "No valid fields to update" });
    }

    // ── Auto-derive testGroup when studentClass is updated ────────────────────
    if (updates.studentClass) {
      updates.testGroup = getTestGroup(updates.studentClass);
    }

    updates.updatedAt = new Date().toISOString();

    // ── Build DynamoDB UpdateExpression ───────────────────────────────────────
    const expressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    for (const [key, value] of Object.entries(updates)) {
      expressionParts.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${expressionParts.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(userId)",
        ReturnValues: "ALL_NEW",
      })
    );

    // ── If payment is being marked, also mark the latest unpaid report paid ───
    if (updates.paymentDone === true) {
      await markLatestReportPaid(userId);
    }

    const u = result.Attributes;

    return response(200, {
      success: true,
      data: {
        userId:             u.userId,
        firstName:          u.firstName          || null,
        lastName:           u.lastName           || null,
        city:               u.city               || null,
        state:              u.state              || null,
        studentClass:       u.studentClass       || null,
        testGroup:          u.testGroup          || null,
        stream:             u.stream             || null,
        subjectPerformance: u.subjectPerformance || {},
        subjectRatings:     u.subjectRatings     || {},
        updatedAt:          u.updatedAt,
      },
    });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(404, { success: false, error: "User not found" });
    }
    console.error("Error updating user profile:", error);
    return response(500, { success: false, error: "Failed to update user profile" });
  }
};
