import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Career Knowledge Base (bundled in zip) ────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAREER_DATA = JSON.parse(
  readFileSync(join(__dirname, "career_details.json"), "utf8")
);

// Light sector index — stays in system prompt always (~300 tokens)
const SECTOR_INDEX = CAREER_DATA.sectors
  .filter((s) => s.sector_id)
  .map((s) => {
    let streams = "Any";
    if (Array.isArray(s.streams_required)) {
      streams = s.streams_required.join(", ");
    } else if (s.streams_required && typeof s.streams_required === "object") {
      streams = Object.keys(s.streams_required).join(", ");
    }
    return `  ${s.sector_id.padEnd(5)} — ${s.sector_name} (streams: ${streams})`;
  })
  .join("\n");

// sector_id → full sector object for tool lookup
const SECTOR_MAP = {};
CAREER_DATA.sectors.filter((s) => s.sector_id).forEach((s) => {
  SECTOR_MAP[s.sector_id] = s;
});

// ── Clients ───────────────────────────────────────────────────────────────────

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Config ────────────────────────────────────────────────────────────────────

const USERS_TABLE    = process.env.USERS_TABLE;
const REPORTS_TABLE  = process.env.REPORTS_TABLE;
const AI_CHATS_TABLE = process.env.AI_CHATS_TABLE;
const FREE_LIMIT     = parseInt(process.env.AI_CHAT_FREE_LIMIT || "50", 10);
const MODEL          = "claude-haiku-4-5-20251001";
const MAX_TOKENS     = 500;    // reply (~150 words) + suggestions JSON overhead
const MAX_HISTORY    = 16;     // last 8 exchanges (16 messages)
const MSG_CHAR_LIMIT = 600;    // ~150 tokens — student message cap

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

const resp = (status, body) => ({
  statusCode: status,
  headers: CORS,
  body: JSON.stringify(body),
});

// ── Tool definition ───────────────────────────────────────────────────────────

const SECTOR_TOOL = {
  name: "get_sector_details",
  description:
    "Fetch full details for an Indian education sector — courses, entrance exams, " +
    "salary ranges, fees, scholarships, and education loan information. " +
    "Call this whenever the student asks about a career path, course, exam, salary, " +
    "scholarship, or fee for any sector.",
  input_schema: {
    type: "object",
    properties: {
      sector_id: {
        type: "string",
        description:
          "Sector ID from the index. One of: " +
          Object.keys(SECTOR_MAP).join(", "),
      },
    },
    required: ["sector_id"],
  },
};

// ── Tool handler ──────────────────────────────────────────────────────────────

