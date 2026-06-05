const {
  ListBucketsCommand, CreateBucketCommand, DeleteBucketCommand,
  ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand,
  GetBucketVersioningCommand, PutBucketVersioningCommand, ListObjectVersionsCommand,
  GetBucketPolicyCommand, PutBucketPolicyCommand, DeleteBucketPolicyCommand,
  GetBucketLifecycleConfigurationCommand, PutBucketLifecycleConfigurationCommand,
  DeleteBucketLifecycleCommand,
  GetPublicAccessBlockCommand, PutPublicAccessBlockCommand,
  GetBucketEncryptionCommand, PutBucketEncryptionCommand,
  GetBucketWebsiteCommand, PutBucketWebsiteCommand, DeleteBucketWebsiteCommand,
  GetBucketTaggingCommand, PutBucketTaggingCommand, DeleteBucketTaggingCommand,
  GetBucketOwnershipControlsCommand, PutBucketOwnershipControlsCommand,
  GetObjectLockConfigurationCommand, PutObjectLockConfigurationCommand,
} = require('@aws-sdk/client-s3')
const { DescribeInstancesCommand } = require('@aws-sdk/client-ec2')
const { ListFunctionsCommand } = require('@aws-sdk/client-lambda')
const { ListUsersCommand } = require('@aws-sdk/client-iam')
const { ListMetricsCommand } = require('@aws-sdk/client-cloudwatch')
const { s3Client, ec2Client, lambdaClient, iamClient, cloudwatchClient, endpoint } = require('../config/awsClients')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

async function health(req, res) {
  try {
    await s3Client.send(new ListBucketsCommand({}))
    res.json({ connected: true, endpoint })
  } catch (err) {
    res.json({ connected: false, error: err.message })
  }
}

