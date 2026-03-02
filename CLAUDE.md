# CLAUDE.md — ChillCareer Backend

This file is the single source of truth for Claude Code when building and maintaining the ChillCareer backend.

---

## Project Overview

**ChillCareer** is an AI-powered career guidance platform for Indian students in classes 8–12.
Students complete a ~45-minute psychometric assessment. The AI analyses responses, timing behaviour,
subject performance and personal profile to generate a personalised career report.

Two audiences:
- **Student** — React Native mobile app (Expo)
- **Admin** — Web SPA (to be built separately)

**Tech Stack**

- Mobile Frontend: React Native (Expo)
- Admin Frontend: SPA (TBD — React)
- Backend: AWS Lambda (Node.js 20.x ESM) + API Gateway
- Database: AWS DynamoDB
- Auth (Student): Mobile OTP + Google OAuth → JWT
- Auth (Admin): Email + Password → JWT
- AI: Anthropic Claude API (`claude-sonnet-4-6`)
- Payments: Razorpay
- Storage: S3 (PDF reports + Lambda zips)
- Infrastructure: CloudFormation + GitHub Actions

---

## Test Groups

| Group | Classes | Test Type |
|---|---|---|
| `school` | 8th, 9th, 10th | School psychometric test |
| `college` | 11th, 12th | College psychometric test |

Test content is different per group. Admin creates named tests and assigns questions to each.

---

## Student App Flow

```
Auth (Google / Mobile OTP)
  ↓
Profile Setup (name, mobile, email, city, state)
  ↓
Education Background (class, stream, subject performance)
  ↓
Test (dynamic questions based on testGroup — ~45 mins, multiple sections)
  ↓
Payment Check
  ├── Already paid → Generate full report
  └── Not paid → Show partial report (teaser) → Payment → Generate full report
  ↓
Full Report (view on app + download PDF)
  ↓
AI Assistant (100 free messages)
  ↓
Chat Summary → Option to email summary to student
```

---

## Folder Structure

```
career-backend-services/
├── .github/
│   └── workflows/
│       ├── deploy-infrastructure.yml   ← triggers on infrastructure/** changes
│       └── deploy-pipeline.yml         ← PRIMARY/SECONDARY Lambda pipeline
├── infrastructure/
│   ├── dynamodb/
│   │   └── tables.yml                  ← all 10 DynamoDB tables
│   └── s3/
│       └── buckets.yml                 ← Lambda zips + reports PDF buckets
├── src/
│   ├── functions/
│   │   └── <function-name>/
│   │       ├── index.mjs
│   │       ├── package.json
│   │       └── cloudformation/
│   │           └── lambda-setup.yml
│   └── services/                       ← shared utilities (empty for now)
├── .gitignore
├── CLAUDE.md
└── README.md
```

---

## Lambda Functions

Each function lives in `src/functions/<function-name>/index.mjs`

### Student Auth

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-auth-send-otp` | POST | `/auth/send-otp` | Send OTP to mobile |
| `cc-auth-verify-otp` | POST | `/auth/verify-otp` | Verify OTP, return JWT |
| `cc-auth-google` | POST | `/auth/google` | Google OAuth token exchange |

### User / Profile

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-user-create` | POST | `/user` | Create user after first auth |
| `cc-user-get-profile` | GET | `/user/profile` | Get full user profile |
| `cc-user-update-profile` | PUT | `/user/profile` | Update profile, education, subject performance |

### Test

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-questions-get` | GET | `/questions?testGroup=school` | Get active questions for a test group |
| `cc-test-submit` | POST | `/test/submit` | Submit answers + timings |

### Payment

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-payment-create-order` | POST | `/payment/create-order` | Create Razorpay order |
| `cc-payment-verify` | POST | `/payment/verify` | Verify signature, trigger report generation |

### Report

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-report-generate` | POST | `/report/generate` | Internal — triggered after payment, calls Claude AI |
| `cc-report-get` | GET | `/report/{userId}` | Get report (partial if unpaid, full if paid) |

### AI Chat

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-ai-chat-message` | POST | `/ai/chat` | Send message (enforces 100 msg limit) |
| `cc-ai-chat-summary` | GET | `/ai/chat/summary` | Get AI-generated chat summary after limit |