function getSectorDetails(sector_id) {
  const sector = SECTOR_MAP[sector_id?.toUpperCase()];
  if (!sector) {
    return {
      error: `Sector '${sector_id}' not found. Valid IDs: ${Object.keys(SECTOR_MAP).join(", ")}`,
    };
  }
  return sector;
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(user, report) {
  const careerMatches = report?.careerMatches
    ?.slice(0, 5)
    .map((c, i) => `  ${i + 1}. ${c.career} (match: ${c.matchScore}%)`)
    .join("\n") || "  Not yet generated";

  const subjectPerf = user.subjectPerformance
    ? Object.entries(user.subjectPerformance)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "Not provided";

  const subjectFeel = user.subjectRatings
    ? Object.entries(user.subjectRatings)
        .map(([k, v]) => `${k}: ${"★".repeat(v)}${"☆".repeat(4 - v)}`)
        .join(", ")
    : "Not provided";

  return `You are ChillCareer AI — a friendly, encouraging career counsellor for Indian students aged 13–18.
You are talking to ${user.firstName || "the student"}, a Class ${user.studentClass || "unknown"} student from ${user.city || "India"}, ${user.state || ""}.

=== STUDENT PROFILE ===
Stream: ${user.stream || "Not decided yet"}
Subject Performance (grades): ${subjectPerf}
Subject Feelings (1=struggle 4=love): ${subjectFeel}
Personality: ${report?.personalityProfile?.summary || "Not yet analysed"}
Recommended Stream: ${report?.streamRecommendation || "Not yet analysed"}
Key Strengths: ${report?.strengthsSummary || "Not yet analysed"}

=== TEST RESULTS — TOP CAREER MATCHES ===
${careerMatches}

=== HOW TO USE YOUR KNOWLEDGE ===
You have access to the get_sector_details tool. Use it to fetch accurate, grounded data
about any Indian education sector before answering questions about:
- Courses and degrees available
- Entrance exams required
- Salary ranges (entry / mid / senior)
- Approximate college fees (govt vs private)
- Scholarships available (national + state-specific)
- Education loan options

ALWAYS call the tool before answering sector-specific questions.
The student's state is "${user.state || "unknown"}" — use state_portals from the tool result when discussing scholarships.

=== AVAILABLE SECTORS (call get_sector_details with the sector_id) ===
${SECTOR_INDEX}

=== RESPONSE FORMAT ===
You MUST respond with a valid JSON object — no text before or after:
{
  "reply": "Your response here. Max 120 words. Be warm, direct, and specific. Use bullets only when listing 3+ items.",
  "suggestions": [
    "Suggestion one — max 10 words?",
    "Suggestion two — max 10 words?",
    "Suggestion three — max 10 words?"
  ]
}

Suggestion rules:
1. First: goes DEEPER into what you just discussed
2. Second: explores a RELATED alternative or comparison
3. Third: addresses a PRACTICAL concern (exam / cost / timeline / scholarship)
All 3 must be within career guidance scope. Max 10 words each.

=== GUARDRAILS ===
1. ONLY recommend courses and career paths present in the sector data you fetch.
   Never invent course names or institutions.
2. For STABLE facts not in sector data (general salary ranges, industry outlook):
   Answer from general knowledge. Prefix with "Based on general information:"
   and suggest verifying at an official source.
3. For DYNAMIC data (this year's cutoffs, current fees, exam dates):
   Never guess. Give the official source to check (nta.ac.in, josaa.nic.in, etc.)
4. For scholarships: always direct to scholarships.gov.in + the student's state portal.
5. If asked something off-topic (homework, news, unrelated): warmly redirect to career guidance.
6. If the student seems stressed or anxious: acknowledge feelings FIRST, then advise.
7. Respect both student interests AND parent expectations — never dismiss either.
8. Language: respond in the same language the student writes in (Hindi/English mix is fine).
9. Never be discouraging. Frame challenges as "here's how to prepare" not "this is too hard."`;
}

// ── Claude API call with tool-use loop ────────────────────────────────────────

async function callClaude(systemPrompt, apiMessages) {
  let messages = [...apiMessages];
  let iterations = 0;
  const MAX_TOOL_ITERATIONS = 3;

  while (iterations < MAX_TOOL_ITERATIONS) {
    const res = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      tools:      [SECTOR_TOOL],
      messages,
    });

    // No tool call — final response
    if (res.stop_reason !== "tool_use") {
      const textBlock = res.content.find((b) => b.type === "text");
      return textBlock?.text || "";
    }

    // Handle ALL tool_use blocks in this response (Claude can call multiple tools at once)
    const toolUseBlocks = res.content.filter((b) => b.type === "tool_use");
    const toolResults   = toolUseBlocks.map((block) => ({
      type:        "tool_result",
      tool_use_id: block.id,
      content:     JSON.stringify(getSectorDetails(block.input.sector_id)),
    }));

    messages = [
      ...messages,
      { role: "assistant", content: res.content },
      { role: "user",      content: toolResults },
    ];

    iterations++;
  }

  // Fallback: ask Claude to respond with what it has (no more tool calls)
  const fallback = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     systemPrompt,
    tool_choice: { type: "none" },
    messages,
  });

  const textBlock = fallback.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}

// ── Parse Claude's JSON response ──────────────────────────────────────────────

function parseClaudeResponse(rawText) {
  try {
    // Find the outermost { ... } — handles leading text, code fences, etc.
    const start = rawText.indexOf("{");
    const end   = rawText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON");
    const parsed = JSON.parse(rawText.slice(start, end + 1));
    return {
      reply:       typeof parsed.reply === "string" ? parsed.reply.trim() : rawText,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s).trim())
        : [],
    };
  } catch {
    return { reply: rawText.trim(), suggestions: [] };
  }
}

// ── DynamoDB helpers ──────────────────────────────────────────────────────────

async function getChat(chatId) {
  const res = await dynamo.send(
    new GetCommand({ TableName: AI_CHATS_TABLE, Key: { chatId } })
  );
  return res.Item || null;
}

