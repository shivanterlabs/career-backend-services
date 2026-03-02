# CLAUDE.md — ChillCareer Backend

This file provides Claude Code with full context for building and maintaining the ChillCareer backend.

---

## Project Overview

**ChillCareer** is an AI-powered career guidance app for Indian students in classes 8–12.  
Students complete a ~40-minute psychometric assessment. The AI analyses responses, timing behaviour, subject performance and personal profile to generate a personalised career report.

**Tech Stack**

- Frontend: React Native (Expo)
- Backend: AWS Lambda (Node.js) + API Gateway
- Database: AWS DynamoDB
- Auth: OTP via SMS (mobile) / Email + Google OAuth
- AI: Anthropic Claude API (career report generation)
- Payments: Razorpay
- Infrastructure: AWS SAM / CloudFormation

---

## Folder Structure

Follow this structure (mirror the reference project pattern):

```
chillcareer-backend/
├── .claude/
├── .github/
│   └── workflows/
│       ├── deploy-infrastructure.yml
│       └── deploy-pipeline.yml
├── docs/
│   └── api-contract.md
├── src/
│   └── functions/
│       ├── cc-auth-send-otp/
│       ├── cc-auth-verify-otp/
│       ├── cc-auth-google/
│       ├── cc-user-create/
│       ├── cc-user-get-profile/
│       ├── cc-user-update-profile/
│       ├── cc-pretest-submit/
│       ├── cc-questions-get/
│       ├── cc-test-submit/
│       ├── cc-payment-create-order/
│       ├── cc-payment-verify/
│       ├── cc-report-generate/
│       ├── cc-report-get/
│       ├── cc-ai-chat-message/
│       └── cc-notifications-send/
├── infrastructure/
│   └── dynamodb/
│       └── tables.yml
├── Services/
├── .gitignore
├── CLAUDE.md
├── README.md
├── settings.json
└── settings.local.json
```

---

## Lambda Functions

Each function lives in `src/functions/<function-name>/index.js`

### Auth

| Function             | Method | Path               | Description                  |
| -------------------- | ------ | ------------------ | ---------------------------- |
| `cc-auth-send-otp`   | POST   | `/auth/send-otp`   | Send OTP to mobile or email  |
| `cc-auth-verify-otp` | POST   | `/auth/verify-otp` | Verify OTP, return JWT token |
| `cc-auth-google`     | POST   | `/auth/google`     | Google OAuth token exchange  |

### User / Profile

| Function                 | Method | Path            | Description                                 |
| ------------------------ | ------ | --------------- | ------------------------------------------- |
| `cc-user-create`         | POST   | `/user`         | Create user after first auth                |
| `cc-user-get-profile`    | GET    | `/user/profile` | Get full user profile                       |
| `cc-user-update-profile` | PUT    | `/user/profile` | Update name, class, stream, subject ratings |

### Pre-Test

| Function            | Method | Path       | Description                                               |
| ------------------- | ------ | ---------- | --------------------------------------------------------- |
| `cc-pretest-submit` | POST   | `/pretest` | Save pre-test form (name, class, stream, subject ratings) |

### Questions

| Function           | Method | Path                    | Description                     |
| ------------------ | ------ | ----------------------- | ------------------------------- |
| `cc-questions-get` | GET    | `/questions?class=10th` | Get questions filtered by class |

### Test

| Function         | Method | Path           | Description                                         |
| ---------------- | ------ | -------------- | --------------------------------------------------- |
| `cc-test-submit` | POST   | `/test/submit` | Submit answers + timings, trigger report generation |

### Payment

| Function                  | Method | Path                    | Description                                  |
| ------------------------- | ------ | ----------------------- | -------------------------------------------- |
| `cc-payment-create-order` | POST   | `/payment/create-order` | Create Razorpay order, return order_id       |
| `cc-payment-verify`       | POST   | `/payment/verify`       | Verify Razorpay signature, mark payment done |

### Report

| Function             | Method | Path               | Description                                                |
| -------------------- | ------ | ------------------ | ---------------------------------------------------------- |
| `cc-report-generate` | POST   | `/report/generate` | Internal — called after payment verify, triggers Claude AI |
| `cc-report-get`      | GET    | `/report/:userId`  | Get generated report for user                              |

### AI Chat

| Function             | Method | Path       | Description                                |
| -------------------- | ------ | ---------- | ------------------------------------------ |
| `cc-ai-chat-message` | POST   | `/ai/chat` | Send message to Claude AI career assistant |

### Notifications

