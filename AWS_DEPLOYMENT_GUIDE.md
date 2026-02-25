# Clarke & Associates CRM — AWS Deployment Guide

This guide walks through deploying the Clarke & Associates CRM on AWS using the included CloudFormation template. The template provisions a complete production-ready infrastructure including VPC networking, RDS MySQL database, ECS Fargate compute, S3 media storage, CloudFront CDN, Application Load Balancer, SSL certificate, and CloudWatch monitoring.

---

## Architecture Overview

```
Internet
   │
   ▼
Route 53 (DNS)
   │
   ▼
CloudFront (CDN for media assets)     ACM (SSL Certificate)
   │                                       │
   ▼                                       ▼
Application Load Balancer (ALB) ──── HTTPS Listener
   │
   ├── Public Subnet 1 (AZ-a)
   └── Public Subnet 2 (AZ-b)
         │
         ▼
   NAT Gateway
         │
         ▼
   ┌─────────────────────────────────┐
   │  Private Subnets                │
   │  ┌───────────┐ ┌───────────┐   │
   │  │ ECS Task  │ │ ECS Task  │   │
   │  │ (Fargate) │ │ (Fargate) │   │
   │  └─────┬─────┘ └─────┬─────┘   │
   │        │              │         │
   │        ▼              ▼         │
   │  ┌──────────────────────────┐   │
   │  │  RDS MySQL (Multi-AZ)   │   │
   │  └──────────────────────────┘   │
   └─────────────────────────────────┘
         │
         ▼
   S3 Bucket (Media Storage)
```

---

## Prerequisites

Before deploying, ensure you have the following:

| Requirement | Details |
|---|---|
| **AWS Account** | Active AWS account with billing enabled |
| **AWS CLI** | Version 2.x installed and configured (`aws configure`) |
| **Docker** | Installed locally for building the container image |
| **Domain (optional)** | A domain managed in Route 53 with a Hosted Zone ID |
| **IAM Permissions** | User/role with permissions for CloudFormation, VPC, EC2, ECS, RDS, S3, IAM, ACM, Route 53, CloudWatch, CloudFront, ECR |

---

## Step 1: Build and Push the Docker Image

The project includes a production-optimized `Dockerfile`. Build and push it to Amazon ECR.

```bash
# Set your AWS region and account ID
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/production-clarke-crm"

# Create the ECR repository (if not using CloudFormation first)
aws ecr create-repository --repository-name production-clarke-crm --region ${AWS_REGION}

# Authenticate Docker with ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build the Docker image
docker build -t clarke-crm:latest .

# Tag and push to ECR
docker tag clarke-crm:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

echo "Image URI: ${ECR_REPO}:latest"
```

---

## Step 2: Deploy the CloudFormation Stack

### Option A: AWS Console

1. Open the **AWS CloudFormation** console.
2. Click **Create Stack** → **With new resources (standard)**.
3. Upload the `aws-cloudformation.yaml` template file.
4. Fill in the parameters (see table below).
5. Acknowledge IAM resource creation.
6. Click **Create Stack** and wait 15–25 minutes.

### Option B: AWS CLI

```bash
aws cloudformation create-stack \
  --stack-name clarke-crm-production \
  --template-body file://aws-cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=production \
    ParameterKey=DomainName,ParameterValue=crm.clarkeandassociates.com \
    ParameterKey=HostedZoneId,ParameterValue=Z0123456789ABCDEFGHIJ \
    ParameterKey=DBMasterUsername,ParameterValue=crmadmin \
    ParameterKey=DBMasterPassword,ParameterValue=YourSecurePassword123 \
    ParameterKey=DBInstanceClass,ParameterValue=db.t3.small \
    ParameterKey=ContainerImage,ParameterValue=${ECR_REPO}:latest \
    ParameterKey=ContainerCpu,ParameterValue=512 \
    ParameterKey=ContainerMemory,ParameterValue=1024 \
    ParameterKey=DesiredCount,ParameterValue=2 \
    ParameterKey=JwtSecret,ParameterValue=$(openssl rand -hex 32)

# Monitor stack creation
aws cloudformation wait stack-create-complete --stack-name clarke-crm-production

# Get outputs
aws cloudformation describe-stacks --stack-name clarke-crm-production \
  --query 'Stacks[0].Outputs' --output table
```

---

## Parameter Reference

| Parameter | Required | Default | Description |
|---|---|---|---|
| `EnvironmentName` | Yes | `production` | Environment name (production, staging, development) |
| `DomainName` | No | `crm.clarkeandassociates.com` | Custom domain for the CRM |
| `HostedZoneId` | No | (blank) | Route 53 Hosted Zone ID — leave blank to skip DNS/SSL |
| `DBMasterUsername` | Yes | `crmadmin` | MySQL admin username |
| `DBMasterPassword` | Yes | — | MySQL admin password (min 12 chars, no special chars that break URLs) |
| `DBInstanceClass` | Yes | `db.t3.small` | RDS instance size |
| `DBAllocatedStorage` | Yes | `20` | Database storage in GB |
| `ContainerImage` | No | (blank) | ECR image URI — leave blank to create infra first, deploy app later |
| `ContainerCpu` | Yes | `512` | Fargate CPU units (512 = 0.5 vCPU) |
| `ContainerMemory` | Yes | `1024` | Fargate memory in MB |
| `DesiredCount` | Yes | `2` | Number of running containers |
| `JwtSecret` | Yes | — | Session cookie signing secret (min 32 chars) |
| `ZoomClientId` | No | (blank) | Zoom OAuth Client ID |
| `ZoomClientSecret` | No | (blank) | Zoom OAuth Client Secret |
| `GoogleClientId` | No | (blank) | Google OAuth Client ID |
| `GoogleClientSecret` | No | (blank) | Google OAuth Client Secret |
| `SendGridApiKey` | No | (blank) | SendGrid API key for email |
| `TwilioAccountSid` | No | (blank) | Twilio Account SID for SMS |
| `TwilioAuthToken` | No | (blank) | Twilio Auth Token |
| `TwilioPhoneNumber` | No | (blank) | Twilio phone number |

