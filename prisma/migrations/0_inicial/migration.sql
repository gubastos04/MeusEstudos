-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasProgrammedBefore" TEXT,
    "knownLanguages" TEXT NOT NULL DEFAULT '[]',
    "usedGit" TEXT,
    "usedDatabase" TEXT,
    "typicalMinutes" INTEGER NOT NULL DEFAULT 20,
    "goal" TEXT,
    "trackId" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "theme" TEXT NOT NULL DEFAULT 'system',
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "codeFontSize" INTEGER NOT NULL DEFAULT 14,
    "linkedinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAIConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "keyHint" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
    "dailyLimit" INTEGER NOT NULL DEFAULT 40,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 10,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "hasExercise" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'text',
    "minutes" INTEGER NOT NULL DEFAULT 5,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 10,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "topics" TEXT NOT NULL DEFAULT '[]',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demand" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 30,
    "summary" TEXT NOT NULL DEFAULT '',
    "stack" TEXT NOT NULL DEFAULT '[]',
    "moduleIds" TEXT NOT NULL DEFAULT '[]',
    "contextQuality" TEXT NOT NULL DEFAULT 'completo',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "payload" TEXT,

    CONSTRAINT "Demand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'intermediario',
    "stack" TEXT NOT NULL DEFAULT '[]',
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 15,
    "summary" TEXT NOT NULL DEFAULT '',
    "stack" TEXT NOT NULL DEFAULT '[]',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "moduleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "secondsSpent" INTEGER NOT NULL DEFAULT 0,
    "resumeBlock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "exercisesAttempted" INTEGER NOT NULL DEFAULT 0,
    "demandsWorked" INTEGER NOT NULL DEFAULT 0,
    "assessmentsTaken" INTEGER NOT NULL DEFAULT 0,
    "errorsLogged" INTEGER NOT NULL DEFAULT 0,
    "notesWritten" INTEGER NOT NULL DEFAULT 0,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nodeType" TEXT,
    "nodeId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'text',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT NOT NULL DEFAULT '[]',
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "solutionSeen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "correctItems" INTEGER NOT NULL DEFAULT 0,
    "strongTopics" TEXT NOT NULL DEFAULT '[]',
    "reviewTopics" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "choiceIndex" INTEGER,
    "code" TEXT,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT NOT NULL DEFAULT '[]',
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'analisando',
    "understanding" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "solution" TEXT NOT NULL DEFAULT '',
    "testNotes" TEXT NOT NULL DEFAULT '',
    "repoUrl" TEXT,
    "branchName" TEXT,
    "prTitle" TEXT,
    "prBody" TEXT,
    "acceptance" TEXT NOT NULL DEFAULT '[]',
    "selfReview" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "doneSteps" TEXT NOT NULL DEFAULT '[]',
    "checklist" TEXT NOT NULL DEFAULT '{}',
    "repoUrl" TEXT,
    "deployUrl" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL DEFAULT '',
    "decisions" TEXT NOT NULL DEFAULT '',
    "difficulties" TEXT NOT NULL DEFAULT '',
    "learnings" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'text',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "moduleId" TEXT,
    "nodeType" TEXT,
    "nodeId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "cause" TEXT NOT NULL DEFAULT '',
    "solution" TEXT NOT NULL DEFAULT '',
    "learning" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'text',
    "technology" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "moduleId" TEXT,
    "nodeType" TEXT,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "moduleId" TEXT,
    "nodeType" TEXT,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubProfile_userId_key" ON "GitHubProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAIConfig_userId_key" ON "UserAIConfig"("userId");

-- CreateIndex
CREATE INDEX "Module_semester_order_idx" ON "Module"("semester", "order");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Exercise_lessonId_idx" ON "Exercise"("lessonId");

-- CreateIndex
CREATE INDEX "Assessment_moduleId_idx" ON "Assessment"("moduleId");

-- CreateIndex
CREATE INDEX "Question_assessmentId_order_idx" ON "Question"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "Demand_type_idx" ON "Demand"("type");

-- CreateIndex
CREATE INDEX "Demand_difficulty_idx" ON "Demand"("difficulty");

-- CreateIndex
CREATE INDEX "Demand_ownerId_idx" ON "Demand"("ownerId");

-- CreateIndex
CREATE INDEX "Challenge_category_idx" ON "Challenge"("category");

-- CreateIndex
CREATE INDEX "GlossaryTerm_term_idx" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE INDEX "Progress_userId_lastSeenAt_idx" ON "Progress"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Progress_userId_moduleId_idx" ON "Progress"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "Progress_userId_status_idx" ON "Progress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_nodeType_nodeId_key" ON "Progress"("userId", "nodeType", "nodeId");

-- CreateIndex
CREATE INDEX "Activity_userId_day_idx" ON "Activity"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_day_key" ON "Activity"("userId", "day");

-- CreateIndex
CREATE INDEX "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_type_createdAt_idx" ON "Event"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ExerciseAttempt_userId_exerciseId_createdAt_idx" ON "ExerciseAttempt"("userId", "exerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_assessmentId_idx" ON "AssessmentAttempt"("userId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_userId_assessmentId_attemptNumber_key" ON "AssessmentAttempt"("userId", "assessmentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE INDEX "Answer_userId_questionId_idx" ON "Answer"("userId", "questionId");

-- CreateIndex
CREATE INDEX "DemandSubmission_userId_status_idx" ON "DemandSubmission"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DemandSubmission_userId_demandId_key" ON "DemandSubmission"("userId", "demandId");

-- CreateIndex
CREATE INDEX "ProjectProgress_userId_idx" ON "ProjectProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProgress_userId_projectId_key" ON "ProjectProgress"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Note_userId_updatedAt_idx" ON "Note"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Note_userId_pinned_idx" ON "Note"("userId", "pinned");

-- CreateIndex
CREATE INDEX "ErrorRecord_userId_createdAt_idx" ON "ErrorRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorRecord_userId_resolved_idx" ON "ErrorRecord"("userId", "resolved");

-- CreateIndex
CREATE INDEX "AIRequest_userId_createdAt_idx" ON "AIRequest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsage_userId_day_key" ON "AIUsage"("userId", "day");

-- CreateIndex
CREATE INDEX "RateLimit_windowEnd_idx" ON "RateLimit"("windowEnd");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubProfile" ADD CONSTRAINT "GitHubProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAIConfig" ADD CONSTRAINT "UserAIConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAttempt" ADD CONSTRAINT "ExerciseAttempt_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSubmission" ADD CONSTRAINT "DemandSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandSubmission" ADD CONSTRAINT "DemandSubmission_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProgress" ADD CONSTRAINT "ProjectProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProgress" ADD CONSTRAINT "ProjectProgress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorRecord" ADD CONSTRAINT "ErrorRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