| Function                | Method | Path                  | Description                                     |
| ----------------------- | ------ | --------------------- | ----------------------------------------------- |
| `cc-notifications-send` | POST   | `/notifications/send` | Internal — send push / SMS / email notification |

---

## DynamoDB Table Design

### Table: `cc-users`

**Primary Key:** `userId` (String) — UUID  
**GSI 1:** `mobile-index` → partition key: `mobile`  
**GSI 2:** `email-index` → partition key: `email`

| Attribute        | Type | Description                                         |
| ---------------- | ---- | --------------------------------------------------- |
| `userId`         | S    | UUID — primary key                                  |
| `mobile`         | S    | Mobile number with country code                     |
| `email`          | S    | Email address                                       |
| `firstName`      | S    | First name                                          |
| `lastName`       | S    | Last name                                           |
| `authProvider`   | S    | `mobile` / `email` / `google`                       |
| `studentClass`   | S    | `8th` to `12th` or `Passed out`                     |
| `stream`         | S    | `Science` / `Commerce` / `Arts` / `Not decided yet` |
| `subjectRatings` | M    | Map: `{ maths: 2, science: 3, english: 4, ... }`    |
| `testCompleted`  | BOOL | Whether test is submitted                           |
| `paymentDone`    | BOOL | Whether payment is verified                         |
| `reportReady`    | BOOL | Whether AI report is generated                      |
| `createdAt`      | S    | ISO timestamp                                       |
| `updatedAt`      | S    | ISO timestamp                                       |

---

### Table: `cc-otps`

**Primary Key:** `otpId` (String)  
**GSI:** `target-index` → partition key: `target` (mobile or email)  
**TTL attribute:** `expiresAt`

| Attribute   | Type | Description                                    |
| ----------- | ---- | ---------------------------------------------- |
| `otpId`     | S    | UUID                                           |
| `target`    | S    | Mobile number or email                         |
| `type`      | S    | `mobile` / `email`                             |
| `otp`       | S    | 6-digit OTP (hashed)                           |
| `verified`  | BOOL | Whether OTP was used                           |
| `expiresAt` | N    | Unix timestamp — TTL auto-deletes after 10 min |
| `createdAt` | S    | ISO timestamp                                  |

---

### Table: `cc-questions`

**Primary Key:** `questionId` (String)  
**GSI:** `class-index` → partition key: `targetClass`

| Attribute     | Type | Description                                                   |
| ------------- | ---- | ------------------------------------------------------------- |
| `questionId`  | S    | UUID                                                          |
| `targetClass` | S    | `8th` / `9th` / `10th` / `11th-12th` / `all`                  |
| `category`    | S    | `Interests` / `Strengths` / `Work Style` / `Values` / `Goals` |
| `type`        | S    | `single` / `multi`                                            |
| `question`    | S    | Question text                                                 |
| `options`     | L    | List of `{ id, label, emoji }`                                |
| `difficulty`  | S    | `easy` / `medium` / `hard`                                    |
| `imageUrl`    | S    | Optional image URL                                            |
| `order`       | N    | Display order within category                                 |
| `createdAt`   | S    | ISO timestamp                                                 |

---

### Table: `cc-test-sessions`

**Primary Key:** `sessionId` (String)  
**GSI:** `userId-index` → partition key: `userId`

| Attribute       | Type | Description                         |
| --------------- | ---- | ----------------------------------- |
| `sessionId`     | S    | UUID                                |
| `userId`        | S    | FK to cc-users                      |
| `answers`       | M    | Map: `{ questionId: [optionIds] }`  |
| `timings`       | M    | Map: `{ questionId: secondsTaken }` |
| `totalTimeSecs` | N    | Total test duration in seconds      |
| `status`        | S    | `in_progress` / `submitted`         |
| `submittedAt`   | S    | ISO timestamp                       |
| `createdAt`     | S    | ISO timestamp                       |

---

### Table: `cc-payments`

**Primary Key:** `paymentId` (String)  
**GSI:** `userId-index` → partition key: `userId`

| Attribute           | Type | Description                         |
| ------------------- | ---- | ----------------------------------- |
| `paymentId`         | S    | UUID                                |
| `userId`            | S    | FK to cc-users                      |
| `razorpayOrderId`   | S    | Razorpay order ID                   |
| `razorpayPaymentId` | S    | Razorpay payment ID (after success) |
| `razorpaySignature` | S    | Signature for verification          |
| `amount`            | N    | Amount in paise (e.g. 35400 = ₹354) |
| `baseAmount`        | N    | Pre-GST amount in paise             |
| `gstAmount`         | N    | GST amount in paise                 |
| `currency`          | S    | `INR`                               |
| `status`            | S    | `created` / `paid` / `failed`       |
| `createdAt`         | S    | ISO timestamp                       |
| `updatedAt`         | S    | ISO timestamp                       |