### Notifications

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-notifications-send` | POST | `/notifications/send` | Internal — send push/SMS/email |

---

### Admin Functions

All admin routes are under `/admin`. Admin auth uses email + password (separate from student auth).

| Function | Method | Path | Description |
|---|---|---|---|
| `cc-admin-auth-login` | POST | `/admin/auth/login` | Admin login, returns JWT |
| `cc-admin-dashboard-get` | GET | `/admin/dashboard` | Stats: users, tests taken, payments, revenue |
| `cc-admin-users-get` | GET | `/admin/users` | List users with filters (class, payment status, etc.) |
| `cc-admin-users-send-email` | POST | `/admin/users/send-email` | Send templated email to one or multiple users |
| `cc-admin-tests-create` | POST | `/admin/tests` | Create a new test (name, testGroup, status) |
| `cc-admin-tests-get` | GET | `/admin/tests` | List all tests |
| `cc-admin-tests-update` | PUT | `/admin/tests/{testId}` | Update test name, status (active/inactive) |
| `cc-admin-questions-create` | POST | `/admin/questions` | Create question for a test |
| `cc-admin-questions-get` | GET | `/admin/questions?testId=xxx` | List questions for a test |
| `cc-admin-questions-update` | PUT | `/admin/questions/{questionId}` | Update question or mark active/inactive |
| `cc-admin-payments-get` | GET | `/admin/payments` | Payment records with filters |
| `cc-admin-email-templates-get` | GET | `/admin/email-templates` | List all email templates |

---

## Pipeline Classification

### PRIMARY (create new API Gateway resources)

```
cc-auth-send-otp          → creates /auth
cc-user-create            → creates /user
cc-user-get-profile       → creates /user/profile
cc-questions-get          → creates /questions
cc-test-submit            → creates /test
cc-payment-create-order   → creates /payment
cc-report-generate        → creates /report
cc-ai-chat-message        → creates /ai
cc-notifications-send     → creates /notifications
cc-admin-auth-login       → creates /admin
```

### SECONDARY (attach to existing resources)

```
cc-auth-verify-otp            → /auth/verify-otp        (needs: ApiGatewayAuthResourceId)
cc-auth-google                → /auth/google             (needs: ApiGatewayAuthResourceId)
cc-user-update-profile        → PUT /user/profile        (needs: ApiGatewayUserProfileResourceId)
cc-payment-verify             → /payment/verify          (needs: ApiGatewayPaymentResourceId)
cc-report-get                 → /report/{userId}         (needs: ApiGatewayReportResourceId)
cc-ai-chat-summary            → /ai/chat/summary         (needs: ApiGatewayAiResourceId)
cc-admin-dashboard-get        → /admin/dashboard         (needs: ApiGatewayAdminResourceId)
cc-admin-users-get            → /admin/users             (needs: ApiGatewayAdminResourceId)
cc-admin-users-send-email     → /admin/users/send-email  (needs: ApiGatewayAdminUsersResourceId)
cc-admin-tests-create         → /admin/tests             (needs: ApiGatewayAdminResourceId)
cc-admin-tests-update         → /admin/tests/{testId}    (needs: ApiGatewayAdminTestsResourceId)
cc-admin-questions-create     → /admin/questions         (needs: ApiGatewayAdminResourceId)
cc-admin-questions-update     → /admin/questions/{id}    (needs: ApiGatewayAdminQuestionsResourceId)
cc-admin-payments-get         → /admin/payments          (needs: ApiGatewayAdminResourceId)
cc-admin-email-templates-get  → /admin/email-templates   (needs: ApiGatewayAdminResourceId)
```

---

## DynamoDB Table Design

### Table: `cc-users`

**Primary Key:** `userId` (S)
**GSI 1:** `mobile-index` → PK: `mobile`
**GSI 2:** `email-index` → PK: `email`

| Attribute | Type | Description |
|---|---|---|
| `userId` | S | UUID — primary key |
| `mobile` | S | Mobile with country code e.g. +919876543210 |
| `email` | S | Email address |
| `firstName` | S | First name |
| `lastName` | S | Last name |
| `city` | S | City |
| `state` | S | State |
| `authProvider` | S | `mobile` / `google` |
| `studentClass` | S | `8th` / `9th` / `10th` / `11th` / `12th` |
| `testGroup` | S | `school` (8-10) / `college` (11-12) |
| `stream` | S | `Science` / `Commerce` / `Arts` / `Not decided yet` |
| `subjectPerformance` | M | Actual grades: `{ maths: "A", science: "B+", ... }` |
| `subjectRatings` | M | Feelings: `{ maths: 2, science: 3 }` (1=Struggle 4=Love it) |
| `testCompleted` | BOOL | Whether test is submitted |
| `paymentDone` | BOOL | Whether payment is verified |
| `reportReady` | BOOL | Whether AI report is generated |
| `aiMessagesUsed` | N | Count of AI chat messages used (limit: 100) |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-otps`

**Primary Key:** `otpId` (S)
**GSI:** `target-index` → PK: `target`
**TTL:** `expiresAt`

