-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NOT_DEPLOYED', 'DEPLOYING', 'DEPLOYED', 'FAILED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('PAGE_VIEW', 'TIME_ON_PAGE', 'BOUNCE_RATE', 'CONVERSION_RATE', 'USER_SESSION', 'CLICK_EVENT', 'SCROLL_DEPTH', 'UNIQUE_VIEW', 'COMPLETION_RATE', 'SHARE_COUNT', 'GEO_LOCATION', 'SECTION_VIEW', 'SECTION_TIME', 'HEATMAP_CLICK', 'VIDEO_PLAY', 'VIDEO_COMPLETION', 'AUDIO_PLAY', 'AUDIO_DOWNLOAD', 'CTA_CLICK', 'FORM_SUBMISSION', 'LEAD_SOURCE', 'USER_JOURNEY', 'PRINT_COST_SAVED', 'PAPER_SAVED', 'CARBON_REDUCTION', 'CUSTOM_EVENT', 'CUSTOM_CONVERSION', 'CUSTOM_AGGREGATE');

-- CreateEnum
CREATE TYPE "MetricCategory" AS ENUM ('DEFAULT', 'OVERVIEW', 'MARKETING', 'SALES', 'ENVIRONMENTAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MetricAggregation" AS ENUM ('COUNT', 'SUM', 'AVERAGE', 'UNIQUE', 'PERCENTAGE', 'DURATION', 'RATE', 'GEOGRAPHIC', 'MONETARY', 'ENVIRONMENTAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLogo" TEXT,
    "companyEmail" TEXT NOT NULL,
    "companyPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "builderSpaceId" TEXT,
    "repositoryUrl" TEXT,
    "deploymentUrl" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NOT_DEPLOYED',
    "vercelProjectId" TEXT,
    "clientId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "previewUrl" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUser" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAccess" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatmapClick" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "viewportWidth" INTEGER NOT NULL,
    "viewportHeight" INTEGER NOT NULL,
    "elementClicked" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relativeX" DOUBLE PRECISION,
    "relativeY" DOUBLE PRECISION,
    "scrollY" INTEGER,
    "fixedAncestorPosition" TEXT,
    "fixedAncestorRect" JSONB,
    "fixedAncestorTag" TEXT,
    "isFixedElement" BOOLEAN,

    CONSTRAINT "HeatmapClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "posthogEnabled" BOOLEAN NOT NULL DEFAULT false,
    "posthogProjectId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 3600,
    "syncBatchSize" INTEGER NOT NULL DEFAULT 1000,
    "lastSynced" TIMESTAMP(3),
    "environment" TEXT NOT NULL DEFAULT 'production',
    "sampleRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "filterInternalTraffic" BOOLEAN NOT NULL DEFAULT true,
    "captureConsoleLog" BOOLEAN NOT NULL DEFAULT false,
    "capturePerformance" BOOLEAN NOT NULL DEFAULT true,
    "errorThreshold" INTEGER NOT NULL DEFAULT 100,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MetricType" NOT NULL,
    "category" "MetricCategory" NOT NULL DEFAULT 'DEFAULT',
    "aggregation" "MetricAggregation" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "eventName" TEXT,
    "filters" JSONB,
    "properties" JSONB,
    "visualization" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "layout" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardItem" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "chartType" TEXT NOT NULL,
    "timeRange" TEXT,
    "customConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedUrl" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVisited" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricData" (
    "id" TEXT NOT NULL,
    "urlId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "dimension1" TEXT,
    "dimension2" TEXT,
    "dimension3" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_role_idx" ON "User"("email", "role");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- CreateIndex
CREATE INDEX "User_email_createdAt_idx" ON "User"("email", "createdAt");

-- CreateIndex
CREATE INDEX "User_role_updatedAt_idx" ON "User"("role", "updatedAt");

-- CreateIndex
CREATE INDEX "User_name_email_idx" ON "User"("name", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyEmail_key" ON "Client"("companyEmail");

-- CreateIndex
CREATE INDEX "Client_createdById_idx" ON "Client"("createdById");

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "Client_companyEmail_idx" ON "Client"("companyEmail");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt");

-- CreateIndex
CREATE INDEX "Client_companyName_createdAt_idx" ON "Client"("companyName", "createdAt");

-- CreateIndex
CREATE INDEX "Client_companyName_state_country_idx" ON "Client"("companyName", "state", "country");

-- CreateIndex
CREATE INDEX "Client_createdById_updatedAt_idx" ON "Client"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_clientId_status_idx" ON "Project"("clientId", "status");

-- CreateIndex
CREATE INDEX "Project_clientId_updatedAt_idx" ON "Project"("clientId", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_name_status_idx" ON "Project"("name", "status");

-- CreateIndex
CREATE INDEX "Project_clientId_name_idx" ON "Project"("clientId", "name");

-- CreateIndex
CREATE INDEX "ClientUser_clientId_role_idx" ON "ClientUser"("clientId", "role");

-- CreateIndex
CREATE INDEX "ClientUser_userId_role_idx" ON "ClientUser"("userId", "role");

-- CreateIndex
CREATE INDEX "ClientUser_isPending_createdAt_idx" ON "ClientUser"("isPending", "createdAt");

-- CreateIndex
CREATE INDEX "ClientUser_clientId_isPending_idx" ON "ClientUser"("clientId", "isPending");

-- CreateIndex
CREATE INDEX "ClientUser_userId_isPending_idx" ON "ClientUser"("userId", "isPending");

-- CreateIndex
CREATE INDEX "ClientUser_role_updatedAt_idx" ON "ClientUser"("role", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_clientId_userId_key" ON "ClientUser"("clientId", "userId");

-- CreateIndex
CREATE INDEX "PendingInvitation_clientId_idx" ON "PendingInvitation"("clientId");

-- CreateIndex
CREATE INDEX "PendingInvitation_email_idx" ON "PendingInvitation"("email");

-- CreateIndex
CREATE INDEX "PendingInvitation_expiresAt_idx" ON "PendingInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "PendingInvitation_email_clientId_idx" ON "PendingInvitation"("email", "clientId");

-- CreateIndex
CREATE INDEX "PendingInvitation_clientId_expiresAt_idx" ON "PendingInvitation"("clientId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_email_idx" ON "AuthAttempt"("email");

-- CreateIndex
CREATE INDEX "AuthAttempt_ipAddress_idx" ON "AuthAttempt"("ipAddress");

-- CreateIndex
CREATE INDEX "AuthAttempt_createdAt_idx" ON "AuthAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_email_success_idx" ON "AuthAttempt"("email", "success");

-- CreateIndex
CREATE INDEX "AuthAttempt_ipAddress_createdAt_idx" ON "AuthAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAccess_email_key" ON "EmployeeAccess"("email");

-- CreateIndex
CREATE INDEX "EmployeeAccess_addedById_idx" ON "EmployeeAccess"("addedById");

-- CreateIndex
CREATE INDEX "EmployeeAccess_status_idx" ON "EmployeeAccess"("status");

-- CreateIndex
CREATE INDEX "EmployeeAccess_email_idx" ON "EmployeeAccess"("email");

-- CreateIndex
CREATE INDEX "EmployeeAccess_status_createdAt_idx" ON "EmployeeAccess"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeAccess_email_status_idx" ON "EmployeeAccess"("email", "status");

-- CreateIndex
CREATE INDEX "HeatmapClick_projectId_idx" ON "HeatmapClick"("projectId");

-- CreateIndex
CREATE INDEX "HeatmapClick_projectId_pageUrl_idx" ON "HeatmapClick"("projectId", "pageUrl");

-- CreateIndex
CREATE INDEX "HeatmapClick_timestamp_idx" ON "HeatmapClick"("timestamp");

-- CreateIndex
CREATE INDEX "HeatmapClick_sessionId_idx" ON "HeatmapClick"("sessionId");

-- CreateIndex
CREATE INDEX "HeatmapClick_isFixedElement_idx" ON "HeatmapClick"("isFixedElement");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsConfig_projectId_key" ON "AnalyticsConfig"("projectId");

-- CreateIndex
CREATE INDEX "AnalyticsConfig_projectId_idx" ON "AnalyticsConfig"("projectId");

-- CreateIndex
CREATE INDEX "AnalyticsConfig_environment_idx" ON "AnalyticsConfig"("environment");

-- CreateIndex
CREATE INDEX "AnalyticsConfig_lastSynced_idx" ON "AnalyticsConfig"("lastSynced");

-- CreateIndex
CREATE INDEX "Metric_configId_idx" ON "Metric"("configId");

-- CreateIndex
CREATE INDEX "Metric_type_idx" ON "Metric"("type");

-- CreateIndex
CREATE INDEX "Metric_category_idx" ON "Metric"("category");

-- CreateIndex
CREATE INDEX "Metric_enabled_idx" ON "Metric"("enabled");

-- CreateIndex
CREATE INDEX "Metric_isPublic_idx" ON "Metric"("isPublic");

-- CreateIndex
CREATE INDEX "Dashboard_configId_idx" ON "Dashboard"("configId");

-- CreateIndex
CREATE INDEX "Dashboard_isDefault_idx" ON "Dashboard"("isDefault");

-- CreateIndex
CREATE INDEX "Dashboard_isPublic_idx" ON "Dashboard"("isPublic");

-- CreateIndex
CREATE INDEX "DashboardItem_dashboardId_idx" ON "DashboardItem"("dashboardId");

-- CreateIndex
CREATE INDEX "DashboardItem_metricId_idx" ON "DashboardItem"("metricId");

-- CreateIndex
CREATE INDEX "TrackedUrl_projectId_idx" ON "TrackedUrl"("projectId");

-- CreateIndex
CREATE INDEX "TrackedUrl_path_idx" ON "TrackedUrl"("path");

-- CreateIndex
CREATE INDEX "TrackedUrl_lastVisited_idx" ON "TrackedUrl"("lastVisited");

-- CreateIndex
CREATE INDEX "TrackedUrl_isActive_idx" ON "TrackedUrl"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedUrl_projectId_path_key" ON "TrackedUrl"("projectId", "path");

-- CreateIndex
CREATE INDEX "MetricData_urlId_idx" ON "MetricData"("urlId");

-- CreateIndex
CREATE INDEX "MetricData_metricType_idx" ON "MetricData"("metricType");

-- CreateIndex
CREATE INDEX "MetricData_timestamp_idx" ON "MetricData"("timestamp");

-- CreateIndex
CREATE INDEX "MetricData_dimension1_idx" ON "MetricData"("dimension1");

-- CreateIndex
CREATE INDEX "MetricData_dimension2_idx" ON "MetricData"("dimension2");

-- CreateIndex
CREATE INDEX "MetricData_dimension3_idx" ON "MetricData"("dimension3");
