import { PackageMode } from '@opengovsg/formsg-sdk/dist/types'
import aws from 'aws-sdk'
import crypto from 'crypto'
import { SessionOptions } from 'express-session'
import { ConnectionOptions, Schema } from 'mongoose'
import nodemailer from 'nodemailer'
import directTransport from 'nodemailer-direct-transport'
import Mail from 'nodemailer/lib/mailer'
import SMTPPool from 'nodemailer/lib/smtp-pool'

import defaults from './defaults'
import { createLoggerWithLabel } from './logger'

const configLogger = createLoggerWithLabel('config')

// Typings
type AppConfig = {
  title: string
  description: string
  appUrl: string
  keywords: string
  images: string[]
  twitterImage: string
}

type DbConfig = {
  uri: string
  options: ConnectionOptions
}

type AwsConfig = {
  imageS3Bucket: string
  logoS3Bucket: string
  attachmentS3Bucket: string
  region: string

  logoBucketUrl: string
  imageBucketUrl: string
  attachmentBucketUrl: string
  s3: aws.S3
}

type EmailRetryConfig = {
  retryDuration: number
  maxRetryCount: number
  maxRetryDuration: number
}

type MailConfig = {
  mailFrom: string
  mailer: {
    from: string
  }
  transporter: Mail
  retry: EmailRetryConfig
}

type Config = {
  app: AppConfig
  db: DbConfig
  aws: AwsConfig
  mail: MailConfig

  cookieSettings: SessionOptions['cookie']
  // Consts
  isDev: boolean
  nodeEnv: Environment
  port: number
  sessionSecret: string
  cspReportUri: string
  chromiumBin: string
  otpLifeSpan: number
  formsgSdkMode: PackageMode
  submissionsTopUp: number
  customCloudWatchGroup?: string
  isGeneralMaintenance?: string
  isLoginBanner?: string
  siteBannerContent?: string
  adminBannerContent?: string

  // Functions
  configureAws: () => Promise<void>
  otpGenerator: () => string
  mongoTimestamp: (schema: Schema, options: any) => void
}

// Enums
enum Environment {
  Dev = 'development',
  Prod = 'production',
}

// Environment variables with defaults
const isDev = process.env.NODE_ENV === Environment.Dev
const nodeEnv = isDev ? Environment.Dev : Environment.Prod
const port = parseInt(process.env.PORT, 10) || defaults.app.port
const sessionSecret = process.env.SESSION_SECRET || defaults.app.sessionSecret

/**
 * OTP Life Span for Login. (Should be in miliseconds, e.g. 1000 * 60 * 15 = 15
 * mins).
 */
const otpLifeSpan =
  parseInt(process.env.OTP_LIFE_SPAN, 10) || defaults.login.otpLifeSpan

/**
 * Number of submissions to top up submissions statistic by
 */
const submissionsTopUp = parseInt(process.env.SUBMISSIONS_TOP_UP, 10) || 0

/**
 * Content Security Policy reporting
 * HelmetJS reportUri param requires non-empty string, so 'undefined' is
 * declared.
 */
const cspReportUri = process.env.CSP_REPORT_URI || 'undefined'
if (!process.env.CSP_REPORT_URI) {
  configLogger.warn('Content Security Policy reporting is not configured.')
}

/**
 * Chromium executable for PDF generation
 */
const chromiumBin = process.env.CHROMIUM_BIN
if (!chromiumBin) {
  throw new Error(
    'Path to Chromium executable missing - please specify in CHROMIUM_BIN environment variable',
  )
}

/**
 * FormSG SDK mode.
 * Needed due to the SDK having multiple modes - staging, production,
 * development, and test, whilst the backend only has 2 modes (prod and dev).
 *
 * The SDK modes are required to be set properly so that the correct public keys
 * are used to sign, encrypt, or decrypt data that is passed into the SDK.
 */
const formsgSdkMode = process.env.FORMSG_SDK_MODE as PackageMode
if (
  !formsgSdkMode ||
  !['staging', 'production', 'development', 'test'].includes(formsgSdkMode)
) {
  throw new Error(
    'FORMSG_SDK_MODE not found or invalid. Please specify one of: "staging" | "production" | "development" | "test" in the environment variable.',
  )
}

// Optional environment variables
/**
 * Name of CloudWatch log group to store short-term logs. Log streams are
 * separated by date.
 */
const customCloudWatchGroup = process.env.CUSTOM_CLOUDWATCH_LOG_GROUP

/**
 * Load env variable with General Maintenance banner text.
 */
const isGeneralMaintenance = process.env.IS_GENERAL_MAINTENANCE

/**
 * The banner message on login page. Allows for HTML.
 */
const isLoginBanner = process.env.IS_LOGIN_BANNER

/**
 * The banner message to show on all pages. Allows for HTML. Will supersede
 * all other banner content if it exists.
 */
