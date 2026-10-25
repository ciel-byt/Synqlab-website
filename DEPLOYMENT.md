> **Updated 2026-10-25:** the pipeline now builds and deploys the SynqLab one-container image (`Dockerfile.synqlab`) as ECS service `synqlab`. Sections 1–7 below still describe the one-time AWS setup. **Read section 8 first for SynqLab.**

# Deployment & CI/CD Setup

How this app is deployed to AWS via GitHub Actions, triggered by commit message.

## 1. App structure
- React frontend + FastAPI backend, built into **one Docker image** (`Dockerfile`: builds React, FastAPI serves the static build + `/api` routes).
- Deploy target: **Amazon ECS Express Mode** (simplified ECS — auto-creates load balancer, cluster, service).

## 2. AWS IAM — one-time account setup
```bash
# CLI user (for yourself)
aws configure   # paste Access Key ID / Secret from an IAM user with AdministratorAccess

# ECS task execution role (lets ECS pull image + write logs)
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document '...ecs-tasks.amazonaws.com trust policy...'
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# ECS infrastructure role — MUST be named exactly this (AWS hardcodes the lookup)
aws iam create-role --role-name ecsInfrastructureRoleForExpressServices --assume-role-policy-document '...ecs.amazonaws.com trust policy...'
aws iam attach-role-policy --role-name ecsInfrastructureRoleForExpressServices --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices

# ECS service-linked role (required once per account before first ECS use)
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
```

## 3. GitHub → AWS auth (OIDC, no stored keys)
```bash
# Register GitHub as a trusted identity provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Role GitHub Actions assumes, trusted only for this repo
aws iam create-role --role-name github-actions-deploy --assume-role-policy-document '...trust policy scoped to repo:OWNER/REPO...'
aws iam put-role-policy --role-name github-actions-deploy --policy-name ecs-express-deploy --policy-document '...ecs:Create/Update/Describe + iam:PassRole (scoped to the 2 roles above) + ecr:push...'
```
> Note: GitHub's OIDC token `sub` claim format can include `@<id>` suffixes (e.g. `repo:owner@123/repo@456:*`) depending on repo settings — check actual claims if trust fails (add a debug step that decodes the token).

## 4. ECR (image registry)
```bash
aws ecr create-repository --repository-name todo-app --region us-east-1
```

## 5. GitHub repo secrets
Settings → Secrets and variables → Actions:
- `AWS_ROLE_ARN` → github-actions-deploy role ARN
- `ECS_EXECUTION_ROLE_ARN` → ecsTaskExecutionRole ARN
- `ECS_INFRASTRUCTURE_ROLE_ARN` → ecsInfrastructureRoleForExpressServices ARN

## 6. GitHub Actions workflow (`.github/workflows/deploy.yml`)
- Triggers on every push to `main`.
- `build` job: always runs, just compiles the Docker image.
- `deploy` job: only runs `if: contains(github.event.head_commit.message, 'deploy')` — assumes AWS role via OIDC, pushes image to ECR, calls `aws-actions/amazon-ecs-deploy-express-service` action (creates/updates the ECS service, auto-provisions ALB on first run).
- Key input: `container-port` must match what the app actually listens on (default assumed is 80 — ours is 8000, had to set explicitly).

## Architecture (SynqLab, current)

```
                    git push ("deploy" in commit message)
                                   │
                                   ▼
                       GitHub Actions (OIDC, no keys)
                  build Dockerfile.synqlab ─► push to ECR
                                   │  deploy
                                   ▼
 Visitor ─► www.synqlab.ai ─► CloudFront ─► ECS Express service "synqlab"
 (GoDaddy   (CNAME)          (HTTPS, no      (load balancer + 1 Fargate task)
  DNS)                        caching)                   │
 synqlab.ai ─ forwards ─► www                            │ one container:
                                                         │  /            website (React)
                                                         │  /login /lab  product (React)
                                                         │  /api         FastAPI
                                                         ▼
                              RDS Postgres (private, VPC only) ◄─ Secrets Manager
                              (users, orgs, runs, papers, news)    (db url, jwt, admin)
```

- **Domain:** `www` CNAME → CloudFront (`infra/aws_cloudfront.sh`). CloudFront points at the service's own `sy-….on.aws` address, which does not change between releases, so releases cannot break the domain. Do not edit the Express load balancer rules by hand.
- **Releases:** the commit-message rule above; the task runs `alembic upgrade head` then uvicorn.
- **Known gaps:** uploads live on the container's disk (lost on release; S3 needed); the old `todo-app` service still runs (~$25/mo).