| Attribute | Type | Description |
|---|---|---|
| `otpId` | S | UUID |
| `target` | S | Mobile number |
| `type` | S | `mobile` |
| `otp` | S | SHA-256 hashed 6-digit OTP |
| `verified` | BOOL | Whether OTP was used |
| `expiresAt` | N | Unix timestamp — TTL 10 min |
| `createdAt` | S | ISO timestamp |

---

### Table: `cc-tests`

**Primary Key:** `testId` (S)
**GSI:** `testGroup-status-index` → PK: `testGroup`, SK: `status`

| Attribute | Type | Description |
|---|---|---|
| `testId` | S | UUID |
| `testName` | S | e.g. "School Career Test v1" |
| `testGroup` | S | `school` / `college` |
| `targetClasses` | L | e.g. `["8th","9th","10th"]` |
| `status` | S | `active` / `inactive` |
| `durationMins` | N | Expected duration in minutes (e.g. 45) |
| `description` | S | Short description |
| `totalQuestions` | N | Total questions in test |
| `version` | S | e.g. "v1" |
| `createdBy` | S | adminId |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-questions`

**Primary Key:** `questionId` (S)
**GSI 1:** `testId-index` → PK: `testId`, SK: `order`
**GSI 2:** `testGroup-index` → PK: `testGroup`

| Attribute | Type | Description |
|---|---|---|
| `questionId` | S | UUID |
| `testId` | S | FK to cc-tests |
| `testGroup` | S | `school` / `college` (denormalized for queries) |
| `section` | S | e.g. `Interests` / `Strengths` / `Work Style` / `Values` / `Goals` |
| `level` | S | `easy` / `medium` / `hard` |
| `type` | S | `single` / `multi` |
| `question` | S | Question text |
| `imageUrl` | S | Optional question image (S3 URL) |
| `options` | L | List of `{ id, label, emoji, imageUrl }` |
| `correctAnswerIds` | L | For knowledge questions: correct option ids. Empty for psychometric. |
| `isActive` | BOOL | Whether question is active |
| `order` | N | Display order within section |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-test-sessions`

**Primary Key:** `sessionId` (S)
**GSI:** `userId-index` → PK: `userId`

| Attribute | Type | Description |
|---|---|---|
| `sessionId` | S | UUID |
| `userId` | S | FK to cc-users |
| `testId` | S | FK to cc-tests |
| `testGroup` | S | `school` / `college` |
| `answers` | M | `{ questionId: [optionIds] }` |
| `timings` | M | `{ questionId: secondsTaken }` |
| `totalTimeSecs` | N | Total test duration in seconds |
| `status` | S | `in_progress` / `submitted` |
| `submittedAt` | S | ISO timestamp |
| `createdAt` | S | ISO timestamp |

---

### Table: `cc-payments`

**Primary Key:** `paymentId` (S)
**GSI:** `userId-index` → PK: `userId`

| Attribute | Type | Description |
|---|---|---|
| `paymentId` | S | UUID |
| `userId` | S | FK to cc-users |
| `razorpayOrderId` | S | Razorpay order ID |
| `razorpayPaymentId` | S | Razorpay payment ID (after success) |
| `razorpaySignature` | S | Signature for verification |
| `amount` | N | Total in paise (e.g. 35400 = ₹354) |
| `baseAmount` | N | Pre-GST in paise |
| `gstAmount` | N | GST in paise |
| `currency` | S | `INR` |
| `status` | S | `created` / `paid` / `failed` / `refunded` |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-reports`

**Primary Key:** `reportId` (S)
**GSI:** `userId-index` → PK: `userId`

| Attribute | Type | Description |
|---|---|---|
| `reportId` | S | UUID |
| `userId` | S | FK to cc-users |
| `sessionId` | S | FK to cc-test-sessions |
| `isPartial` | BOOL | `true` = teaser only (unpaid). `false` = full report (paid) |
| `partialReport` | M | Limited teaser: top 2 careers + summary only |
| `careerMatches` | L | `[{ rank, career, matchScore, description }]` (full only) |
| `personalityProfile` | M | AI personality summary (full only) |
| `streamRecommendation` | S | Recommended stream (full only) |
| `strengthsSummary` | S | Key strengths narrative (full only) |
| `behaviourInsights` | M | Timing-based behaviour signals (full only) |
| `subjectInsights` | M | Per-subject AI commentary (full only) |
| `roadmap` | L | `[{ milestone, description, timeframe }]` (full only) |
| `pdfUrl` | S | S3 URL of generated PDF (full only) |
| `generatedAt` | S | ISO timestamp |
| `modelVersion` | S | e.g. `claude-sonnet-4-6` |

---

### Table: `cc-ai-chats`

**Primary Key:** `chatId` (S)
**GSI:** `userId-index` → PK: `userId`

| Attribute | Type | Description |
|---|---|---|
| `chatId` | S | UUID |
| `userId` | S | FK to cc-users |
| `messages` | L | `[{ role, content, timestamp }]` |
| `messageCount` | N | Total messages sent by user |
| `freeLimit` | N | 100 (free messages allowed) |
| `chatSummary` | S | AI-generated summary shown after limit |
| `summaryEmailSent` | BOOL | Whether summary was emailed to student |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-admins`

