import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB Client ───────────────────────────────────────────────────────────

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" })
);

const REPORTS_TABLE = process.env.REPORTS_TABLE;
const USERS_TABLE   = process.env.USERS_TABLE;

// ── CORS Headers ──────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const queryUserReports = (userId) =>
  dynamo.send(new QueryCommand({
    TableName:                 REPORTS_TABLE,
    IndexName:                 "userId-index",
    KeyConditionExpression:    "#userId = :userId",
    ExpressionAttributeNames:  { "#userId": "userId" },
    ExpressionAttributeValues: { ":userId": userId },
    ScanIndexForward:          false, // newest first
  }));

const fullReportPayload = (report) => ({
  reportId:             report.reportId,
  sessionId:            report.sessionId,
  testTakerName:        report.testTakerName || null,
  isPartial:            false,
  paymentDone:          true,
  careerMatches:        report.careerMatches,
  personalityProfile:   report.personalityProfile,
  streamRecommendation: report.streamRecommendation,
  streamJustification:  report.streamJustification,
  strengthsSummary:     report.strengthsSummary,
  behaviourInsights:    report.behaviourInsights,
  workValuesProfile:    report.workValuesProfile,
  subjectInsights:      report.subjectInsights,
  selfDeclared:         report.selfDeclared,
  aptitudeSummary:      report.aptitudeSummary,
  roadmap:              report.roadmap,
  pdfUrl:               report.pdfUrl || null,
  generatedAt:          report.generatedAt,
  modelVersion:         report.modelVersion,
});

const partialReportPayload = (report) => ({
  reportId:        report.reportId,
  sessionId:       report.sessionId,
  testTakerName:   report.testTakerName || null,
  isPartial:       true,
  paymentDone:     false,
  partialReport:   report.partialReport,
  generatedAt:     report.generatedAt,
  paymentRequired: true,
});

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return response(400, { success: false, error: "userId path parameter is required" });
    }

    const qs       = event.queryStringParameters || {};
    const listMode = qs.list === "true";
    const reportId = qs.reportId;

    // ── Check user exists + generating state ──────────────────────────────────
    const userRes = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    if (!userRes.Item) {
      return response(404, { success: false, error: "User not found" });
    }
    const user = userRes.Item;

    // ── LIST mode: return all report summaries ────────────────────────────────
    if (listMode) {
      const reportsRes = await queryUserReports(userId);
      const items      = reportsRes.Items || [];

      const summaries = items.map(r => ({
        reportId:      r.reportId,
        sessionId:     r.sessionId,
        generatedAt:   r.generatedAt,
        paymentDone:   "paymentDone" in r ? r.paymentDone === true : user.paymentDone === true,
        testTakerName: r.testTakerName || null,
        topCareer:     r.careerMatches?.[0]?.career || r.partialReport?.topCareers?.[0]?.career || null,
        matchScore:    r.careerMatches?.[0]?.matchScore || r.partialReport?.topCareers?.[0]?.matchScore || null,
      }));

      return response(200, { success: true, data: { reports: summaries } });
    }

    // ── SPECIFIC report by reportId ───────────────────────────────────────────
    if (reportId) {
      const reportRes = await dynamo.send(new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } }));
      if (!reportRes.Item || reportRes.Item.userId !== userId) {
        return response(404, { success: false, error: "Report not found" });
      }
      const report = reportRes.Item;
      const paid   = "paymentDone" in report ? report.paymentDone === true : user.paymentDone === true;
      return response(200, { success: true, data: paid ? fullReportPayload(report) : partialReportPayload(report) });
    }

    // ── DEFAULT: latest report ────────────────────────────────────────────────
    if (!user.reportReady) {
      return response(202, {
        success: true,
        data: { status: "generating", message: "Report is being generated. Please check back shortly." },
      });
    }

    const reportRes = await queryUserReports(userId);
    if (!reportRes.Items?.length) {
      return response(404, { success: false, error: "Report not found" });
    }

    const report = reportRes.Items[0];
    const paid   = "paymentDone" in report ? report.paymentDone === true : user.paymentDone === true;

    return response(200, { success: true, data: paid ? fullReportPayload(report) : partialReportPayload(report) });

  } catch (error) {
    console.error("Error fetching report:", error);
    return response(500, { success: false, error: "Failed to fetch report" });
  }
};