---

### Table: `cc-reports`

**Primary Key:** `reportId` (String)  
**GSI:** `userId-index` → partition key: `userId`

| Attribute              | Type | Description                                         |
| ---------------------- | ---- | --------------------------------------------------- |
| `reportId`             | S    | UUID                                                |
| `userId`               | S    | FK to cc-users                                      |
| `sessionId`            | S    | FK to cc-test-sessions                              |
| `careerMatches`        | L    | List of `{ rank, career, matchScore, description }` |
| `personalityProfile`   | M    | AI-generated personality summary                    |
| `streamRecommendation` | S    | Recommended stream                                  |
| `strengthsSummary`     | S    | Key strengths narrative                             |
| `behaviourInsights`    | M    | Timing-based behaviour analysis                     |
| `subjectInsights`      | M    | Per-subject AI commentary                           |
| `roadmap`              | L    | List of `{ milestone, description, timeframe }`     |
| `pdfUrl`               | S    | S3 URL of generated PDF                             |
| `generatedAt`          | S    | ISO timestamp                                       |
| `modelVersion`         | S    | Claude model used e.g. `claude-sonnet-4-6`          |

---

### Table: `cc-ai-chats`

**Primary Key:** `chatId` (String)  
**GSI:** `userId-index` → partition key: `userId`

| Attribute   | Type | Description                            |
| ----------- | ---- | -------------------------------------- |
| `chatId`    | S    | UUID                                   |
| `userId`    | S    | FK to cc-users                         |
| `messages`  | L    | List of `{ role, content, timestamp }` |
| `createdAt` | S    | ISO timestamp                          |
| `updatedAt` | S    | ISO timestamp                          |

---

## REST API Contract

### Base URL

```
https://api.chillcareer.in/v1
```

### Authentication

All protected routes require:

```
Authorization: Bearer <jwt_token>
```

---

### Auth Endpoints

#### POST `/auth/send-otp`

```json
// Request
{
  "type": "mobile",       // "mobile" | "email"
  "value": "+919860719197"
}

// Response 200
{
  "success": true,
  "otpId": "uuid",
  "expiresIn": 600
}
```

#### POST `/auth/verify-otp`

```json
// Request
{
  "otpId": "uuid",
  "otp": "123456"
}

// Response 200
{
  "success": true,
  "token": "jwt_token",
  "userId": "uuid",
  "isNewUser": true
}
```

#### POST `/auth/google`

```json
// Request
{
  "idToken": "google_id_token"
}

// Response 200
{
  "success": true,
  "token": "jwt_token",
  "userId": "uuid",
  "isNewUser": false
}
```

---

### User Endpoints

#### POST `/user`

```json
// Request (called automatically after first auth for new users)
{
  "mobile": "+919860719197",
  "email": "ravi@gmail.com",
  "authProvider": "mobile"
}

// Response 201
{
  "userId": "uuid",
  "createdAt": "2026-02-01T00:00:00Z"
}
```

#### GET `/user/profile`

```json
// Response 200
{
  "userId": "uuid",
  "firstName": "Ravi",
  "lastName": "Ambar",
  "email": "ravi@gmail.com",
  "mobile": "+919860719197",
  "studentClass": "10th",
  "stream": null,
  "subjectRatings": {
    "maths": 2,
    "science": 3,
    "english": 4,
    "social": 4,
    "hindi": 4,
    "computer": 4
  },
  "testCompleted": false,
  "paymentDone": false,
  "reportReady": false
}
```

#### PUT `/user/profile`

```json
// Request
{
  "firstName": "Ravi",
  "lastName": "Ambar",
  "studentClass": "10th",
  "stream": null,
  "subjectRatings": { "maths": 2, "science": 3 }
}
```

---

### Pre-Test Endpoint

#### POST `/pretest`

```json
// Request
{
  "firstName": "Ravi",
  "lastName": "Ambar",
  "email": "ravi@gmail.com",
  "mobile": "9860719197",
  "studentClass": "10th",
  "stream": null,
  "subjectRatings": { "maths": 2, "science": 3, "english": 4, "social": 4, "hindi": 4, "computer": 4 }
}

// Response 200
{
  "success": true
}
```

---

### Questions Endpoint

#### GET `/questions?class=10th`

```json
// Response 200
{
  "questions": [
    {
      "questionId": "uuid",
      "category": "Interests",
      "type": "single",
      "question": "Which activity excites you the most?",
      "options": [
        { "id": "a", "label": "Building & making things", "emoji": "🔨" }
      ],
      "difficulty": "easy",
      "imageUrl": null
    }
  ],
  "total": 40
}
```