---

## Step 3: Run Database Migrations

After the stack is created, run the Drizzle migrations against the new RDS instance.

```bash
# Get the RDS endpoint from CloudFormation outputs
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name clarke-crm-production \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text)

# Run migrations locally (ensure you have network access to RDS, e.g., via VPN or bastion)
DATABASE_URL="mysql://crmadmin:YourSecurePassword123@${RDS_ENDPOINT}:3306/clarke_crm" \
  pnpm db:push
```

If your RDS is in a private subnet (recommended), you will need a bastion host or VPN to run migrations. Alternatively, add a migration step to your ECS task definition or CI/CD pipeline.

---

## Step 4: Verify Deployment

```bash
# Get the application URL
APP_URL=$(aws cloudformation describe-stacks \
  --stack-name clarke-crm-production \
  --query 'Stacks[0].Outputs[?OutputKey==`ApplicationURL`].OutputValue' \
  --output text)

echo "Application URL: ${APP_URL}"

# Test the endpoint
curl -I ${APP_URL}

# Check ECS service status
aws ecs describe-services \
  --cluster production-clarke-crm \
  --services production-clarke-crm \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# View application logs
aws logs tail /ecs/production-clarke-crm --follow
```

---

## Step 5: Configure Integrations (Post-Deploy)

After the CRM is running, log in and navigate to **Settings** to configure:

1. **Zoom Integration** — Enter your Zoom Server-to-Server OAuth credentials to enable webinar creation and auto-registration.
2. **Google Calendar** — Enter your Google OAuth credentials to sync webinar events and consultation bookings.
3. **Media Library** — Upload corporate logos and artwork for use on landing pages.

For email delivery, you can either use the `SendGridApiKey` parameter or configure **Amazon SES** directly (the IAM task role already includes SES permissions).

---

## Updating the Application

To deploy a new version of the CRM:

```bash
# Build and push new image
docker build -t clarke-crm:latest .
docker tag clarke-crm:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

# Force new deployment (pulls latest image)
aws ecs update-service \
  --cluster production-clarke-crm \
  --service production-clarke-crm \
  --force-new-deployment

# Monitor rollout
aws ecs wait services-stable \
  --cluster production-clarke-crm \
  --services production-clarke-crm
```

---

## Cost Estimate

| Component | Monthly Cost (US East) |
|---|---|
| ECS Fargate (2 tasks, 0.5 vCPU, 1 GB) | ~$30 |
| RDS MySQL (`db.t3.small`, Single-AZ) | ~$25 |
| RDS MySQL (`db.t3.small`, Multi-AZ) | ~$50 |
| NAT Gateway | ~$32 + data transfer |
| ALB | ~$16 + data transfer |
| S3 (< 5 GB) | < $1 |
| CloudFront (< 50 GB transfer) | < $5 |
| Route 53 | $0.50 |
| CloudWatch Logs (< 5 GB) | < $3 |
| **Total (Single-AZ, starter)** | **~$110/month** |
| **Total (Multi-AZ, production)** | **~$140/month** |

To reduce costs for development or staging environments, set `DesiredCount=1`, use `db.t3.micro`, and leave `HostedZoneId` blank to skip Multi-AZ and SSL.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Stack creation fails at SSL certificate | Ensure `HostedZoneId` is correct and the domain is in Route 53. DNS validation requires the hosted zone to be active. |
| ECS tasks keep restarting | Check CloudWatch logs: `aws logs tail /ecs/production-clarke-crm`. Common causes: missing env vars, database connection failure. |
| Cannot connect to RDS | RDS is in a private subnet. Use a bastion host, VPN, or ECS Exec to access it. Verify the security group allows port 3306 from ECS. |
| Health check failures | Ensure the app starts within 60 seconds. Increase `StartPeriod` in the task definition if needed. |
| Images not loading | Verify the S3 bucket policy allows public read. Check the `MEDIA_BASE_URL` env var matches the bucket URL. |

---

## Cleanup

To delete all resources and stop billing:

```bash
# Empty the S3 bucket first (required before deletion)
aws s3 rm s3://production-clarke-crm-media-${AWS_ACCOUNT_ID} --recursive

# Delete the stack (RDS snapshot will be created automatically)
aws cloudformation delete-stack --stack-name clarke-crm-production
aws cloudformation wait stack-delete-complete --stack-name clarke-crm-production
```

Note: RDS has `DeletionProtection: true` enabled. You must disable it in the console before the stack can be deleted, or a final snapshot will be created automatically.
