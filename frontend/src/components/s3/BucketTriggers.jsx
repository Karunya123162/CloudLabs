import styles from './BucketTriggers.module.css';

const TRIGGERS = [
  {
    id: 'sdk',
    icon: 'SDK',
    color: '#f0883e',
    bg: '#2d1e0f',
    title: 'SDK / Direct API',
    subtitle: 'Programmatic access via AWS SDKs or raw HTTP',
    desc: 'Any AWS SDK or raw HTTP client can create a bucket by issuing a signed PUT request. The SDK handles credential signing automatically.',
    examples: [
      {
        lang: 'Python (Boto3)',
        code: `import boto3
s3 = boto3.client('s3', region_name='us-east-1')
s3.create_bucket(Bucket='my-new-bucket')`,
      },
      {
        lang: 'JavaScript (AWS SDK v3)',
        code: `import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "us-east-1" });
await client.send(new CreateBucketCommand({ Bucket: "my-new-bucket" }));`,
      },
      {
        lang: 'Raw HTTP',
        code: `PUT /my-new-bucket HTTP/1.1
Host: s3.amazonaws.com
Authorization: AWS4-HMAC-SHA256 Credential=...
x-amz-date: 20240101T000000Z`,
      },
    ],
  },
  {
    id: 'console',
    icon: 'WEB',
    color: '#3fb950',
    bg: '#0d2e1a',
    title: 'AWS Console',
    subtitle: 'Browser-based bucket creation via the AWS Management Console',
    desc: 'The AWS Management Console provides a guided wizard. Behind the scenes the browser sends a signed PUT request to the S3 endpoint on your behalf.',
    examples: [
      {
        lang: 'Browser flow',
        code: `1. Navigate to https://s3.console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Enter bucket name and select region
4. Configure options (versioning, encryption, ACL)
5. Click "Create bucket"
   -> Console calls PUT /<bucket-name> via internal API`,
      },
    ],
  },
  {
    id: 'iac',
    icon: 'IaC',
    color: '#79c0ff',
    bg: '#0d1f2d',
    title: 'IaC',
    subtitle: 'Infrastructure as Code tools (Terraform, CloudFormation, CDK)',
    desc: 'Infrastructure-as-Code tools declare the desired state. During apply/deploy they call the S3 API to reconcile, issuing a PUT to create the bucket.',
    examples: [
      {
        lang: 'Terraform',
        code: `resource "aws_s3_bucket" "example" {
  bucket = "my-new-bucket"
  tags = {
    Environment = "production"
  }
}`,
      },
      {
        lang: 'CloudFormation',
        code: `Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-new-bucket
      VersioningConfiguration:
        Status: Enabled`,
      },
      {
        lang: 'AWS CDK (TypeScript)',
        code: `import * as s3 from 'aws-cdk-lib/aws-s3';
const bucket = new s3.Bucket(this, 'MyBucket', {
  bucketName: 'my-new-bucket',
  versioned: true,
});`,
      },
    ],
  },
  {
    id: 'cli',
    icon: 'CLI',
    color: '#4ade80',
    bg: '#0d2e1a',
    title: 'AWS CLI',
    subtitle: 'Command-line interface using s3api or s3 high-level commands',
    desc: 'The AWS CLI wraps the SDK. Both the high-level s3 command and the low-level s3api command ultimately issue the same signed PUT request.',
    examples: [
      {
        lang: 's3api (low-level)',
        code: `# Low-level command maps 1:1 to the API
aws s3api create-bucket \\
  --bucket my-new-bucket \\
  --region us-east-1`,
      },
      {
        lang: 's3 mb (high-level)',
        code: `# High-level convenience command
aws s3 mb s3://my-new-bucket --region us-east-1`,
      },
    ],
  },
  {
    id: 'lambda',
    icon: 'LMB',
    color: '#d2a8ff',
    bg: '#1e1030',
    title: 'Event-driven / Lambda',
    subtitle: 'Automated creation via Lambda, GitHub Actions, or EventBridge',
    desc: 'Serverless functions and CI/CD pipelines can create buckets in response to events. The function or runner calls the SDK or CLI internally.',
    examples: [
      {
        lang: 'AWS Lambda (Python)',
        code: `import boto3
def handler(event, context):
    s3 = boto3.client('s3')
    bucket_name = event['bucket_name']
    s3.create_bucket(Bucket=bucket_name)
    return {"status": "created", "bucket": bucket_name}`,
      },
      {
        lang: 'GitHub Actions',
        code: `- name: Create S3 Bucket
  env:
    AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: |
    aws s3 mb s3://my-new-bucket --region us-east-1`,
      },
      {
        lang: 'EventBridge + Lambda',
        code: `# EventBridge rule triggers Lambda on schedule or event
# Lambda function then calls s3.create_bucket()
# e.g., auto-provision buckets for new tenants`,
      },
    ],
  },
  {
    id: 'third-party',
    icon: '3RD',
    color: '#ffa657',
    bg: '#2d1e0f',
    title: 'Third-party tools',
    subtitle: 'Pulumi, Ansible, Serverless Framework, and other toolchains',
    desc: 'Third-party tools integrate with AWS APIs using their own SDKs or by calling the AWS CLI. They all converge on the same signed PUT to create a bucket.',
    examples: [
      {
        lang: 'Pulumi (TypeScript)',
        code: `import * as aws from "@pulumi/aws";
const bucket = new aws.s3.Bucket("my-new-bucket", {
  bucket: "my-new-bucket",
  tags: { Environment: "production" },
});`,
      },
      {
        lang: 'Ansible',
        code: `- name: Create S3 bucket
  amazon.aws.s3_bucket:
    name: my-new-bucket
    state: present
    region: us-east-1`,
      },
      {
        lang: 'Serverless Framework',
        code: `# serverless.yml
resources:
  Resources:
    MyBucket:
      Type: AWS::S3::Bucket
      Properties:
        BucketName: my-new-bucket`,
      },
    ],
  },
];

