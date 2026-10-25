#!/usr/bin/env bash
# One-time AWS setup for SynqLab (ECR repo, database, secrets, permissions, GitHub secrets).
# Safe to run again: anything that already exists is reused, nothing is deleted.
# Run from anywhere:  ./infra/aws_setup.sh
set -euo pipefail

export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
GH_REPO="${GH_REPO:-ciel-byt/Synqlab-website}"
ADMIN_EMAIL="${ADMIN_EMAIL:-sepehr.bayat@synqlab.ai}"
DB_ID=synqlab-db

say() { printf '\n== %s\n' "$*"; }

secret_exists() { aws secretsmanager describe-secret --secret-id "$1" >/dev/null 2>&1; }
secret_arn()    { aws secretsmanager describe-secret --secret-id "$1" --query ARN --output text; }
# upsert_secret NAME VALUE
upsert_secret() {
  if secret_exists "$1"; then
    aws secretsmanager put-secret-value --secret-id "$1" --secret-string "$2" >/dev/null
  else
    aws secretsmanager create-secret --name "$1" --secret-string "$2" >/dev/null
  fi
}

say "Account and network"
ACCT=$(aws sts get-caller-identity --query Account --output text)
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
VPC_CIDR=$(aws ec2 describe-vpcs --vpc-ids "$VPC" --query 'Vpcs[0].CidrBlock' --output text)
echo "account $ACCT, vpc $VPC ($VPC_CIDR), region $AWS_REGION"

say "Image registry (ECR)"
if aws ecr describe-repositories --repository-names synqlab >/dev/null 2>&1; then
  echo "repository synqlab already exists"
else
  aws ecr create-repository --repository-name synqlab >/dev/null && echo "created repository synqlab"
fi

say "Database firewall (only the VPC can reach Postgres)"
DB_SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=synqlab-db Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text)
if [ "$DB_SG" = "None" ]; then
  DB_SG=$(aws ec2 create-security-group --group-name synqlab-db --description "SynqLab Postgres" \
    --vpc-id "$VPC" --query GroupId --output text)
  echo "created security group $DB_SG"
else
  echo "security group $DB_SG already exists"
fi
aws ec2 authorize-security-group-ingress --group-id "$DB_SG" --protocol tcp --port 5432 --cidr "$VPC_CIDR" \
  >/dev/null 2>&1 && echo "opened port 5432 to $VPC_CIDR" || echo "port 5432 rule already in place"

say "Database (RDS Postgres)"
NEW_PW=""
if aws rds describe-db-instances --db-instance-identifier "$DB_ID" >/dev/null 2>&1; then
  echo "database $DB_ID already exists"
  if ! secret_exists synqlab/db-url; then
    # The earlier password was never saved anywhere, so set a fresh one and store it.
    NEW_PW=$(openssl rand -hex 16)
    aws rds wait db-instance-available --db-instance-identifier "$DB_ID"
    aws rds modify-db-instance --db-instance-identifier "$DB_ID" --master-user-password "$NEW_PW" \
      --apply-immediately >/dev/null
    echo "set a new master password (will be saved to Secrets Manager)"
  fi
else
  NEW_PW=$(openssl rand -hex 16)
  aws rds create-db-instance --db-instance-identifier "$DB_ID" \
    --engine postgres --db-instance-class db.t4g.micro --allocated-storage 20 \
    --master-username synqlab --master-user-password "$NEW_PW" --db-name synqlab \
    --no-publicly-accessible --backup-retention-period 7 --vpc-security-group-ids "$DB_SG" >/dev/null
  echo "creating database"
fi
echo "waiting for the database to be ready (about 5-10 minutes the first time)..."
sleep 20
aws rds wait db-instance-available --db-instance-identifier "$DB_ID"
DB_HOST=$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" \
  --query 'DBInstances[0].Endpoint.Address' --output text)
echo "database ready at $DB_HOST"