**Primary Key:** `adminId` (S)
**GSI:** `email-index` → PK: `email`

| Attribute | Type | Description |
|---|---|---|
| `adminId` | S | UUID |
| `email` | S | Admin email |
| `passwordHash` | S | bcrypt hashed password |
| `name` | S | Display name |
| `role` | S | `super` / `support` |
| `isActive` | BOOL | Whether admin account is active |
| `createdAt` | S | ISO timestamp |
| `updatedAt` | S | ISO timestamp |

---

### Table: `cc-email-templates`

**Primary Key:** `templateId` (S)
**GSI:** `type-index` → PK: `type`

| Attribute | Type | Description |
|---|---|---|
| `templateId` | S | UUID |
| `name` | S | Template display name |
| `type` | S | `payment_reminder` / `follow_up` / `report_ready` / `ai_summary` / `general` |
| `subject` | S | Email subject (can include `{{firstName}}` etc.) |
| `body` | S | HTML email body with `{{placeholder}}` syntax |
| `isActive` | BOOL | Whether template is available |
| `createdAt` | S | ISO timestamp |

---

## Behaviour Analysis Logic

Use `timings` from test submission to derive behaviour signals for AI report:

| Pattern | Signal |
|---|---|
| Fast (<10s) + answered | High confidence, genuine preference |
| Slow (>45s) + answered | Careful, analytical thinker |
| Very slow (>90s) | Avoidance or difficulty |

---

## Claude AI Report Prompt

```
System: You are a career counselling expert for Indian students aged 13-18.
        Analyse the student's psychometric test results and generate a
        structured career report in JSON format only.

User:   Student Profile:
        - Name: {firstName}, Class: {studentClass}, Stream: {stream}
        - City: {city}, State: {state}
        - Test Group: {testGroup}
        - Subject Performance (grades): {subjectPerformance}
        - Subject Ratings (feelings): {subjectRatings}
        - Psychometric answers: {answers}
        - Behaviour insights from timings: {behaviourInsights}
        - Total test time: {totalTimeSecs} seconds

        Generate a JSON report with fields:
        careerMatches, personalityProfile, streamRecommendation,
        strengthsSummary, behaviourInsights, subjectInsights, roadmap

        Also generate a partialReport with only:
        top 2 careerMatches (no description), one-line personalityProfile.summary
```

---

## REST API Contract

### Base URL

```
https://api.chillcareer.in/v1
```

### Student Auth

```json
POST /auth/send-otp
{ "type": "mobile", "value": "+919876543210" }
→ { "success": true, "otpId": "uuid", "expiresIn": 600 }

POST /auth/verify-otp
{ "otpId": "uuid", "otp": "123456" }
→ { "success": true, "token": "jwt", "userId": "uuid", "isNewUser": true }

POST /auth/google
{ "idToken": "google_id_token" }
→ { "success": true, "token": "jwt", "userId": "uuid", "isNewUser": false }
```

### User Profile

```json
POST /user
{ "mobile": "+91...", "email": "...", "authProvider": "mobile" }
→ { "userId": "uuid", "createdAt": "..." }

GET /user/profile
→ { userId, firstName, lastName, email, mobile, city, state,
    studentClass, testGroup, stream, subjectPerformance, subjectRatings,
    testCompleted, paymentDone, reportReady, aiMessagesUsed }

PUT /user/profile
{ firstName, lastName, city, state, studentClass, testGroup,
  stream, subjectPerformance, subjectRatings }
```

### Test

```json
GET /questions?testGroup=school
→ { "questions": [...], "total": 45, "testId": "uuid" }

POST /test/submit
{ "testId": "uuid", "answers": { "q1": ["a"] },
  "timings": { "q1": 8 }, "totalTimeSecs": 1840 }
→ { "success": true, "sessionId": "uuid" }
```

### Payment

