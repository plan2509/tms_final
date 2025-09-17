# AWS Scheduled Dispatch (EventBridge + Lambda)

This template triggers your Next API endpoint `/api/dispatch-notifications` on a schedule.

## Files
- `aws-cron-template.tf`: Terraform to provision EventBridge rule and a small Lambda that POSTs to your endpoint.

## Variables
- `region`: AWS region (default `ap-northeast-2`)
- `target_url`: e.g. `https://tms.watercharging.com/api/dispatch-notifications`
- `cron_secret`: same as Vercel `CRON_SECRET`. Sent via header `x-cron-key`.

## Usage
```
# In the infra directory
cd infra
# Set variables
export TF_VAR_region=ap-northeast-2
export TF_VAR_target_url=https://tms.watercharging.com/api/dispatch-notifications
export TF_VAR_cron_secret=YOUR_CRON_SECRET
# Init & apply
terraform init
terraform apply
```

## Notes
- The API checks header `x-cron-key` (or query `?key=`) when `CRON_SECRET` is configured.
- No Supabase keys required in AWS. The API runs with service role on server.
- Adjust `schedule_expression` in the Terraform file to your timezone needs.