---

### Test Endpoint

#### POST `/test/submit`

```json
// Request
{
  "answers": { "q1": ["a"], "q2": ["c"], "q3": ["a", "b", "d"] },
  "timings": { "q1": 8, "q2": 23, "q3": 45 },
  "totalTimeSecs": 1840
}

// Response 200
{
  "success": true,
  "sessionId": "uuid"
}
```

---

### Payment Endpoints

#### POST `/payment/create-order`

```json
// Response 200
{
  "orderId": "razorpay_order_id",
  "amount": 35400,
  "currency": "INR",
  "baseAmount": 29900,
  "gstAmount": 5382,
  "keyId": "rzp_live_XXXXX"
}
```

#### POST `/payment/verify`

```json
// Request
{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "sig_xxx"
}

// Response 200
{
  "success": true,
  "reportId": "uuid"
}
```

---

### Report Endpoints

#### GET `/report/:userId`

```json
// Response 200
{
  "reportId": "uuid",
  "careerMatches": [
    {
      "rank": 1,
      "career": "Software Engineer",
      "matchScore": 92,
      "description": "..."
    }
  ],
  "personalityProfile": { "type": "Analytical Creator", "summary": "..." },
  "streamRecommendation": "Science",
  "strengthsSummary": "...",
  "behaviourInsights": {
    "impulsive": false,
    "anxious": false,
    "confident": true
  },
  "subjectInsights": {
    "maths": "Shows struggle — consider extra support",
    "science": "Good aptitude"
  },
  "roadmap": [{ "milestone": "Choose Science stream", "timeframe": "Now" }],
  "pdfUrl": "https://s3.amazonaws.com/...",
  "generatedAt": "2026-02-01T00:00:00Z"
}
```

---

### AI Chat Endpoint

#### POST `/ai/chat`

```json
// Request
{
  "message": "What careers suit me if I love computers but hate maths?"
}

// Response 200
{
  "reply": "Great question! There are several tech careers that don't require heavy maths...",
  "chatId": "uuid"
}
```

---

## Behaviour Analysis Logic

Use `timings` from test submission to derive behaviour signals for the AI report:

| Pattern               | Signal                            |
| --------------------- | --------------------------------- |
| Fast answer + correct | High confidence, genuine strength |
| Fast answer + wrong   | Impulsive, overconfident          |
| Slow answer + correct | Careful, analytical thinker       |
| Slow answer + wrong   | Struggling, possible anxiety      |
| Very slow (>90s)      | Avoidance behaviour               |

**Thresholds:**

- Fast: < 10 seconds
- Medium: 10–45 seconds
- Slow: > 45 seconds
- Very slow: > 90 seconds

---

## Claude AI Report Prompt

When calling Claude API in `cc-report-generate`, use this structure:

```
System: You are a career counselling expert for Indian students aged 14-18.
        Analyse the student's psychometric test results and generate a
        structured career report in JSON format only.

User:   Student Profile:
        - Class: {studentClass}, Stream: {stream}
        - Subject Ratings: {subjectRatings}
        - Personality answers: {answers}
        - Behaviour insights: {behaviourInsights}
        - Total test time: {totalTimeSecs} seconds

        Generate a JSON report with these fields:
        careerMatches, personalityProfile, streamRecommendation,
        strengthsSummary, behaviourInsights, subjectInsights, roadmap
```

---

## Environment Variables

```env
DYNAMODB_REGION=ap-south-1
USERS_TABLE=cc-users
OTPS_TABLE=cc-otps
QUESTIONS_TABLE=cc-questions
TEST_SESSIONS_TABLE=cc-test-sessions
PAYMENTS_TABLE=cc-payments
REPORTS_TABLE=cc-reports
AI_CHATS_TABLE=cc-ai-chats
JWT_SECRET=your_jwt_secret
ANTHROPIC_API_KEY=your_claude_api_key
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
SMS_PROVIDER_API_KEY=your_sms_key
EMAIL_FROM=noreply@chillcareer.in
S3_BUCKET=chillcareer-reports
```

---

## Development Notes

- All Lambda functions use Node.js 20.x runtime
- Use `aws-sdk` v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- JWT tokens expire in 30 days
- OTPs expire in 10 minutes (TTL on DynamoDB)
- All amounts stored in paise (multiply ₹ by 100)
- All timestamps in ISO 8601 format
- `cc-report-generate` is async — triggered internally after payment verify, not directly by client
- Questions are seeded manually into `cc-questions` table — not user-generated
