import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client    = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

const ADMINS_TABLE = process.env.ADMINS_TABLE;

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
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, error: "Invalid JSON body" });
    }

    const { email, password } = body;

    if (!email || !password) {
      return response(400, { success: false, error: "email and password are required" });
    }

    // ── Look up admin by email ─────────────────────────────────────────────
    const result = await docClient.send(
      new QueryCommand({
        TableName: ADMINS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames:  { "#email": "email" },
        ExpressionAttributeValues: { ":email": email.toLowerCase().trim() },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return response(401, { success: false, error: "Invalid email or password" });
    }

    const admin = result.Items[0];

    if (!admin.isActive) {
      return response(403, { success: false, error: "Admin account is inactive" });
    }

    // ── Password check (plain comparison — TODO: replace with bcrypt) ─────
    if (admin.password !== password) {
      return response(401, { success: false, error: "Invalid email or password" });
    }

    return response(200, {
      success: true,
      data: {
        adminId: admin.adminId,
        name:    admin.name,
        email:   admin.email,
        role:    admin.role,
      },
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    return response(500, { success: false, error: "Login failed" });
  }
};