```json
POST /payment/create-order
→ { "orderId": "rzp_order_id", "amount": 35400, "currency": "INR",
    "baseAmount": 29900, "gstAmount": 5382, "keyId": "rzp_live_XXX" }

POST /payment/verify
{ "razorpayOrderId": "...", "razorpayPaymentId": "...", "razorpaySignature": "..." }
→ { "success": true, "reportId": "uuid" }
```

### Report

```json
GET /report/{userId}
// If unpaid: returns isPartial: true with partialReport only
// If paid:   returns full report
→ { reportId, isPartial, partialReport?, careerMatches?, personalityProfile?,
    streamRecommendation?, strengthsSummary?, behaviourInsights?,
    subjectInsights?, roadmap?, pdfUrl?, generatedAt }
```

### AI Chat

```json
POST /ai/chat
{ "message": "What careers suit me?" }
→ { "reply": "...", "chatId": "uuid", "messagesUsed": 5, "messagesRemaining": 95 }

// When limit reached (messagesUsed == 100):
→ { "limitReached": true, "chatSummary": "...", "chatId": "uuid" }

GET /ai/chat/summary
→ { "chatSummary": "...", "messagesUsed": 100 }
```

### Admin Auth

```json
POST /admin/auth/login
{ "email": "admin@chillcareer.in", "password": "..." }
→ { "success": true, "token": "admin_jwt", "adminId": "uuid" }
```

### Admin — Users

```json
GET /admin/users?paymentDone=false&testCompleted=true&class=10th&page=1
→ { "users": [...], "total": 120, "page": 1 }

POST /admin/users/send-email
{ "userIds": ["uuid1","uuid2"], "templateId": "uuid", "placeholders": { "discount": "20%" } }
→ { "success": true, "sent": 2 }
```

### Admin — Tests & Questions

```json
POST /admin/tests
{ "testName": "School Test v2", "testGroup": "school",
  "targetClasses": ["8th","9th","10th"], "durationMins": 45 }
→ { "testId": "uuid" }

GET /admin/tests
→ { "tests": [...] }

PUT /admin/tests/{testId}
{ "status": "active" }

POST /admin/questions
{ "testId": "uuid", "section": "Interests", "level": "easy",
  "type": "single", "question": "...", "options": [...],
  "correctAnswerIds": [], "imageUrl": null, "order": 1 }
→ { "questionId": "uuid" }

GET /admin/questions?testId=uuid
→ { "questions": [...] }

PUT /admin/questions/{questionId}
{ "isActive": false }
```

### Admin — Payments & Templates

```json
GET /admin/payments?status=paid&from=2026-01-01
→ { "payments": [...], "total": 89, "revenue": 315060 }

GET /admin/email-templates
→ { "templates": [...] }
```

---

## Environment Variables

```env
# DynamoDB
DYNAMODB_REGION=eu-west-1
USERS_TABLE=cc-users
OTPS_TABLE=cc-otps
TESTS_TABLE=cc-tests
QUESTIONS_TABLE=cc-questions
TEST_SESSIONS_TABLE=cc-test-sessions
PAYMENTS_TABLE=cc-payments
REPORTS_TABLE=cc-reports
AI_CHATS_TABLE=cc-ai-chats
ADMINS_TABLE=cc-admins
EMAIL_TEMPLATES_TABLE=cc-email-templates

# Auth
JWT_SECRET=your_student_jwt_secret
ADMIN_JWT_SECRET=your_admin_jwt_secret
JWT_EXPIRES_IN=30d

# AI
ANTHROPIC_API_KEY=your_claude_api_key

# Payment
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Email
EMAIL_FROM=noreply@chillcareer.in
SES_REGION=eu-west-1

# S3
S3_BUCKET_REPORTS=chillcareer-reports-dev
S3_REGION=eu-west-1

# AI Chat limit
AI_CHAT_FREE_LIMIT=100
```

---

## Development Notes

- All Lambda functions: Node.js 20.x, ESM (`index.mjs`, `"type": "module"`)
- Response format: `{ success: true, data: {} }` or `{ success: false, error: "msg" }`
- CORS headers in every Lambda response (not API Gateway)
- Student JWT expires in 30 days
- Admin JWT expires in 8 hours
- OTPs expire in 10 minutes (DynamoDB TTL)
- All amounts in paise (₹1 = 100 paise)
- All timestamps in ISO 8601
- `cc-report-generate` is async — triggered after payment verify, not directly by client
- Questions are created via Admin API — not hardcoded
- Partial report: top 2 career matches + one-line personality summary (no roadmap, no PDF)
- Full report: all fields + PDF generated and stored in S3
- AI chat summary is generated by Claude when messageCount hits 100
- Admin email uses AWS SES with HTML templates stored in cc-email-templates table
