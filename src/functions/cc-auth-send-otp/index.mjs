import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "crypto";

// ── DynamoDB Client ──────────────────────────────────────────────────────────

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const OTPS_TABLE = process.env.OTPS_TABLE;

// ── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

// ── Response Helpers ─────────────────────────────────────────────────────────

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const success = (data) => response(200, { success: true, ...data });
const badRequest = (error) => response(400, { success: false, error });
const serverError = (error) => response(500, { success: false, error });

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOTP = (otp) => createHash("sha256").update(otp).digest("hex");

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const { type, value } = body;

    if (!type || !value) {
      return badRequest("type and value are required");
    }

    if (!["mobile", "email"].includes(type)) {
      return badRequest("type must be 'mobile' or 'email'");
    }

    // ── Generate OTP ──
    const otp = generateOTP();
    const otpId = randomUUID();
    const now = new Date();
    const expiresAt = Math.floor(now.getTime() / 1000) + 600; // 10 minutes TTL

    // ── Store in DynamoDB ──
    await docClient.send(
      new PutCommand({
        TableName: OTPS_TABLE,
        Item: {
          otpId,
          target: value,
          type,
          otp: hashOTP(otp),
          verified: false,
          expiresAt,
          createdAt: now.toISOString(),
        },
      })
    );

    // 🔁 TODO: Send OTP via SMS (MSG91) for mobile, SES for email
    // For mobile: POST to MSG91 API with otp + value
    // For email:  Send via SES or email provider
    console.log(`[DEV] OTP for ${value}: ${otp}`); // Remove in production!

    return success({ otpId, expiresIn: 600 });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return serverError("Failed to send OTP");
  }
};
