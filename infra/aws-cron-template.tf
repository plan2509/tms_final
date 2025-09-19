# Terraform template to call Next API /api/dispatch-notifications via EventBridge + Lambda

variable "region" { default = "ap-northeast-2" }
variable "cron_secret" { default = "" }
variable "target_url" {} # e.g. https://your-domain.vercel.app/api/dispatch-notifications

provider "aws" {
  region = var.region
}

resource "aws_iam_role" "lambda_exec" {
  name = "dispatch_notifications_lambda_exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "lambda.zip"
  source {
    content  = <<EOF
      const https = require('https');
      exports.handler = async () => {
        const url = process.env.TARGET_URL;
        const key = process.env.CRON_SECRET;
        await new Promise((resolve, reject) => {
          const req = https.request(url, { method: 'POST', headers: { 'x-cron-key': key } }, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
          });
          req.on('error', reject);
          req.end();
        });
        return { statusCode: 200 };
      };
    EOF
    filename = "index.js"
  }
}

resource "aws_lambda_function" "dispatch" {
  function_name = "dispatch_notifications"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.lambda_zip.output_path
  environment {
    variables = {
      TARGET_URL  = var.target_url
      CRON_SECRET = var.cron_secret
    }
  }
}

resource "aws_cloudwatch_event_rule" "daily" {
  name                = "dispatch_notifications_daily"
  schedule_expression = "cron(0 2 * * ? *)" # UTC 02:00 (KST 11:00)
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.daily.name
  target_id = "dispatch_lambda"
  arn       = aws_lambda_function.dispatch.arn
}

resource "aws_lambda_permission" "allow_events" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dispatch.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily.arn
}