async function createChat(userId, reportId) {
  const chatId = `${userId}::${reportId}`;
  const now    = new Date().toISOString();
  const item   = {
    chatId,
    userId,
    reportId,
    messages:          [],
    messageCount:      0,
    freeLimit:         FREE_LIMIT,
    chatSummary:       null,
    summaryEmailSent:  false,
    createdAt:         now,
    updatedAt:         now,
  };
  await dynamo.send(new PutCommand({ TableName: AI_CHATS_TABLE, Item: item }));
  return item;
}

async function appendMessages(chatId, newMessages) {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName:                 AI_CHATS_TABLE,
      Key:                       { chatId },
      UpdateExpression:
        "SET #msgs = list_append(#msgs, :newMsgs), #count = #count + :inc, updatedAt = :now",
      ExpressionAttributeNames:  { "#msgs": "messages", "#count": "messageCount" },
      ExpressionAttributeValues: { ":newMsgs": newMessages, ":inc": 1, ":now": now },
    })
  );
}

async function updateUserMessageCount(userId, count) {
  await dynamo.send(
    new UpdateCommand({
      TableName:                 USERS_TABLE,
      Key:                       { userId },
      UpdateExpression:          "SET aiMessagesUsed = :count, updatedAt = :now",
      ExpressionAttributeValues: { ":count": count, ":now": new Date().toISOString() },
    })
  );
}

async function getReport(reportId) {
  const res = await dynamo.send(
    new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } })
  );
  return res.Item || null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return resp(200, {});
  }

  try {
    // ── 1. Parse input ───────────────────────────────────────────────────────
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return resp(400, { success: false, error: "userId is required" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return resp(400, { success: false, error: "Invalid JSON body" });
    }

    const reportId = (body.reportId || "").trim();
    if (!reportId) {
      return resp(400, { success: false, error: "reportId is required" });
    }

    const rawMessage = (body.message || "").trim();
    if (!rawMessage) {
      return resp(400, { success: false, error: "message is required" });
    }

    // Truncate student message to cap input tokens
    const message = rawMessage.slice(0, MSG_CHAR_LIMIT);

    // ── 2. Fetch user + report in parallel ───────────────────────────────────
    const chatId = `${userId}::${reportId}`;
    const [userRes, report] = await Promise.all([
      dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } })),
      getReport(reportId),
    ]);

    const user = userRes.Item;
    if (!user) {
      return resp(404, { success: false, error: "User not found" });
    }

    // ── 3. Get or create chat session ────────────────────────────────────────
    let chat = await getChat(chatId);
    if (!chat) {
      chat = await createChat(userId, reportId);
    }

    // ── 4. Check message limit ───────────────────────────────────────────────
    const messagesUsed = chat.messageCount || 0;
    if (messagesUsed >= FREE_LIMIT) {
      return resp(200, {
        success: true,
        data: {
          limitReached:      true,
          chatId:            chat.chatId,
          messagesUsed,
          messagesRemaining: 0,
          message:
            "You've used all your free questions. Visit the summary tab to see your conversation summary.",
        },
      });
    }

    // ── 5. Build Claude API messages (history + new message) ─────────────────
    const storedMessages  = chat.messages || [];
    const recentMessages  = storedMessages.slice(-MAX_HISTORY); // last 8 exchanges
    const apiMessages     = [
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // ── 6. Build system prompt ───────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(user, report);

    // ── 7. Call Claude with tool-use loop ────────────────────────────────────
    const rawResponse = await callClaude(systemPrompt, apiMessages);
    const { reply, suggestions } = parseClaudeResponse(rawResponse);

    // ── 8. Persist messages + update counts ──────────────────────────────────
    const now          = new Date().toISOString();
    const newMessages  = [
      { role: "user",      content: message, timestamp: now },
      { role: "assistant", content: reply,   timestamp: now },
    ];

    const newCount = messagesUsed + 1;

    await Promise.all([
      appendMessages(chat.chatId, newMessages),
      updateUserMessageCount(userId, newCount),
    ]);

    // ── 9. Return response ───────────────────────────────────────────────────
    return resp(200, {
      success: true,
      data: {
        reply,
        suggestions,
        chatId:            chat.chatId,
        messagesUsed:      newCount,
        messagesRemaining: Math.max(0, FREE_LIMIT - newCount),
        limitReached:      newCount >= FREE_LIMIT,
      },
    });
  } catch (error) {
    console.error("cc-ai-chat-message error:", error);
    return resp(500, { success: false, error: "Failed to process chat message" });
  }
};
