const { S3Client } = require('@aws-sdk/client-s3')
const { EC2Client } = require('@aws-sdk/client-ec2')
const { LambdaClient } = require('@aws-sdk/client-lambda')
const { IAMClient } = require('@aws-sdk/client-iam')
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch')

const endpoint = process.env.LOCALSTACK_URL || 'http://localhost:4566'
const region = 'us-east-1'
const credentials = { accessKeyId: 'test', secretAccessKey: 'test' }
const base = { endpoint, region, credentials }

const s3Client          = new S3Client({ ...base, forcePathStyle: true })
const ec2Client         = new EC2Client(base)
const lambdaClient      = new LambdaClient(base)
const iamClient         = new IAMClient(base)
const cloudwatchClient  = new CloudWatchClient(base)

module.exports = { s3Client, ec2Client, lambdaClient, iamClient, cloudwatchClient, endpoint }
