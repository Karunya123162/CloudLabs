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
  GetBucketNotificationConfigurationCommand, PutBucketNotificationConfigurationCommand,
} = require('@aws-sdk/client-s3')
const {
  DescribeInstancesCommand, DescribeInstanceStatusCommand,
  RunInstancesCommand,
  StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand, TerminateInstancesCommand,
  DescribeKeyPairsCommand, CreateKeyPairCommand, DeleteKeyPairCommand,
  DescribeSecurityGroupsCommand, CreateSecurityGroupCommand, DeleteSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand,
  DescribeAddressesCommand, AllocateAddressCommand, AssociateAddressCommand, DisassociateAddressCommand, ReleaseAddressCommand,
  DescribeVpcsCommand, CreateVpcCommand,
  DescribeSubnetsCommand,
  DescribeImagesCommand,
  DescribeVolumesCommand, CreateVolumeCommand, AttachVolumeCommand, DetachVolumeCommand, DeleteVolumeCommand,
} = require('@aws-sdk/client-ec2')
const {
  ListFunctionsCommand, GetFunctionCommand, DeleteFunctionCommand, InvokeCommand,
  CreateFunctionCommand, UpdateFunctionCodeCommand,
  ListEventSourceMappingsCommand, CreateEventSourceMappingCommand, DeleteEventSourceMappingCommand,
} = require('@aws-sdk/client-lambda')