const FLOW_STEPS = [
  { label: 'Trigger', sub: 'SDK / CLI / Console / IaC' },
  { label: 'Sign request', sub: 'SigV4' },
  { label: 'PUT /<bucket>', sub: 'HTTPS to S3 endpoint' },
  { label: 'Validate', sub: 'Name, region, permissions' },
  { label: 'Bucket created', sub: 'HTTP 200 OK' },
];

export default function BucketTriggers() {
  return (
    <div className={styles.wrapper}>
      {/* Top flow banner */}
      <div className={styles.banner}>
        <div className={styles.bannerInner}>
          {FLOW_STEPS.map((step, idx) => (
            <div key={step.label} className={styles.bannerItem}>
              <div className={styles.stepBox}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepSub}>{step.sub}</span>
              </div>
              {idx < FLOW_STEPS.length - 1 && (
                <span className={styles.arrow}>&#8594;</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trigger cards grid */}
      <div className={styles.grid}>
        {TRIGGERS.map((trigger) => (
          <div key={trigger.id} className={styles.card}>
            {/* Icon box + header */}
            <div className={styles.cardHeader}>
              <div
                className={styles.iconBox}
                style={{ backgroundColor: trigger.bg, color: trigger.color }}
              >
                {trigger.icon}
              </div>
              <div className={styles.cardTitles}>
                <span className={styles.cardTitle} style={{ color: trigger.color }}>
                  {trigger.title}
                </span>
                <span className={styles.cardSubtitle}>{trigger.subtitle}</span>
              </div>
            </div>

            {/* Description */}
            <p className={styles.cardDesc}>{trigger.desc}</p>

            {/* Code examples */}
            <div className={styles.examples}>
              {trigger.examples.map((ex) => (
                <div key={ex.lang} className={styles.exampleBlock}>
                  <div className={styles.exampleHeader}>
                    <span className={styles.langLabel}>{ex.lang}</span>
                  </div>
                  <pre className={styles.code}>
                    <code>{ex.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom info box */}
      <div className={styles.infoBox}>
        <span className={styles.infoIcon}>&#9432;</span>
        <span className={styles.infoText}>
          In every case the root action is identical &mdash; a signed HTTP{' '}
          <code className={styles.infoCode}>PUT /&lt;bucket-name&gt;</code> to the S3 endpoint.
        </span>
      </div>
    </div>
  );
}