async function listBuckets(req, res) {
  try {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
    res.json({ Buckets: Buckets || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createBucket(req, res) {
  const name       = req.body.name       || `demo-bucket-${Date.now()}`
  const region     = req.body.region     || 'us-east-1'
  const objectLock = req.body.objectLock || false
  try {
    const params = { Bucket: name }
    if (region !== 'us-east-1') {
      params.CreateBucketConfiguration = { LocationConstraint: region }
    }
    if (objectLock) params.ObjectLockEnabledForBucket = true
    await s3Client.send(new CreateBucketCommand(params))
    res.json({ message: `Bucket "${name}" created successfully in ${region}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteBucket(req, res) {
  const { name } = req.params
  try {
    /* 1. Delete all current objects in pages of 1000 */
    let token
    do {
      const { Contents, NextContinuationToken } = await s3Client.send(
        new ListObjectsV2Command({ Bucket: name, ContinuationToken: token })
      )
      if (Contents?.length) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: name,
          Delete: { Objects: Contents.map(o => ({ Key: o.Key })), Quiet: true },
        }))
      }
      token = NextContinuationToken
    } while (token)

    /* 2. Delete all versions + delete markers (versioned buckets) */
    let keyMarker, versionIdMarker
    do {
      const { Versions, DeleteMarkers, NextKeyMarker, NextVersionIdMarker, IsTruncated } =
        await s3Client.send(new ListObjectVersionsCommand({
          Bucket: name,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }))
      const toDelete = [
        ...(Versions     || []).map(v => ({ Key: v.Key, VersionId: v.VersionId })),
        ...(DeleteMarkers|| []).map(d => ({ Key: d.Key, VersionId: d.VersionId })),
      ]
      if (toDelete.length) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: name,
          Delete: { Objects: toDelete, Quiet: true },
        }))
      }
      if (!IsTruncated) break
      keyMarker       = NextKeyMarker
      versionIdMarker = NextVersionIdMarker
    } while (keyMarker)

    /* 3. Now the bucket is empty — delete it */
    await s3Client.send(new DeleteBucketCommand({ Bucket: name }))
    res.json({ message: `Bucket "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listObjects(req, res) {
  const { name } = req.params
  try {
    const { Contents } = await s3Client.send(new ListObjectsV2Command({ Bucket: name }))
    res.json({ Contents: Contents || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function putObject(req, res) {
  const { name } = req.params
  const { key, content, contentType } = req.body
  try {
    const body = content ? Buffer.from(content, 'base64') : Buffer.alloc(0)
    await s3Client.send(new PutObjectCommand({
      Bucket: name,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }))
    res.json({ message: `Object "${key}" uploaded` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteObject(req, res) {
  const { name } = req.params
  const key = req.params[0]
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: name, Key: key }))
    res.json({ message: `Object "${key}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getObject(req, res) {
  const { name } = req.params
  const key = req.params[0]
  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: name, Key: key }))
    res.setHeader('Content-Type', result.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getVersioning(req, res) {
  const { name } = req.params
  try {
    const { Status } = await s3Client.send(new GetBucketVersioningCommand({ Bucket: name }))
    res.json({ Status: Status || 'Disabled' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function putVersioning(req, res) {
  const { name } = req.params
  const { status } = req.body
  try {
    await s3Client.send(new PutBucketVersioningCommand({
      Bucket: name,
      VersioningConfiguration: { Status: status },
    }))
    res.json({ message: `Versioning ${status.toLowerCase()}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listVersions(req, res) {
  const { name } = req.params
  try {
    const { Versions, DeleteMarkers } = await s3Client.send(
      new ListObjectVersionsCommand({ Bucket: name })
    )
    res.json({ Versions: Versions || [], DeleteMarkers: DeleteMarkers || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getBucketPolicy(req, res) {
  const { name } = req.params
  try {
    const { Policy } = await s3Client.send(new GetBucketPolicyCommand({ Bucket: name }))
    res.json({ Policy })
  } catch (err) {
    if (err.name === 'NoSuchBucketPolicy' || err.$metadata?.httpStatusCode === 404) {
      return res.json({ Policy: null })
    }
    res.status(500).json({ message: err.message })
  }
}

async function putBucketPolicy(req, res) {
  const { name } = req.params
  const { policy } = req.body
  try {
    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: name,
      Policy: typeof policy === 'string' ? policy : JSON.stringify(policy),
    }))
    res.json({ message: 'Policy saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteBucketPolicy(req, res) {
  const { name } = req.params
  try {
    await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: name }))
    res.json({ message: 'Policy deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getPublicAccess(req, res) {
  const { name } = req.params
  try {
    const { PublicAccessBlockConfiguration: cfg } = await s3Client.send(
      new GetPublicAccessBlockCommand({ Bucket: name })
    )
    res.json({ config: cfg || {} })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.json({ config: {} })
    res.status(500).json({ message: err.message })
  }
}

async function putPublicAccess(req, res) {
  const { name } = req.params
  const { BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy, RestrictPublicBuckets } = req.body
  try {
    await s3Client.send(new PutPublicAccessBlockCommand({
      Bucket: name,
      PublicAccessBlockConfiguration: { BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy, RestrictPublicBuckets },
    }))
    res.json({ message: 'Public access settings saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getEncryption(req, res) {
  const { name } = req.params
  try {
    const { ServerSideEncryptionConfiguration } = await s3Client.send(
      new GetBucketEncryptionCommand({ Bucket: name })
    )
    const rule = ServerSideEncryptionConfiguration?.Rules?.[0] || {}
    res.json({
      algorithm: rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm || 'AES256',
      bucketKeyEnabled: rule.BucketKeyEnabled ?? true,
    })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.json({ algorithm: 'AES256', bucketKeyEnabled: true })
    res.status(500).json({ message: err.message })
  }
}

async function putEncryption(req, res) {
  const { name } = req.params
  const { algorithm, bucketKeyEnabled } = req.body
  try {
    await s3Client.send(new PutBucketEncryptionCommand({
      Bucket: name,
      ServerSideEncryptionConfiguration: {
        Rules: [{
          ApplyServerSideEncryptionByDefault: { SSEAlgorithm: algorithm },
          BucketKeyEnabled: bucketKeyEnabled,
        }],
      },
    }))
    res.json({ message: 'Encryption settings saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getWebsite(req, res) {
  const { name } = req.params
  try {
    const data = await s3Client.send(new GetBucketWebsiteCommand({ Bucket: name }))
    res.json({
      enabled: true,
      indexDocument: data.IndexDocument?.Suffix || 'index.html',
      errorDocument: data.ErrorDocument?.Key || 'error.html',
    })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchWebsiteConfiguration')
      return res.json({ enabled: false, indexDocument: 'index.html', errorDocument: 'error.html' })
    res.status(500).json({ message: err.message })
  }
}

async function putWebsite(req, res) {
  const { name } = req.params
  const { indexDocument, errorDocument } = req.body
  try {
    await s3Client.send(new PutBucketWebsiteCommand({
      Bucket: name,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: indexDocument || 'index.html' },
        ErrorDocument: { Key: errorDocument || 'error.html' },
      },
    }))
    res.json({ message: 'Website hosting enabled' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteWebsite(req, res) {
  const { name } = req.params
  try {
    await s3Client.send(new DeleteBucketWebsiteCommand({ Bucket: name }))
    res.json({ message: 'Website hosting disabled' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getLifecycle(req, res) {
  const { name } = req.params
  try {
    const { Rules } = await s3Client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: name }))
    res.json({ Rules: Rules || [] })
  } catch (err) {
    if (err.name === 'NoSuchLifecycleConfiguration' || err.$metadata?.httpStatusCode === 404) {
      return res.json({ Rules: [] })
    }
    res.status(500).json({ message: err.message })
  }
}

async function putLifecycle(req, res) {
  const { name } = req.params
  const { rules } = req.body
  try {
    await s3Client.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: name,
      LifecycleConfiguration: { Rules: rules },
    }))
    res.json({ message: 'Lifecycle rules saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteLifecycle(req, res) {
  const { name } = req.params
  try {
    await s3Client.send(new DeleteBucketLifecycleCommand({ Bucket: name }))
    res.json({ message: 'Lifecycle rules deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function describeInstances(req, res) {
  try {
    const { Reservations } = await ec2Client.send(new DescribeInstancesCommand({}))
    res.json({ Reservations: Reservations || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listFunctions(req, res) {
  try {
    const { Functions } = await lambdaClient.send(new ListFunctionsCommand({}))
    res.json({ Functions: Functions || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listUsers(req, res) {
  try {
    const { Users } = await iamClient.send(new ListUsersCommand({}))
    res.json({ Users: Users || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listMetrics(req, res) {
  try {
    const { Metrics } = await cloudwatchClient.send(new ListMetricsCommand({}))
    res.json({ Metrics: Metrics || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function cliCommand(req, res) {
  const raw = (req.body.command || '').trim()
  if (!raw) return res.json({ output: '', exitCode: 0 })

  // built-ins handled on frontend; just in case
  if (raw === 'clear') return res.json({ output: '__clear__', exitCode: 0 })

  const args = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []
  if (args[0] !== 'aws') {
    return res.json({ output: `command not found: ${args[0]}`, exitCode: 127 })
  }

  const service    = args[1] || ''
  const subcommand = args[2] || ''

  // parse --flag value pairs
  const flags = {}
  for (let i = 3; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      flags[key] = (next && !next.startsWith('--')) ? (i++, next) : true
    }
  }

  const fmt = (obj) => JSON.stringify(obj, null, 2)

  try {
    let output = ''

    /* ── aws --version ── */
    if (service === '--version') {
      return res.json({ output: 'aws-cli/2.15.0 CloudLabs/1.0 us-east-1', exitCode: 0 })
    }

    /* ══ S3 high-level ══ */
    if (service === 's3') {
      if (subcommand === 'ls') {
        const target = args[3]
        if (!target) {
          const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
          output = (Buckets || []).map(b => {
            const d = new Date(b.CreationDate).toISOString().replace('T', ' ').slice(0, 19)
            return `${d}  ${b.Name}`
          }).join('\n') || '(no buckets)'
        } else {
          const path   = target.replace(/^s3:\/\//, '')
          const slash  = path.indexOf('/')
          const bucket = slash === -1 ? path : path.slice(0, slash)
          const prefix = slash === -1 ? '' : path.slice(slash + 1)
          const { Contents } = await s3Client.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined })
          )
          output = (Contents || []).map(o => {
            const d = new Date(o.LastModified).toISOString().replace('T', ' ').slice(0, 19)
            const size = String(o.Size).padStart(10)
            return `${d} ${size} ${o.Key}`
          }).join('\n') || '(empty)'
        }
      } else if (subcommand === 'mb') {
        const name = (args[3] || '').replace(/^s3:\/\//, '')
        if (!name) return res.json({ output: 'Usage: aws s3 mb s3://<bucket>', exitCode: 1 })
        await s3Client.send(new CreateBucketCommand({ Bucket: name }))
        output = `make_bucket: ${name}`
      } else if (subcommand === 'rb') {
        const name = (args[3] || '').replace(/^s3:\/\//, '')
        if (!name) return res.json({ output: 'Usage: aws s3 rb s3://<bucket>', exitCode: 1 })
        await s3Client.send(new DeleteBucketCommand({ Bucket: name }))
        output = `remove_bucket: ${name}`
      } else if (subcommand === 'rm') {
        const path   = (args[3] || '').replace(/^s3:\/\//, '')
        const slash  = path.indexOf('/')
        const bucket = path.slice(0, slash)
        const key    = path.slice(slash + 1)
        if (!bucket || !key) return res.json({ output: 'Usage: aws s3 rm s3://<bucket>/<key>', exitCode: 1 })
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        output = `delete: s3://${path}`
      } else {
        return res.json({ output: `Unknown s3 command: ${subcommand}\nTry: ls, mb, rb, rm`, exitCode: 1 })
      }
    }

    /* ══ S3API ══ */
    else if (service === 's3api') {
      if (subcommand === 'list-buckets') {
        const { Buckets } = await s3Client.send(new ListBucketsCommand({}))
        output = fmt({ Buckets: Buckets || [] })
      } else if (subcommand === 'create-bucket') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        await s3Client.send(new CreateBucketCommand({ Bucket: b }))
        output = fmt({ Location: `/${b}` })
      } else if (subcommand === 'delete-bucket') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        await s3Client.send(new DeleteBucketCommand({ Bucket: b }))
        output = ''
      } else if (subcommand === 'list-objects-v2') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        const { Contents } = await s3Client.send(new ListObjectsV2Command({ Bucket: b }))
        output = fmt({ Contents: Contents || [] })
      } else if (subcommand === 'put-object') {
        const b   = flags['bucket']
        const key = flags['key']
        if (!b || !key) return res.json({ output: 'Missing --bucket or --key', exitCode: 1 })
        await s3Client.send(new PutObjectCommand({ Bucket: b, Key: key, Body: Buffer.alloc(0) }))
        output = fmt({ ETag: '"d41d8cd98f00b204e9800998ecf8427e"' })
      } else if (subcommand === 'delete-object') {
        const b   = flags['bucket']
        const key = flags['key']
        if (!b || !key) return res.json({ output: 'Missing --bucket or --key', exitCode: 1 })
        await s3Client.send(new DeleteObjectCommand({ Bucket: b, Key: key }))
        output = fmt({ DeleteMarker: false, VersionId: null })
      } else if (subcommand === 'get-bucket-versioning') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        const { Status } = await s3Client.send(new GetBucketVersioningCommand({ Bucket: b }))
        output = fmt({ Status: Status || '' })
      } else if (subcommand === 'put-bucket-versioning') {
        const b    = flags['bucket']
        const cfg  = flags['versioning-configuration'] || ''
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        const status = cfg.includes('Enabled') ? 'Enabled' : 'Suspended'
        await s3Client.send(new PutBucketVersioningCommand({
          Bucket: b, VersioningConfiguration: { Status: status }
        }))
        output = ''
      } else if (subcommand === 'get-bucket-policy') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        try {
          const { Policy } = await s3Client.send(new GetBucketPolicyCommand({ Bucket: b }))
          output = JSON.stringify(JSON.parse(Policy), null, 2)
        } catch (e) {
          output = e.name === 'NoSuchBucketPolicy' ? '(no bucket policy)' : `Error: ${e.message}`
        }
      } else if (subcommand === 'list-object-versions') {
        const b = flags['bucket']
        if (!b) return res.json({ output: 'Missing --bucket', exitCode: 1 })
        const { Versions, DeleteMarkers } = await s3Client.send(new ListObjectVersionsCommand({ Bucket: b }))
        output = fmt({ Versions: Versions || [], DeleteMarkers: DeleteMarkers || [] })
      } else {
        return res.json({ output: `Unknown s3api command: ${subcommand}`, exitCode: 1 })
      }
    }

    /* ══ EC2 ══ */
    else if (service === 'ec2') {
      if (subcommand === 'describe-instances') {
        const { Reservations } = await ec2Client.send(new DescribeInstancesCommand({}))
        output = fmt({ Reservations: Reservations || [] })
      } else {
        return res.json({ output: `Unknown ec2 command: ${subcommand}`, exitCode: 1 })
      }
    }

    /* ══ Lambda ══ */
    else if (service === 'lambda') {
      if (subcommand === 'list-functions') {
        const { Functions } = await lambdaClient.send(new ListFunctionsCommand({}))
        output = fmt({ Functions: Functions || [] })
      } else {
        return res.json({ output: `Unknown lambda command: ${subcommand}`, exitCode: 1 })
      }
    }

    /* ══ IAM ══ */
    else if (service === 'iam') {
      if (subcommand === 'list-users') {
        const { Users } = await iamClient.send(new ListUsersCommand({}))
        output = fmt({ Users: Users || [] })
      } else {
        return res.json({ output: `Unknown iam command: ${subcommand}`, exitCode: 1 })
      }
    }

    /* ══ CloudWatch ══ */
    else if (service === 'cloudwatch') {
      if (subcommand === 'list-metrics') {
        const { Metrics } = await cloudwatchClient.send(new ListMetricsCommand({}))
        output = fmt({ Metrics: Metrics || [] })
      } else {
        return res.json({ output: `Unknown cloudwatch command: ${subcommand}`, exitCode: 1 })
      }
    }

    else {
      return res.json({
        output: `Unknown service: ${service}\nAvailable: s3, s3api, ec2, lambda, iam, cloudwatch`,
        exitCode: 1,
      })
    }

    res.json({ output, exitCode: 0 })
  } catch (err) {
    res.json({ output: `\nAn error occurred:\n    ${err.message}`, exitCode: 255 })
  }
}

/* ── Tags ── */
async function getBucketTags(req, res) {
  const { name } = req.params
  try {
    const { TagSet } = await s3Client.send(new GetBucketTaggingCommand({ Bucket: name }))
    res.json({ TagSet: TagSet || [] })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchTagSet')
      return res.json({ TagSet: [] })
    res.status(500).json({ message: err.message })
  }
}

async function putBucketTags(req, res) {
  const { name } = req.params
  const { tags = [] } = req.body
  try {
    if (tags.length === 0) {
      await s3Client.send(new DeleteBucketTaggingCommand({ Bucket: name }))
    } else {
      await s3Client.send(new PutBucketTaggingCommand({
        Bucket: name,
        Tagging: { TagSet: tags.map(t => ({ Key: t.key || t.Key, Value: t.value || t.Value })) },
      }))
    }
    res.json({ message: 'Tags saved' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Ownership ── */
async function getOwnership(req, res) {
  const { name } = req.params
  try {
    const { OwnershipControls } = await s3Client.send(
      new GetBucketOwnershipControlsCommand({ Bucket: name })
    )
    res.json({ rule: OwnershipControls?.Rules?.[0]?.ObjectOwnership || 'BucketOwnerEnforced' })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) return res.json({ rule: 'BucketOwnerEnforced' })
    res.status(500).json({ message: err.message })
  }
}

async function putOwnership(req, res) {
  const { name } = req.params
  const { rule } = req.body
  try {
    await s3Client.send(new PutBucketOwnershipControlsCommand({
      Bucket: name,
      OwnershipControls: { Rules: [{ ObjectOwnership: rule }] },
    }))
    res.json({ message: 'Ownership updated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Object Lock ── */
async function viewObject(req, res) {
  const { name } = req.params
  const key = req.params[0]
  try {
    /* check Block Public Access — enforce what LocalStack ignores */
    try {
      const { PublicAccessBlockConfiguration: cfg } = await s3Client.send(
        new GetPublicAccessBlockCommand({ Bucket: name })
      )
      const blocked = cfg && (
        cfg.BlockPublicAcls || cfg.IgnorePublicAcls ||
        cfg.BlockPublicPolicy || cfg.RestrictPublicBuckets
      )
      if (blocked) {
        return res.status(403).send(
          '403 Access Denied\n\nBlock Public Access is enabled on this bucket.\n' +
          'Disable it in the Permissions tab to allow public viewing.'
        )
      }
    } catch { /* no block config = allowed */ }

    /* stream the object inline (not as attachment) */
    const result = await s3Client.send(new GetObjectCommand({ Bucket: name, Key: key }))
    res.setHeader('Content-Type', result.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', 'inline')
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`)
  }
}

async function getPresignedUrl(req, res) {
  const { name } = req.params
  const key = req.params[0]
  const expiresIn = Number(req.query.expires) || 300
  try {
    const command = new GetObjectCommand({ Bucket: name, Key: key })
    const url = await getSignedUrl(s3Client, command, { expiresIn })
    res.json({ url, expiresIn, key, bucket: name })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getObjectLock(req, res) {
  const { name } = req.params
  try {
    const { ObjectLockConfiguration } = await s3Client.send(
      new GetObjectLockConfigurationCommand({ Bucket: name })
    )
    res.json({ config: ObjectLockConfiguration || { ObjectLockEnabled: 'Disabled' } })
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'ObjectLockConfigurationNotFoundError')
      return res.json({ config: { ObjectLockEnabled: 'Disabled' } })
    res.status(500).json({ message: err.message })
  }
}

async function putObjectLock(req, res) {
  const { name } = req.params
  const { mode, days, years } = req.body
  try {
    const config = { ObjectLockEnabled: 'Enabled' }
    if (mode) {
      config.Rule = { DefaultRetention: { Mode: mode } }
      if (days)  config.Rule.DefaultRetention.Days  = Number(days)
      if (years) config.Rule.DefaultRetention.Years = Number(years)
    }
    await s3Client.send(new PutObjectLockConfigurationCommand({
      Bucket: name,
      ObjectLockConfiguration: config,
    }))
    res.json({ message: 'Object Lock configured' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  health, listBuckets, createBucket, deleteBucket,
  listObjects, putObject, deleteObject, getObject,
  getVersioning, putVersioning, listVersions,
  getBucketPolicy, putBucketPolicy, deleteBucketPolicy,
  getLifecycle, putLifecycle, deleteLifecycle,
  getPublicAccess, putPublicAccess,
  getEncryption, putEncryption,
  getWebsite, putWebsite, deleteWebsite,
  viewObject,
  getPresignedUrl,
  getBucketTags, putBucketTags,
  getOwnership, putOwnership,
  getObjectLock, putObjectLock,
  describeInstances, listFunctions, listUsers, listMetrics,
  cliCommand,
}
