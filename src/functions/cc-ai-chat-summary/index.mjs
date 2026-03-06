import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";

// ── Clients ───────────────────────────────────────────────────────────────────

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Config ────────────────────────────────────────────────────────────────────

const USERS_TABLE    = process.env.USERS_TABLE;
const AI_CHATS_TABLE = process.env.AI_CHATS_TABLE;
const MODEL          = "claude-haiku-4-5-20251001";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json",
};

const resp = (status, body) => ({
  statusCode: status,
  headers: CORS,
  body: JSON.stringify(body),
});

// ── Summary generator ─────────────────────────────────────────────────────────

async function generateSummary(user, messages) {
  // Build a condensed transcript — skip very short exchanges
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "AI"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are summarising a career guidance chat session for an Indian student.

Student: ${user.firstName || "Student"}, Class ${user.studentClass || "unknown"}, ${user.state || "India"}

Chat transcript:
${transcript}

Write a warm, personalised summary (200–250 words) covering:
1. Which career paths the student explored
2. Their key interests and strengths that came up
3. The most important advice or insights from the session
4. 2–3 concrete next steps the student should take

Write directly to the student (use "you"). Be encouraging. End with one motivating sentence.
Do NOT use headers or bullet points — write flowing paragraphs.`;

  const res = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 400,
    messages:   [{ role: "user", content: prompt }],
  });

  return res.content.find((b) => b.type === "text")?.text?.trim() || "";
}

// ── DynamoDB helpers ──────────────────────────────────────────────────────────

async function getChat(chatId) {
  const res = await dynamo.send(
    new GetCommand({ TableName: AI_CHATS_TABLE, Key: { chatId } })
  );
  return res.Item || null;
}

async function storeSummary(chatId, summary) {
  await dynamo.send(
    new UpdateCommand({
      TableName:                 AI_CHATS_TABLE,
      Key:                       { chatId },
      UpdateExpression:          "SET chatSummary = :s, updatedAt = :now",
      ExpressionAttributeValues: { ":s": summary, ":now": new Date().toISOString() },
    })
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return resp(200, {});
  }

  try {
    // ── 1. Parse input ───────────────────────────────────────────────────────
    const userId   = event.queryStringParameters?.userId;
    const reportId = event.queryStringParameters?.reportId;
    if (!userId) {
      return resp(400, { success: false, error: "userId is required" });
    }
    if (!reportId) {
      return resp(400, { success: false, error: "reportId is required" });
    }

    // ── 2. Fetch user ────────────────────────────────────────────────────────
    const userRes = await dynamo.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
    );
    const user = userRes.Item;
    if (!user) {
      return resp(404, { success: false, error: "User not found" });
    }

    // ── 3. Fetch chat ────────────────────────────────────────────────────────
    const chatId = `${userId}::${reportId}`;
    const chat   = await getChat(chatId);
    if (!chat) {
      return resp(404, { success: false, error: "No chat session found" });
    }

    const messagesUsed = chat.messageCount || 0;

    // ── 4. Return cached summary if already generated ────────────────────────
    if (chat.chatSummary) {
      return resp(200, {
        success: true,
        data: {
          chatSummary:   chat.chatSummary,
          messagesUsed,
          chatId:        chat.chatId,
          fromCache:     true,
        },
      });
    }

    // ── 5. Need at least a few messages to summarise ─────────────────────────
    const messages = chat.messages || [];
    if (messages.length < 4) {
      return resp(200, {
        success: true,
        data: {
          chatSummary:   null,
          messagesUsed,
          chatId:        chat.chatId,
          message:       "Not enough conversation yet to generate a summary.",
        },
      });
    }

    // ── 6. Generate summary via Claude ───────────────────────────────────────
    const summary = await generateSummary(user, messages);

    // ── 7. Cache it in DynamoDB ──────────────────────────────────────────────
    await storeSummary(chat.chatId, summary);

    // ── 8. Return ────────────────────────────────────────────────────────────
    return resp(200, {
      success: true,
      data: {
        chatSummary: summary,
        messagesUsed,
        chatId:      chat.chatId,
        fromCache:   false,
      },
    });
  } catch (error) {
    console.error("cc-ai-chat-summary error:", error);
    return resp(500, { success: false, error: "Failed to generate chat summary" });
  }
};