## 7. Custom domain (GoDaddy → ALB) — superseded by CloudFront, kept for reference
```bash
# Cert for the subdomain, DNS-validated
aws acm request-certificate --domain-name www.yourdomain.com --validation-method DNS --region us-east-1
# → add the returned CNAME validation record in GoDaddy DNS, wait for ISSUED

# Attach cert + add routing rule on the ALB Express Mode created
aws elbv2 add-listener-certificates --listener-arn <listener-arn> --certificates CertificateArn=<cert-arn>
aws elbv2 create-rule --listener-arn <listener-arn> --priority 100 \
  --conditions Field=host-header,HostHeaderConfig="{Values=[www.yourdomain.com]}" \
  --actions Type=forward,TargetGroupArn=<current-target-group-arn>
```
In GoDaddy:
- Add CNAME: `www` → the ALB's DNS name (shown via `aws elbv2 describe-load-balancers`)
- Domain → Forwarding: bare domain → `https://www.yourdomain.com` (keeps existing MX/email records untouched)

## Day-to-day usage
- Normal commit/push → builds only, no deploy.
- Commit message containing `deploy` → ships to production automatically.

## Known costs (us-east-1, running 24/7)
- Fargate (0.25 vCPU/0.5GB): ~$9/mo
- Load balancer (fixed): ~$16/mo
- **Total: ~$25/mo** — biggest lever to cut cost is deleting the ECS service when idle, or migrating to Lambda (scales to $0).


## 8. SynqLab: database, secrets and first deploy

The image was built and run locally against an empty database (migrations, admin account, website, sign-in, Aria): all passed. Image size is about 840 MB.

### One-time AWS steps (you run these)
Region `us-east-1`. Use the same VPC the ECS service will run in (the default VPC is fine).

```bash
# 1. Image registry
aws ecr create-repository --repository-name synqlab --region us-east-1

# 2. Security group for the database: allow 5432 only from the ECS service's security group
#    (create both groups in the console, or ask Claude for the exact commands with your VPC id)

# 3. Postgres (smallest size; backups on)
aws rds create-db-instance --db-instance-identifier synqlab-db \
  --engine postgres --db-instance-class db.t4g.micro --allocated-storage 20 \
  --master-username synqlab --master-user-password '<STRONG-PASSWORD>' --db-name synqlab \
  --no-publicly-accessible --backup-retention-period 7 --vpc-security-group-ids <DB-SG-ID> \
  --region us-east-1

# 4. Secrets (print each ARN; they go into GitHub secrets below)
aws secretsmanager create-secret --name synqlab/db-url \
  --secret-string 'postgresql://synqlab:<STRONG-PASSWORD>@<RDS-ENDPOINT>:5432/synqlab'
aws secretsmanager create-secret --name synqlab/jwt-secret --secret-string "$(openssl rand -hex 32)"
aws secretsmanager create-secret --name synqlab/admin-email --secret-string 'sepehr.bayat@synqlab.ai'
aws secretsmanager create-secret --name synqlab/admin-password --secret-string '<ADMIN-PASSWORD>'

# 5. Let the task execution role read those four secrets
aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name synqlab-secrets \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"arn:aws:secretsmanager:us-east-1:<ACCOUNT-ID>:secret:synqlab/*"}]}'

# 6. The GitHub deploy role must also be allowed to push to the new ECR repo (synqlab)
#    and to pass the roles above, as for the todo app.
```

### New GitHub repository secrets
Existing ones stay: `AWS_ROLE_ARN`, `ECS_EXECUTION_ROLE_ARN`, `ECS_INFRASTRUCTURE_ROLE_ARN`. Add the four secret ARNs from step 4:
`SYNQLAB_DB_URL_SECRET_ARN`, `SYNQLAB_JWT_SECRET_ARN`, `SYNQLAB_ADMIN_EMAIL_SECRET_ARN`, `SYNQLAB_ADMIN_PASSWORD_SECRET_ARN`.

News tab: the server refreshes it by itself (boot + every 6 h) when `X_BEARER_TOKEN` is set. Store the token as secret `synqlab/x-bearer-token` and put its ARN in the GitHub secret `SYNQLAB_X_TOKEN_SECRET_ARN` (the deploy fails without it).

### What the workflow does
- Every push to `main` builds `Dockerfile.synqlab` (no deploy).
- A commit message containing `deploy` also pushes the image to ECR repo `synqlab` and creates/updates ECS Express service `synqlab` (1 vCPU, 2 GB, exactly one task, health check `/api/health`).
- The start command runs `alembic upgrade head` and then the server, so the database is migrated on every deploy. One task only, so migrations never run twice at once.
- On first boot the admin account is created from the two admin secrets. Add everyone else at `/admin`.
- Public sign-up is closed (set `SYNQLAB_ALLOW_SIGNUP=1` to open it).
- This is a new service. The old `todo-app` service and its URL are untouched; delete it when you no longer need it.

### Custom domain
Same steps as section 7, pointing at the new `synqlab` service's load balancer.

### Not in the image (on purpose)
No torch/transformers (the app does not need them; this keeps the image small), and no GPU tools. Uploaded Aria tables and avatars are stored on the container disk and are lost on redeploy. Move them to S3 before real customer uploads.

### Cost
Fargate 1 vCPU / 2 GB ~ $36 + load balancer ~ $16 + RDS t4g.micro ~ $13: roughly $65/mo at 24/7, less than that is covered by credits. Cut it by scaling Fargate to 0.5 vCPU / 1 GB if the app stays idle.