/* ── ZIP helper for inline Lambda code ── */
const zlib = require('zlib')
function _crc32Table() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
}
const CRC_TABLE = _crc32Table()
function _crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}
function buildZip(filename, content) {
  const fn  = Buffer.from(filename)
  const raw = Buffer.from(content, 'utf-8')
  const cmp = zlib.deflateRawSync(raw)
  const crc = _crc32(raw)
  const lh  = Buffer.alloc(30 + fn.length)
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6)
  lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12)
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(cmp.length, 18); lh.writeUInt32LE(raw.length, 22)
  lh.writeUInt16LE(fn.length, 26); lh.writeUInt16LE(0, 28); fn.copy(lh, 30)
  const localSize = lh.length + cmp.length
  const cd = Buffer.alloc(46 + fn.length)
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6)
  cd.writeUInt16LE(0, 8); cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14)
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(cmp.length, 20); cd.writeUInt32LE(raw.length, 24)
  cd.writeUInt16LE(fn.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32)
  cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(0, 42)
  fn.copy(cd, 46)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(localSize, 16); eocd.writeUInt16LE(0, 20)
  return Buffer.concat([lh, cmp, cd, eocd])
}
const RUNTIME_DEFAULTS = {
  'nodejs18.x':   { file: 'index.js',             handler: 'index.handler',                   code: "exports.handler = async (event) => ({\n  statusCode: 200,\n  body: JSON.stringify('Hello from Lambda!'),\n});\n" },
  'nodejs16.x':   { file: 'index.js',             handler: 'index.handler',                   code: "exports.handler = async (event) => ({\n  statusCode: 200,\n  body: JSON.stringify('Hello from Lambda!'),\n});\n" },
  'python3.11':   { file: 'lambda_function.py',   handler: 'lambda_function.lambda_handler',  code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
  'python3.9':    { file: 'lambda_function.py',   handler: 'lambda_function.lambda_handler',  code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
  'python3.8':    { file: 'lambda_function.py',   handler: 'lambda_function.lambda_handler',  code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
}
const {
  ListUsersCommand, CreateUserCommand, DeleteUserCommand,
  ListGroupsCommand, CreateGroupCommand, DeleteGroupCommand, AddUserToGroupCommand, RemoveUserFromGroupCommand,
  ListRolesCommand, CreateRoleCommand, DeleteRoleCommand,
  ListPoliciesCommand, AttachUserPolicyCommand, DetachUserPolicyCommand, ListAttachedUserPoliciesCommand,
} = require('@aws-sdk/client-iam')
const {
  ListMetricsCommand,
  DescribeAlarmsCommand, PutMetricAlarmCommand, DeleteAlarmsCommand,
  EnableAlarmActionsCommand, DisableAlarmActionsCommand,
} = require('@aws-sdk/client-cloudwatch')
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

async function runInstances(req, res) {
  const {
    imageId, instanceType = 't2.micro', minCount = 1, maxCount = 1,
    keyName, userData,
    subnetId, securityGroupIds, associatePublicIpAddress,
    name, tags,
  } = req.body
  if (!imageId) return res.status(400).json({ message: 'Missing imageId' })
  try {
    const params = {
      ImageId: imageId,
      InstanceType: instanceType,
      MinCount: Number(minCount),
      MaxCount: Number(maxCount),
    }
    if (keyName) params.KeyName = keyName
    if (userData) params.UserData = Buffer.from(userData).toString('base64')
    if (subnetId) params.SubnetId = subnetId
    if (securityGroupIds?.length) params.SecurityGroupIds = securityGroupIds
    if (subnetId && associatePublicIpAddress !== undefined) {
      params.AssociatePublicIpAddress = Boolean(associatePublicIpAddress)
    }
    const tagList = []
    if (name) tagList.push({ Key: 'Name', Value: name })
    if (Array.isArray(tags)) {
      for (const t of tags) {
        if (t.key && t.value) tagList.push({ Key: t.key, Value: t.value })
      }
    }
    if (tagList.length) {
      params.TagSpecifications = [{ ResourceType: 'instance', Tags: tagList }]
    }
    const { Instances } = await ec2Client.send(new RunInstancesCommand(params))
    res.json({ Instances: Instances || [], message: `${Instances?.length || 0} instance(s) launched` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

function isDeserializationError(err) {
  const m = err.message || ''
  return m.includes('Deserialization') || m.includes("char '{'") || m.includes('is not expected')
}

async function describeInstances(req, res) {
  try {
    const { Reservations } = await ec2Client.send(new DescribeInstancesCommand({}))
    res.json({ Reservations: Reservations || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Reservations: [] })
    res.status(500).json({ message: err.message })
  }
}

function parseInstanceIds(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean)
  }

  return String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function startInstances(req, res) {
  const instanceIds = parseInstanceIds(req.body.instanceId || req.body.instanceIds)
  if (!instanceIds.length) return res.status(400).json({ message: 'Missing instanceId' })
  try {
    const { StartingInstances } = await ec2Client.send(
      new StartInstancesCommand({ InstanceIds: instanceIds })
    )
    res.json({ StartingInstances: StartingInstances || [], message: 'Instance start requested' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function stopInstances(req, res) {
  const instanceIds = parseInstanceIds(req.body.instanceId || req.body.instanceIds)
  if (!instanceIds.length) return res.status(400).json({ message: 'Missing instanceId' })
  try {
    const { StoppingInstances } = await ec2Client.send(
      new StopInstancesCommand({ InstanceIds: instanceIds })
    )
    res.json({ StoppingInstances: StoppingInstances || [], message: 'Instance stop requested' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function hibernateInstances(req, res) {
  const instanceIds = parseInstanceIds(req.body.instanceId || req.body.instanceIds)
  if (!instanceIds.length) return res.status(400).json({ message: 'Missing instanceId' })
  try {
    const { StoppingInstances } = await ec2Client.send(
      new StopInstancesCommand({ InstanceIds: instanceIds, Hibernate: true })
    )
    res.json({ StoppingInstances: StoppingInstances || [], message: 'Instance hibernate requested' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function rebootInstances(req, res) {
  const instanceIds = parseInstanceIds(req.body.instanceId || req.body.instanceIds)
  if (!instanceIds.length) return res.status(400).json({ message: 'Missing instanceId' })
  try {
    await ec2Client.send(new RebootInstancesCommand({ InstanceIds: instanceIds }))
    res.json({ message: 'Instance reboot requested', InstanceIds: instanceIds })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function terminateInstances(req, res) {
  const instanceIds = parseInstanceIds(req.body.instanceId || req.body.instanceIds)
  if (!instanceIds.length) return res.status(400).json({ message: 'Missing instanceId' })
  try {
    const { TerminatingInstances } = await ec2Client.send(
      new TerminateInstancesCommand({ InstanceIds: instanceIds })
    )
    res.json({ TerminatingInstances: TerminatingInstances || [], message: 'Instance termination requested' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function describeInstanceStatus(req, res) {
  try {
    const { InstanceStatuses } = await ec2Client.send(new DescribeInstanceStatusCommand({ IncludeAllInstances: true }))
    res.json({ InstanceStatuses: InstanceStatuses || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ InstanceStatuses: [] })
    res.status(500).json({ message: err.message })
  }
}

/* ── Key Pairs ── */
async function describeKeyPairs(req, res) {
  try {
    const { KeyPairs } = await ec2Client.send(new DescribeKeyPairsCommand({}))
    res.json({ KeyPairs: KeyPairs || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ KeyPairs: [] })
    res.status(500).json({ message: err.message })
  }
}

async function createKeyPair(req, res) {
  const { keyName } = req.body
  if (!keyName) return res.status(400).json({ message: 'Missing keyName' })
  try {
    const result = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }))
    res.json({ KeyPairId: result.KeyPairId, KeyName: result.KeyName, KeyMaterial: result.KeyMaterial, message: `Key pair "${keyName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteKeyPair(req, res) {
  const { name } = req.params
  try {
    await ec2Client.send(new DeleteKeyPairCommand({ KeyName: name }))
    res.json({ message: `Key pair "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Security Groups ── */
async function describeSecurityGroups(req, res) {
  try {
    const { SecurityGroups } = await ec2Client.send(new DescribeSecurityGroupsCommand({}))
    res.json({ SecurityGroups: SecurityGroups || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ SecurityGroups: [] })
    res.status(500).json({ message: err.message })
  }
}

async function createSecurityGroup(req, res) {
  const { groupName, description, vpcId } = req.body
  if (!groupName || !description) return res.status(400).json({ message: 'Missing groupName or description' })
  try {
    const params = { GroupName: groupName, Description: description }
    if (vpcId) params.VpcId = vpcId
    const { GroupId } = await ec2Client.send(new CreateSecurityGroupCommand(params))
    res.json({ GroupId, message: `Security group "${groupName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteSecurityGroup(req, res) {
  const { id } = req.params
  try {
    await ec2Client.send(new DeleteSecurityGroupCommand({ GroupId: id }))
    res.json({ message: `Security group "${id}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function authorizeSecurityGroupIngress(req, res) {
  const { id } = req.params
  const { protocol = 'tcp', fromPort, toPort, cidrIp = '0.0.0.0/0' } = req.body
  try {
    const perm = { IpProtocol: protocol, IpRanges: [{ CidrIp: cidrIp }] }
    if (fromPort !== undefined) perm.FromPort = Number(fromPort)
    if (toPort   !== undefined) perm.ToPort   = Number(toPort)
    await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: id, IpPermissions: [perm] }))
    res.json({ message: `Ingress rule authorized for ${id}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Elastic IPs ── */
async function describeAddresses(req, res) {
  try {
    const { Addresses } = await ec2Client.send(new DescribeAddressesCommand({}))
    res.json({ Addresses: Addresses || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Addresses: [] })
    res.status(500).json({ message: err.message })
  }
}

async function allocateAddress(req, res) {
  try {
    const result = await ec2Client.send(new AllocateAddressCommand({ Domain: 'vpc' }))
    res.json({ AllocationId: result.AllocationId, PublicIp: result.PublicIp, message: 'Elastic IP allocated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function associateAddress(req, res) {
  const { instanceId, allocationId } = req.body
  if (!instanceId || !allocationId) return res.status(400).json({ message: 'Missing instanceId or allocationId' })
  try {
    const { AssociationId } = await ec2Client.send(new AssociateAddressCommand({ InstanceId: instanceId, AllocationId: allocationId }))
    res.json({ AssociationId, message: 'Elastic IP associated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function disassociateAddress(req, res) {
  const { associationId } = req.body
  if (!associationId) return res.status(400).json({ message: 'Missing associationId' })
  try {
    await ec2Client.send(new DisassociateAddressCommand({ AssociationId: associationId }))
    res.json({ message: 'Elastic IP disassociated' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function releaseAddress(req, res) {
  const { allocationId } = req.body
  if (!allocationId) return res.status(400).json({ message: 'Missing allocationId' })
  try {
    await ec2Client.send(new ReleaseAddressCommand({ AllocationId: allocationId }))
    res.json({ message: 'Elastic IP released' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── VPC & Subnets ── */
async function describeVpcs(req, res) {
  try {
    const { Vpcs } = await ec2Client.send(new DescribeVpcsCommand({}))
    res.json({ Vpcs: Vpcs || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Vpcs: [] })
    res.status(500).json({ message: err.message })
  }
}

async function createVpc(req, res) {
  const { cidrBlock } = req.body
  if (!cidrBlock) return res.status(400).json({ message: 'Missing cidrBlock' })
  try {
    const { Vpc } = await ec2Client.send(new CreateVpcCommand({ CidrBlock: cidrBlock }))
    res.json({ Vpc, message: `VPC created with CIDR ${cidrBlock}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function describeSubnets(req, res) {
  try {
    const { Subnets } = await ec2Client.send(new DescribeSubnetsCommand({}))
    res.json({ Subnets: Subnets || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Subnets: [] })
    res.status(500).json({ message: err.message })
  }
}

/* ── AMIs ── */
async function describeImages(req, res) {
  try {
    const { Images } = await ec2Client.send(new DescribeImagesCommand({ Owners: ['self'] }))
    res.json({ Images: Images || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Images: [] })
    res.status(500).json({ message: err.message })
  }
}

/* ── Volumes ── */
async function describeVolumes(req, res) {
  try {
    const { Volumes } = await ec2Client.send(new DescribeVolumesCommand({}))
    res.json({ Volumes: Volumes || [] })
  } catch (err) {
    if (isDeserializationError(err)) return res.json({ Volumes: [] })
    res.status(500).json({ message: err.message })
  }
}

async function createVolume(req, res) {
  const { size = 8, availabilityZone = 'us-east-1a', volumeType = 'gp2' } = req.body
  try {
    const result = await ec2Client.send(new CreateVolumeCommand({ Size: Number(size), AvailabilityZone: availabilityZone, VolumeType: volumeType }))
    res.json({ VolumeId: result.VolumeId, Size: result.Size, State: result.State, message: `Volume created (${size} GB)` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function attachVolume(req, res) {
  const { volumeId, instanceId, device = '/dev/sdf' } = req.body
  if (!volumeId || !instanceId) return res.status(400).json({ message: 'Missing volumeId or instanceId' })
  try {
    const result = await ec2Client.send(new AttachVolumeCommand({ VolumeId: volumeId, InstanceId: instanceId, Device: device }))
    res.json({ ...result, message: `Volume ${volumeId} attached to ${instanceId}` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function detachVolume(req, res) {
  const { volumeId } = req.body
  if (!volumeId) return res.status(400).json({ message: 'Missing volumeId' })
  try {
    const result = await ec2Client.send(new DetachVolumeCommand({ VolumeId: volumeId }))
    res.json({ ...result, message: `Volume ${volumeId} detached` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteVolume(req, res) {
  const { id } = req.params
  try {
    await ec2Client.send(new DeleteVolumeCommand({ VolumeId: id }))
    res.json({ message: `Volume ${id} deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── S3 Bucket Notifications (Lambda triggers) ── */
async function getBucketNotification(req, res) {
  const { name } = req.params
  try {
    const result = await s3Client.send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
    res.json({ LambdaFunctionConfigurations: result.LambdaFunctionConfigurations || [] })
  } catch (err) {
    res.json({ LambdaFunctionConfigurations: [] })
  }
}

async function addBucketTrigger(req, res) {
  const { name } = req.params
  const { functionName, events, prefix, suffix } = req.body
  if (!functionName || !events?.length) {
    return res.status(400).json({ message: 'functionName and events are required.' })
  }
  try {
    const current = await s3Client.send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
    const existing = current.LambdaFunctionConfigurations || []
    const region = 'us-east-1'
    const account = '000000000000'
    const functionArn = `arn:aws:lambda:${region}:${account}:function:${functionName}`
    const id = `trigger-${Date.now()}`
    const filterRules = []
    if (prefix) filterRules.push({ Name: 'prefix', Value: prefix })
    if (suffix) filterRules.push({ Name: 'suffix', Value: suffix })
    const newTrigger = {
      Id: id,
      LambdaFunctionArn: functionArn,
      Events: events,
      ...(filterRules.length ? { Filter: { Key: { FilterRules: filterRules } } } : {}),
    }
    await s3Client.send(new PutBucketNotificationConfigurationCommand({
      Bucket: name,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [...existing, newTrigger],
      },
    }))
    res.json(newTrigger)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteBucketTrigger(req, res) {
  const { name, id } = req.params
  try {
    const current = await s3Client.send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
    const filtered = (current.LambdaFunctionConfigurations || []).filter(t => t.Id !== id)
    await s3Client.send(new PutBucketNotificationConfigurationCommand({
      Bucket: name,
      NotificationConfiguration: { LambdaFunctionConfigurations: filtered },
    }))
    res.json({ message: `Trigger "${id}" removed.` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── Lambda ── */
async function listFunctions(req, res) {
  try {
    const { Functions } = await lambdaClient.send(new ListFunctionsCommand({}))
    res.json({ Functions: Functions || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getFunction(req, res) {
  const { name } = req.params
  try {
    const result = await lambdaClient.send(new GetFunctionCommand({ FunctionName: name }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteFunction(req, res) {
  const { name } = req.params
  try {
    await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: name }))
    res.json({ message: `Function "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function invokeFunction(req, res) {
  const { name } = req.params
  const { payload } = req.body
  try {
    const result = await lambdaClient.send(new InvokeCommand({
      FunctionName: name,
      Payload: payload ? Buffer.from(JSON.stringify(payload)) : undefined,
    }))
    const responsePayload = result.Payload ? Buffer.from(result.Payload).toString('utf-8') : null
    res.json({
      StatusCode: result.StatusCode,
      FunctionError: result.FunctionError,
      LogResult: result.LogResult ? Buffer.from(result.LogResult, 'base64').toString('utf-8') : null,
      Payload: responsePayload,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createFunction(req, res) {
  const { name, runtime, handler, description, role, code, imageUri } = req.body
  if (!name) return res.status(400).json({ message: 'name is required.' })
  try {
    const params = {
      FunctionName: name,
      Description:  description || '',
      Role:         role || 'arn:aws:iam::000000000000:role/lambda-role',
    }
    if (imageUri) {
      params.PackageType = 'Image'
      params.Code = { ImageUri: imageUri }
    } else {
      if (!runtime || !handler) {
        return res.status(400).json({ message: 'runtime and handler are required for zip-based functions.' })
      }
      const defaults = RUNTIME_DEFAULTS[runtime] || { file: 'index.js' }
      params.PackageType = 'Zip'
      params.Runtime = runtime
      params.Handler = handler
      params.Code = { ZipFile: buildZip(defaults.file || 'index.js', code || defaults.code || '') }
    }
    const result = await lambdaClient.send(new CreateFunctionCommand(params))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function updateFunctionCode(req, res) {
  const { name } = req.params
  const { runtime, code } = req.body
  try {
    const defaults = RUNTIME_DEFAULTS[runtime] || { file: 'index.js' }
    const zipBuffer = buildZip(defaults.file || 'index.js', code || '')
    const result = await lambdaClient.send(new UpdateFunctionCodeCommand({
      FunctionName: name,
      ZipFile: zipBuffer,
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listEventSourceMappings(req, res) {
  const { functionName } = req.query
  try {
    const params = functionName ? { FunctionName: functionName } : {}
    const { EventSourceMappings } = await lambdaClient.send(new ListEventSourceMappingsCommand(params))
    res.json({ EventSourceMappings: EventSourceMappings || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createEventSourceMapping(req, res) {
  const { functionName, eventSourceArn, batchSize, startingPosition } = req.body
  if (!functionName || !eventSourceArn) {
    return res.status(400).json({ message: 'functionName and eventSourceArn are required.' })
  }
  try {
    const result = await lambdaClient.send(new CreateEventSourceMappingCommand({
      FunctionName: functionName,
      EventSourceArn: eventSourceArn,
      BatchSize: batchSize || 10,
      StartingPosition: startingPosition || 'LATEST',
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteEventSourceMapping(req, res) {
  const { uuid } = req.params
  try {
    await lambdaClient.send(new DeleteEventSourceMappingCommand({ UUID: uuid }))
    res.json({ message: `Event source mapping "${uuid}" deleted.` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── IAM ── */
async function listUsers(req, res) {
  try {
    const { Users } = await iamClient.send(new ListUsersCommand({}))
    res.json({ Users: Users || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createUser(req, res) {
  const { userName } = req.body
  if (!userName) return res.status(400).json({ message: 'Missing userName' })
  try {
    const { User } = await iamClient.send(new CreateUserCommand({ UserName: userName }))
    res.json({ User, message: `User "${userName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteUser(req, res) {
  const { name } = req.params
  try {
    await iamClient.send(new DeleteUserCommand({ UserName: name }))
    res.json({ message: `User "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listGroups(req, res) {
  try {
    const { Groups } = await iamClient.send(new ListGroupsCommand({}))
    res.json({ Groups: Groups || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createGroup(req, res) {
  const { groupName } = req.body
  if (!groupName) return res.status(400).json({ message: 'Missing groupName' })
  try {
    const { Group } = await iamClient.send(new CreateGroupCommand({ GroupName: groupName }))
    res.json({ Group, message: `Group "${groupName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteGroup(req, res) {
  const { name } = req.params
  try {
    await iamClient.send(new DeleteGroupCommand({ GroupName: name }))
    res.json({ message: `Group "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function addUserToGroup(req, res) {
  const { userName, groupName } = req.body
  if (!userName || !groupName) return res.status(400).json({ message: 'Missing userName or groupName' })
  try {
    await iamClient.send(new AddUserToGroupCommand({ UserName: userName, GroupName: groupName }))
    res.json({ message: `User "${userName}" added to group "${groupName}"` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listRoles(req, res) {
  try {
    const { Roles } = await iamClient.send(new ListRolesCommand({}))
    res.json({ Roles: Roles || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function createRole(req, res) {
  const { roleName, assumeRolePolicyDocument } = req.body
  if (!roleName) return res.status(400).json({ message: 'Missing roleName' })
  const doc = assumeRolePolicyDocument || {
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
  }
  try {
    const { Role } = await iamClient.send(new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: typeof doc === 'string' ? doc : JSON.stringify(doc),
    }))
    res.json({ Role, message: `Role "${roleName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteRole(req, res) {
  const { name } = req.params
  try {
    await iamClient.send(new DeleteRoleCommand({ RoleName: name }))
    res.json({ message: `Role "${name}" deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listPolicies(req, res) {
  try {
    const { Policies } = await iamClient.send(new ListPoliciesCommand({ Scope: 'Local' }))
    res.json({ Policies: Policies || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function listAttachedUserPolicies(req, res) {
  const { name } = req.params
  try {
    const { AttachedPolicies } = await iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: name }))
    res.json({ AttachedPolicies: AttachedPolicies || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function attachUserPolicy(req, res) {
  const { name } = req.params
  const { policyArn } = req.body
  if (!policyArn) return res.status(400).json({ message: 'Missing policyArn' })
  try {
    await iamClient.send(new AttachUserPolicyCommand({ UserName: name, PolicyArn: policyArn }))
    res.json({ message: `Policy attached to user "${name}"` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function detachUserPolicy(req, res) {
  const { name } = req.params
  const { policyArn } = req.body
  if (!policyArn) return res.status(400).json({ message: 'Missing policyArn' })
  try {
    await iamClient.send(new DetachUserPolicyCommand({ UserName: name, PolicyArn: policyArn }))
    res.json({ message: `Policy detached from user "${name}"` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/* ── CloudWatch ── */
async function listMetrics(req, res) {
  try {
    const { Metrics } = await cloudwatchClient.send(new ListMetricsCommand({}))
    res.json({ Metrics: Metrics || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function describeAlarms(req, res) {
  try {
    const { MetricAlarms } = await cloudwatchClient.send(new DescribeAlarmsCommand({}))
    res.json({ MetricAlarms: MetricAlarms || [] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function putMetricAlarm(req, res) {
  const { alarmName, metricName, namespace, statistic = 'Average', period = 300, evaluationPeriods = 1, threshold, comparisonOperator = 'GreaterThanThreshold' } = req.body
  if (!alarmName || !metricName || !namespace || threshold === undefined) {
    return res.status(400).json({ message: 'Missing required alarm fields' })
  }
  try {
    await cloudwatchClient.send(new PutMetricAlarmCommand({
      AlarmName: alarmName,
      MetricName: metricName,
      Namespace: namespace,
      Statistic: statistic,
      Period: Number(period),
      EvaluationPeriods: Number(evaluationPeriods),
      Threshold: Number(threshold),
      ComparisonOperator: comparisonOperator,
    }))
    res.json({ message: `Alarm "${alarmName}" created` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function deleteAlarms(req, res) {
  const { alarmNames } = req.body
  if (!alarmNames?.length) return res.status(400).json({ message: 'Missing alarmNames' })
  try {
    await cloudwatchClient.send(new DeleteAlarmsCommand({ AlarmNames: alarmNames }))
    res.json({ message: `${alarmNames.length} alarm(s) deleted` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function enableAlarm(req, res) {
  const { name } = req.params
  try {
    await cloudwatchClient.send(new EnableAlarmActionsCommand({ AlarmNames: [name] }))
    res.json({ message: `Alarm "${name}" actions enabled` })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function disableAlarm(req, res) {
  const { name } = req.params
  try {
    await cloudwatchClient.send(new DisableAlarmActionsCommand({ AlarmNames: [name] }))
    res.json({ message: `Alarm "${name}" actions disabled` })
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
      } else if (subcommand === 'start-instances') {
        const instanceIds = parseInstanceIds(flags['instance-ids'] || flags['instance-id'])
        if (!instanceIds.length) return res.json({ output: 'Missing --instance-ids', exitCode: 1 })
        const { StartingInstances } = await ec2Client.send(
          new StartInstancesCommand({ InstanceIds: instanceIds })
        )
        output = fmt({ StartingInstances: StartingInstances || [] })
      } else if (subcommand === 'stop-instances') {
        const instanceIds = parseInstanceIds(flags['instance-ids'] || flags['instance-id'])
        if (!instanceIds.length) return res.json({ output: 'Missing --instance-ids', exitCode: 1 })
        const { StoppingInstances } = await ec2Client.send(
          new StopInstancesCommand({ InstanceIds: instanceIds, Hibernate: !!flags.hibernate })
        )
        output = fmt({ StoppingInstances: StoppingInstances || [] })
      } else if (subcommand === 'hibernate-instances') {
        const instanceIds = parseInstanceIds(flags['instance-ids'] || flags['instance-id'])
        if (!instanceIds.length) return res.json({ output: 'Missing --instance-ids', exitCode: 1 })
        const { StoppingInstances } = await ec2Client.send(
          new StopInstancesCommand({ InstanceIds: instanceIds, Hibernate: true })
        )
        output = fmt({ StoppingInstances: StoppingInstances || [] })
      } else if (subcommand === 'reboot-instances') {
        const instanceIds = parseInstanceIds(flags['instance-ids'] || flags['instance-id'])
        if (!instanceIds.length) return res.json({ output: 'Missing --instance-ids', exitCode: 1 })
        await ec2Client.send(new RebootInstancesCommand({ InstanceIds: instanceIds }))
        output = fmt({ InstanceIds: instanceIds })
      } else if (subcommand === 'terminate-instances') {
        const instanceIds = parseInstanceIds(flags['instance-ids'] || flags['instance-id'])
        if (!instanceIds.length) return res.json({ output: 'Missing --instance-ids', exitCode: 1 })
        const { TerminatingInstances } = await ec2Client.send(
          new TerminateInstancesCommand({ InstanceIds: instanceIds })
        )
        output = fmt({ TerminatingInstances: TerminatingInstances || [] })
      } else if (subcommand === 'run-instances') {
        const imageId = flags['image-id']
        if (!imageId) return res.json({ output: 'Missing --image-id', exitCode: 1 })
        const instanceType = flags['instance-type'] || 't2.micro'
        const count = Number(flags['count'] || flags['min-count'] || 1)
        const { Instances } = await ec2Client.send(new RunInstancesCommand({ ImageId: imageId, InstanceType: instanceType, MinCount: count, MaxCount: count }))
        output = fmt({ Instances: Instances || [] })
      } else if (subcommand === 'describe-instance-status') {
        const { InstanceStatuses } = await ec2Client.send(new DescribeInstanceStatusCommand({ IncludeAllInstances: true }))
        output = fmt({ InstanceStatuses: InstanceStatuses || [] })
      } else if (subcommand === 'describe-key-pairs') {
        const { KeyPairs } = await ec2Client.send(new DescribeKeyPairsCommand({}))
        output = fmt({ KeyPairs: KeyPairs || [] })
      } else if (subcommand === 'create-key-pair') {
        const keyName = flags['key-name']
        if (!keyName) return res.json({ output: 'Missing --key-name', exitCode: 1 })
        const result = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }))
        output = fmt({ KeyPairId: result.KeyPairId, KeyName: result.KeyName })
      } else if (subcommand === 'delete-key-pair') {
        const keyName = flags['key-name']
        if (!keyName) return res.json({ output: 'Missing --key-name', exitCode: 1 })
        await ec2Client.send(new DeleteKeyPairCommand({ KeyName: keyName }))
        output = ''
      } else if (subcommand === 'describe-security-groups') {
        const { SecurityGroups } = await ec2Client.send(new DescribeSecurityGroupsCommand({}))
        output = fmt({ SecurityGroups: SecurityGroups || [] })
      } else if (subcommand === 'create-security-group') {
        const groupName = flags['group-name']
        const description = flags['description']
        if (!groupName || !description) return res.json({ output: 'Missing --group-name or --description', exitCode: 1 })
        const { GroupId } = await ec2Client.send(new CreateSecurityGroupCommand({ GroupName: groupName, Description: description }))
        output = fmt({ GroupId })
      } else if (subcommand === 'delete-security-group') {
        const groupId = flags['group-id']
        if (!groupId) return res.json({ output: 'Missing --group-id', exitCode: 1 })
        await ec2Client.send(new DeleteSecurityGroupCommand({ GroupId: groupId }))
        output = ''
      } else if (subcommand === 'authorize-security-group-ingress') {
        const groupId = flags['group-id']
        if (!groupId) return res.json({ output: 'Missing --group-id', exitCode: 1 })
        const protocol = flags['protocol'] || 'tcp'
        const port = flags['port'] !== undefined ? Number(flags['port']) : undefined
        const cidr = flags['cidr'] || '0.0.0.0/0'
        const perm = { IpProtocol: protocol, IpRanges: [{ CidrIp: cidr }] }
        if (port !== undefined) { perm.FromPort = port; perm.ToPort = port }
        await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: groupId, IpPermissions: [perm] }))
        output = ''
      } else if (subcommand === 'describe-addresses') {
        const { Addresses } = await ec2Client.send(new DescribeAddressesCommand({}))
        output = fmt({ Addresses: Addresses || [] })
      } else if (subcommand === 'allocate-address') {
        const result = await ec2Client.send(new AllocateAddressCommand({ Domain: 'vpc' }))
        output = fmt({ AllocationId: result.AllocationId, PublicIp: result.PublicIp })
      } else if (subcommand === 'associate-address') {
        const instanceId = flags['instance-id']
        const allocationId = flags['allocation-id']
        if (!instanceId || !allocationId) return res.json({ output: 'Missing --instance-id or --allocation-id', exitCode: 1 })
        const { AssociationId } = await ec2Client.send(new AssociateAddressCommand({ InstanceId: instanceId, AllocationId: allocationId }))
        output = fmt({ AssociationId })
      } else if (subcommand === 'disassociate-address') {
        const associationId = flags['association-id']
        if (!associationId) return res.json({ output: 'Missing --association-id', exitCode: 1 })
        await ec2Client.send(new DisassociateAddressCommand({ AssociationId: associationId }))
        output = ''
      } else if (subcommand === 'release-address') {
        const allocationId = flags['allocation-id']
        if (!allocationId) return res.json({ output: 'Missing --allocation-id', exitCode: 1 })
        await ec2Client.send(new ReleaseAddressCommand({ AllocationId: allocationId }))
        output = ''
      } else if (subcommand === 'describe-vpcs') {
        const { Vpcs } = await ec2Client.send(new DescribeVpcsCommand({}))
        output = fmt({ Vpcs: Vpcs || [] })
      } else if (subcommand === 'create-vpc') {
        const cidrBlock = flags['cidr-block']
        if (!cidrBlock) return res.json({ output: 'Missing --cidr-block', exitCode: 1 })
        const { Vpc } = await ec2Client.send(new CreateVpcCommand({ CidrBlock: cidrBlock }))
        output = fmt({ Vpc })
      } else if (subcommand === 'describe-subnets') {
        const { Subnets } = await ec2Client.send(new DescribeSubnetsCommand({}))
        output = fmt({ Subnets: Subnets || [] })
      } else if (subcommand === 'describe-images') {
        const { Images } = await ec2Client.send(new DescribeImagesCommand({ Owners: ['self'] }))
        output = fmt({ Images: Images || [] })
      } else if (subcommand === 'describe-volumes') {
        const { Volumes } = await ec2Client.send(new DescribeVolumesCommand({}))
        output = fmt({ Volumes: Volumes || [] })
      } else if (subcommand === 'create-volume') {
        const size = flags['size'] ? Number(flags['size']) : 8
        const az = flags['availability-zone'] || 'us-east-1a'
        const volumeType = flags['volume-type'] || 'gp2'
        const result = await ec2Client.send(new CreateVolumeCommand({ Size: size, AvailabilityZone: az, VolumeType: volumeType }))
        output = fmt({ VolumeId: result.VolumeId, Size: result.Size, State: result.State })
      } else if (subcommand === 'attach-volume') {
        const volumeId = flags['volume-id']
        const instanceId = flags['instance-id']
        const device = flags['device'] || '/dev/sdf'
        if (!volumeId || !instanceId) return res.json({ output: 'Missing --volume-id or --instance-id', exitCode: 1 })
        const result = await ec2Client.send(new AttachVolumeCommand({ VolumeId: volumeId, InstanceId: instanceId, Device: device }))
        output = fmt(result)
      } else if (subcommand === 'detach-volume') {
        const volumeId = flags['volume-id']
        if (!volumeId) return res.json({ output: 'Missing --volume-id', exitCode: 1 })
        const result = await ec2Client.send(new DetachVolumeCommand({ VolumeId: volumeId }))
        output = fmt(result)
      } else if (subcommand === 'delete-volume') {
        const volumeId = flags['volume-id']
        if (!volumeId) return res.json({ output: 'Missing --volume-id', exitCode: 1 })
        await ec2Client.send(new DeleteVolumeCommand({ VolumeId: volumeId }))
        output = ''
      } else {
        return res.json({
          output: `Unknown ec2 command: ${subcommand}\nRun: aws ec2 help`,
          exitCode: 1,
        })
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

/* ── Static website serving ── */
async function serveWebsite(req, res) {
  const { bucket } = req.params
  let filePath = req.params[0] || ''

  /* get website config to find index/error documents */
  let indexDoc = 'index.html'
  let errorDoc = 'error.html'
  try {
    const cfg = await s3Client.send(new GetBucketWebsiteCommand({ Bucket: bucket }))
    indexDoc = cfg.IndexDocument?.Suffix || 'index.html'
    errorDoc = cfg.ErrorDocument?.Key || 'error.html'
  } catch { /* website not configured — still try to serve */ }

  /* resolve directory requests to the index document */
  if (!filePath || filePath === '/' || filePath.endsWith('/')) {
    filePath = filePath.replace(/\/$/, '') + (filePath ? '/' : '') + indexDoc
  }

  const MIME = {
    html: 'text/html', htm: 'text/html',
    css: 'text/css', js: 'application/javascript', mjs: 'application/javascript',
    json: 'application/json', xml: 'application/xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
    webp: 'image/webp', avif: 'image/avif',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
    pdf: 'application/pdf', txt: 'text/plain',
  }

  const tryServe = async (key) => {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const ext = key.split('.').pop().toLowerCase()
    const mime = MIME[ext] || result.ContentType || 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    res.setHeader('X-Website-Bucket', bucket)
    if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength)
    result.Body.pipe(res)
  }

  try {
    await tryServe(filePath)
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchKey') {
      try {
        await tryServe(errorDoc)
      } catch {
        res.status(404).send(`
<!DOCTYPE html><html><head><title>404 Not Found</title>
<style>body{font-family:sans-serif;padding:40px;background:#f2f3f3;color:#16191f}
h1{color:#c7131f}code{background:#e8e8e8;padding:2px 6px;border-radius:3px}</style></head>
<body><h1>404 Not Found</h1>
<p>The requested file <code>${filePath}</code> was not found in bucket <code>${bucket}</code>.</p>
<p>Make sure you have uploaded <code>${indexDoc}</code> and configured static website hosting.</p>
</body></html>`)
      }
    } else {
      res.status(500).send(`Error: ${err.message}`)
    }
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
  getWebsite, putWebsite, deleteWebsite, serveWebsite,
  viewObject,
  getPresignedUrl,
  getBucketTags, putBucketTags,
  getOwnership, putOwnership,
  getObjectLock, putObjectLock,
  runInstances, describeInstances, describeInstanceStatus,
  startInstances, stopInstances, rebootInstances, terminateInstances, hibernateInstances,
  describeKeyPairs, createKeyPair, deleteKeyPair,
  describeSecurityGroups, createSecurityGroup, deleteSecurityGroup, authorizeSecurityGroupIngress,
  describeAddresses, allocateAddress, associateAddress, disassociateAddress, releaseAddress,
  describeVpcs, createVpc, describeSubnets,
  describeImages,
  describeVolumes, createVolume, attachVolume, detachVolume, deleteVolume,
  getBucketNotification, addBucketTrigger, deleteBucketTrigger,
  listFunctions, getFunction, createFunction, deleteFunction, invokeFunction, updateFunctionCode,
  listEventSourceMappings, createEventSourceMapping, deleteEventSourceMapping,
  listUsers, createUser, deleteUser,
  listGroups, createGroup, deleteGroup, addUserToGroup,
  listRoles, createRole, deleteRole,
  listPolicies, listAttachedUserPolicies, attachUserPolicy, detachUserPolicy,
  listMetrics, describeAlarms, putMetricAlarm, deleteAlarms, enableAlarm, disableAlarm,
  cliCommand,
}