const siteBannerContent = process.env.SITE_BANNER_CONTENT

/**
 * The banner message to show on on admin pages. Allows for HTML.
 */
const adminBannerContent = process.env.ADMIN_BANNER_CONTENT

// Configs
const appConfig: AppConfig = {
  title: process.env.APP_NAME || defaults.app.name,
  description: process.env.APP_DESC || defaults.app.desc,
  appUrl: process.env.APP_URL || defaults.app.url,
  keywords: process.env.APP_KEYWORDS || defaults.app.keywords,
  images: (process.env.APP_IMAGES || defaults.app.images).split(','),
  twitterImage: process.env.APP_TWITTER_IMAGE || defaults.app.twitterImage,
}

const dbConfig: DbConfig = {
  uri: process.env.DB_HOST || undefined,
  options: {
    user: '',
    pass: '',
    // Only create indexes in dev env to avoid adverse production impact.
    autoIndex: isDev,
    // Avoid using deprecated URL string parser in MongoDB driver
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Avoid using deprecated collection.ensureIndex internally
    useCreateIndex: true,
    // upgrade to mongo driver's native findOneAndUpdate function instead of
    // findAndModify.
    useFindAndModify: false,
    promiseLibrary: global.Promise,
  },
}

const mailConfig: MailConfig = (function () {
  const mailFrom = process.env.MAIL_FROM || defaults.mail.mailFrom
  const mailer = {
    from: `${appConfig.title} <${mailFrom}>`,
  }

  // Creating mail transport
  const hasAllSesCredentials =
    process.env.SES_HOST &&
    process.env.SES_PORT &&
    process.env.SES_USER &&
    process.env.SES_PASS

  let transporter: Mail

  if (hasAllSesCredentials) {
    const options: SMTPPool.Options = {
      host: process.env.SES_HOST,
      auth: {
        user: process.env.SES_USER,
        pass: process.env.SES_PASS,
      },
      port: Number(process.env.SES_PORT),
      // Options as advised from https://nodemailer.com/usage/bulk-mail/
      // pool connections instead of creating fresh one for each email
      pool: true,
      maxMessages:
        Number(process.env.SES_MAX_MESSAGES) || defaults.ses.maxMessages,
      maxConnections:
        Number(process.env.SES_POOL) || defaults.ses.maxConnections,
      socketTimeout:
        Number(process.env.MAIL_SOCKET_TIMEOUT) || defaults.ses.socketTimeout,
      // If set to true then logs to console. If value is not set or is false
      // then nothing is logged.
      logger: String(process.env.MAIL_LOGGER).toLowerCase() === 'true',
      // If set to true, then logs SMTP traffic, otherwise logs only transaction
      // events.
      debug: String(process.env.MAIL_DEBUG).toLowerCase() === 'true',
      // Per second, or per rateDelta if supplied.
      rateLimit: process.env.SES_RATE
        ? Number(process.env.SES_RATE)
        : undefined,
      // Defines the time measuring period in milliseconds (defaults to 1000)
      // for rate limiting.
      rateDelta: process.env.SES_RATEDELTA
        ? Number(process.env.SES_RATEDELTA)
        : undefined,
    }

    transporter = nodemailer.createTransport(options)
  } else if (process.env.SES_PORT) {
    configLogger.warn(
      '\n!!! WARNING !!!',
      '\nNo SES credentials detected.',
      '\nUsing Nodemailer to send to local SMTP server instead.',
      '\nThis should NEVER be seen in production.',
    )
    transporter = nodemailer.createTransport({
      port: Number(process.env.SES_PORT),
      ignoreTLS: true,
    })
  } else {
    configLogger.warn(
      '\n!!! WARNING !!!',
      '\nNo SES credentials detected.',
      '\nUsing Nodemailer Direct Transport instead.',
      '\nThis should NEVER be seen in production.',
    )
    // Falls back to direct transport
    transporter = nodemailer.createTransport(directTransport({}))
  }

  const emailRetryConfig: EmailRetryConfig = {
    retryDuration:
      Number(process.env.MAIL_RETRY_DURATION) || defaults.mail.retryDuration,
    maxRetryCount:
      Number(process.env.MAIL_RETRY_COUNT) || defaults.mail.maxRetryCount,
    maxRetryDuration:
      Number(process.env.MAIL_MAX_RETRY_DURATION) ||
      defaults.mail.maxRetryDuration,
  }

  return {
    mailFrom,
    mailer,
    transporter,
    retry: emailRetryConfig,
  }
})()

