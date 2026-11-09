# Read-only MySQL access via Lambda Function URL

Replaces the IP-locked direct connection to the Carolina Elections MySQL cluster
with a Lambda Function URL that any authorized host can reach. The MySQL cluster
stays in its VPC; only the Lambda can talk to it. Credentials are encrypted
Lambda environment variables (AWS encrypts them at rest), so no Secrets Manager
or VPC endpoint is needed.

## What this is (and isn't)

- **Read-only.** The Lambda exposes a small allowlist of named queries. There is
  no arbitrary SQL path.
- **Skeleton.** The IT team owns the AWS account, VPC, and RDS security group;
  this template is a starting point to adapt (naming, VPC, tags, etc.).
- **No ingestion pipeline.** This only changes how the existing human-run
  ballot loader reaches the source database. It does not automate anything new.
- **Generic.** Not tied to any frontend; any downstream consumer can use it.

## Cost

At under ~1,000 requests/day this fits in Lambda's free tier: ~$0/month.
Reserved concurrency (default 5) protects the database and caps spend if the URL
is hammered. Requests without the key are rejected before any DB work happens.

## Deploy (IT team)

Prerequisites: AWS SAM CLI and permissions for CloudFormation + Lambda + VPC.

1. Deploy:

   ```sh
   cd infra
   sam build
   sam deploy --guided \
     --parameter-overrides \
       VpcId=vpc-... \
       SubnetIds=subnet-a,subnet-b \
       RdsSecurityGroupId=sg-... \
       DbPassword='<select-only user password>'
   ```

   The guided deploy prints the `FunctionUrl` output. That URL plus an API key
   is what the client needs.

   Optional: set `API_KEY` as a Lambda environment variable for the x-api-key
   check (recommended in prod).

2. Create the SELECT-only DB user (if not already done). The cluster's "-ro"
   endpoint actually points at the writable primary, so the app must not use a
   privileged login. Grant:

   ```sql
   CREATE USER 'carolina_ro'@'%' IDENTIFIED BY '<password>';
   GRANT SELECT ON carolinaelections.* TO 'carolina_ro'@'%';
   FLUSH PRIVILEGES;
   ```

## Client usage

Set these env vars where the loader runs:

```sh
export MYSQL_API_URL="https://<id>.lambda-url.us-east-1.on.aws/"
export MYSQL_API_KEY="<key>"
```

Then run the loader with `USE_REMOTE_MYSQL=1` (or keep the local `mysql` client
default on machines that still have direct RDS access).

## Files

- `template.yaml` — SAM/CloudFormation: Lambda + Function URL + VPC wiring + SG rules + reserved concurrency.
- `lambda/index.mjs` — Lambda handler with the allowlisted query dispatcher.
- `lambda/package.json` — Lambda dependency (`mysql2`).
- `../backend/scripts/lib/mysql-remote.mjs` — client-side adapter used by the loader.
