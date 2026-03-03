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

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // userId from path parameter: GET /report/{userId}
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return response(400, { success: false, error: "userId path parameter is required" });
    }

    // ── Fetch user to check payment status ────────────────────────────────────
    const userRes = await dynamo.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    if (!userRes.Item) {
      return response(404, { success: false, error: "User not found" });
    }
    const user = userRes.Item;

    if (!user.reportReady) {
      return response(202, {
        success: true,
        data: { status: "generating", message: "Report is being generated. Please check back shortly." },
      });
    }

    // ── Fetch latest report for this user ─────────────────────────────────────
    const reportRes = await dynamo.send(
      new QueryCommand({
        TableName:                 REPORTS_TABLE,
        IndexName:                 "userId-index",
        KeyConditionExpression:    "#userId = :userId",
        ExpressionAttributeNames:  { "#userId": "userId" },
        ExpressionAttributeValues: { ":userId": userId },
        ScanIndexForward:          false, // newest first
        Limit:                     1,
      })
    );

    if (!reportRes.Items?.length) {
      return response(404, { success: false, error: "Report not found" });
    }

    const report = reportRes.Items[0];
    const paid   = user.paymentDone === true;

    if (!paid) {
      // ── Return partial teaser only ─────────────────────────────────────────
      return response(200, {
        success: true,
        data: {
          reportId:      report.reportId,
          isPartial:     true,
          partialReport: report.partialReport,
          generatedAt:   report.generatedAt,
          paymentRequired: true,
        },
      });
    }

    // ── Return full report ────────────────────────────────────────────────────
    return response(200, {
      success: true,
      data: {
        reportId:             report.reportId,
        isPartial:            false,
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
      },
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return response(500, { success: false, error: "Failed to fetch report" });
  }
};