// Run function instead of a constant so errors can be thrown.
const awsConfig: AwsConfig = (function () {
  const imageS3Bucket = process.env.IMAGE_S3_BUCKET
  if (!imageS3Bucket) {
    throw new Error(
      'Image S3 Bucket configuration missing - please specify in IMAGE_S3_BUCKET environment variable',
    )
  }
  /**
   * S3 Bucket to upload logos to
   */
  const logoS3Bucket = process.env.LOGO_S3_BUCKET
  if (!logoS3Bucket) {
    throw new Error(
      'Logo S3 Bucket configuration missing - please specify in LOGO_S3_BUCKET environment variable',
    )
  }

  /**
   * S3 Bucket to upload encrypted attachments to
   */
  const attachmentS3Bucket = process.env.ATTACHMENT_S3_BUCKET
  if (!attachmentS3Bucket) {
    throw new Error(
      'Attachment S3 Bucket configuration missing - please specify in ATTACHMENT_S3_BUCKET environment variable',
    )
  }

  /**
   * Region that S3 bucket is located in
   */
  const region = process.env.AWS_REGION || defaults.aws.region

  // Construct bucket URLs depending on node environment
  // If in development env, endpoint communicates with localstack, a fully
  // functional local AWS cloud stack for hosting images/logos/attachments.
  // Else, the environment variables to instantiate S3 are used.
  const awsEndpoint = isDev
    ? defaults.aws.endpoint
    : `https://s3.${region}.amazonaws.com/`

  const logoBucketUrl = `${awsEndpoint}/${logoS3Bucket}`
  const imageBucketUrl = `${awsEndpoint}/${imageS3Bucket}`
  const attachmentBucketUrl = `${awsEndpoint}/${attachmentS3Bucket}`

  const s3 = new aws.S3({
    region,
    // Unset and use default if not in development mode
    // Endpoint and path style overrides are needed only in development mode for
    // localstack to work.
    endpoint: isDev ? defaults.aws.endpoint : undefined,
    s3ForcePathStyle: isDev ? true : undefined,
  })

  return {
    imageS3Bucket,
    logoS3Bucket,
    attachmentS3Bucket,
    region,
    logoBucketUrl,
    imageBucketUrl,
    attachmentBucketUrl,
    s3,
  }
})()

const cookieSettings: SessionOptions['cookie'] = {
  httpOnly: true, // JavaScript will not be able to read the cookie in case of XSS exploitation
  secure: !isDev, // true prevents cookie from being accessed over http
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: 'strict', // Cookie will not be sent if navigating from another domain
}

// Functions
const configureAws = async () => {
  if (!isDev) {
    const getCredentials = () => {
      return new Promise((resolve, reject) => {
        aws.config.getCredentials((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    await getCredentials()
    if (!aws.config.credentials.accessKeyId) {
      throw new Error(`AWS Access Key Id is missing`)
    }
    if (!aws.config.credentials.secretAccessKey) {
      throw new Error(`AWS Secret Access Key is missing`)
    }
  }
}

/**
 * Generates OTP for passwordless login
 * @return 6 digit OTP string
 */
const otpGenerator = () => {
  let length = 6
  let chars = '0123456789'
  // Generates cryptographically strong pseudo-random data.
  // The size argument is a number indicating the number of bytes to generate.
  const rnd = crypto.randomBytes(length)
  const d = chars.length / 256
  const value = new Array(length)
  for (let i = 0; i < length; i++) {
    value[i] = chars[Math.floor(rnd[i] * d)]
  }
  return value.join('')
}

// TODO(#2505): Remove this once no models rely on this and use mongoose's own
// timestamps.
/**
 * Generates created and last modified fields for several mongo models.
 * Taken from mongoose-utilities's timestamp function.
 * Should really be inside a utils.js file.
 * @param  schema  Mongoose schema
 * @param  options Dictionary of created and modified
 */
const mongoTimestamp = (schema: Schema, options: any) => {
  options || (options = {})

  // Options
  let fields = {}
  let createdPath = options.createdPath || 'created'
  let modifiedPath = options.modifiedPath || 'modified'

  // Add paths to schema if not present
  if (!schema.paths[createdPath]) {
    fields[modifiedPath] = { type: Date }
  }
  if (!schema.paths[createdPath]) {
    fields[createdPath] = {
      type: Date,
      default: Date.now,
    }
  }

  schema.add(fields)

  // Update the modified timestamp on save
  schema.pre('save', function (next) {
    this[modifiedPath] = new Date()
    return next()
  })
}

const config: Config = {
  app: appConfig,
  db: dbConfig,
  aws: awsConfig,
  mail: mailConfig,
  cookieSettings,
  isDev,
  nodeEnv,
  port,
  customCloudWatchGroup,
  sessionSecret,
  otpLifeSpan,
  formsgSdkMode,
  chromiumBin,
  cspReportUri,
  submissionsTopUp,
  isGeneralMaintenance,
  isLoginBanner,
  siteBannerContent,
  adminBannerContent,
  configureAws,
  otpGenerator,
  mongoTimestamp,
}

export = config