say "Secrets (Secrets Manager)"
if [ -n "$NEW_PW" ]; then
  upsert_secret synqlab/db-url "postgresql://synqlab:${NEW_PW}@${DB_HOST}:5432/synqlab"
  echo "saved synqlab/db-url"
else
  echo "kept existing synqlab/db-url"
fi
if secret_exists synqlab/jwt-secret; then
  echo "kept existing synqlab/jwt-secret"
else
  upsert_secret synqlab/jwt-secret "$(openssl rand -hex 32)"; echo "saved synqlab/jwt-secret"
fi
upsert_secret synqlab/admin-email "$ADMIN_EMAIL"; echo "saved synqlab/admin-email ($ADMIN_EMAIL)"
if secret_exists synqlab/admin-password; then
  echo "kept existing synqlab/admin-password (delete that secret in the console to change it)"
else
  read -r -s -p "Admin password for $ADMIN_EMAIL: " ADMIN_PW; echo
  [ -n "$ADMIN_PW" ] || { echo "empty password, stopping"; exit 1; }
  upsert_secret synqlab/admin-password "$ADMIN_PW"; unset ADMIN_PW
  echo "saved synqlab/admin-password"
fi
unset NEW_PW

say "Permissions"
aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name synqlab-secrets \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"arn:aws:secretsmanager:${AWS_REGION}:${ACCT}:secret:synqlab/*\"}]}"
echo "task execution role can read synqlab/* secrets"
if aws iam get-role --role-name github-actions-deploy >/dev/null 2>&1; then
  aws iam put-role-policy --role-name github-actions-deploy --policy-name synqlab-ecr \
    --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"ecr:BatchCheckLayerAvailability\",\"ecr:InitiateLayerUpload\",\"ecr:UploadLayerPart\",\"ecr:CompleteLayerUpload\",\"ecr:PutImage\",\"ecr:BatchGetImage\",\"ecr:GetDownloadUrlForLayer\"],\"Resource\":\"arn:aws:ecr:${AWS_REGION}:${ACCT}:repository/synqlab\"}]}"
  echo "GitHub role can push to the synqlab registry"
else
  echo "!! role github-actions-deploy not found. Find yours with: aws iam list-roles --query 'Roles[].RoleName'"
fi

say "GitHub secrets"
ARN_DB=$(secret_arn synqlab/db-url);          ARN_JWT=$(secret_arn synqlab/jwt-secret)
ARN_EMAIL=$(secret_arn synqlab/admin-email);  ARN_PW=$(secret_arn synqlab/admin-password)
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  printf '%s' "$ARN_DB"    | gh secret set SYNQLAB_DB_URL_SECRET_ARN         --repo "$GH_REPO"
  printf '%s' "$ARN_JWT"   | gh secret set SYNQLAB_JWT_SECRET_ARN            --repo "$GH_REPO"
  printf '%s' "$ARN_EMAIL" | gh secret set SYNQLAB_ADMIN_EMAIL_SECRET_ARN    --repo "$GH_REPO"
  printf '%s' "$ARN_PW"    | gh secret set SYNQLAB_ADMIN_PASSWORD_SECRET_ARN --repo "$GH_REPO"
  echo "set 4 secrets on $GH_REPO"
else
  echo "gh CLI not available or not logged in. Add these 4 repository secrets by hand (Settings > Secrets > Actions):"
  echo "  SYNQLAB_DB_URL_SECRET_ARN         = $ARN_DB"
  echo "  SYNQLAB_JWT_SECRET_ARN            = $ARN_JWT"
  echo "  SYNQLAB_ADMIN_EMAIL_SECRET_ARN    = $ARN_EMAIL"
  echo "  SYNQLAB_ADMIN_PASSWORD_SECRET_ARN = $ARN_PW"
fi

say "Done"
echo "Next: git push (builds only), then:  git commit --allow-empty -m 'deploy: first SynqLab release' && git push"
