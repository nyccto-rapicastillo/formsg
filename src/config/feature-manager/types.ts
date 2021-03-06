import { Schema } from 'convict'

export enum FeatureNames {
  AggregateStats = 'aggregate-stats',
  Captcha = 'captcha',
  GoogleAnalytics = 'google-analytics',
  Sentry = 'sentry',
  Sms = 'sms',
  SpcpMyInfo = 'spcp-myinfo',
  VerifiedFields = 'verified-fields',
  WebhookVerifiedContent = 'webhook-verified-content',
}

export interface IAggregateStats {
  aggregateCollection: string
}

export interface ICaptcha {
  captchaPrivateKey: string
  captchaPublicKey: string
}

export interface IGoogleAnalytics {
  GATrackingID: string
}

export interface ISentry {
  sentryConfigUrl: string
}

export interface ISms {
  twilioAccountSid: string
  twilioApiKey: string
  twilioApiSecret: string
  twilioMsgSrvcSid: string
}

export interface ISpcpMyInfo {
  isSPMaintenance: string
  isCPMaintenance: string
  spCookieMaxAge: number
  spCookieMaxAgePreserved: number
  spcpCookieDomain: string
  cpCookieMaxAge: number
  spIdpId: string
  cpIdpId: string
  spPartnerEntityId: string
  cpPartnerEntityId: string
  spIdpLoginUrl: string
  cpIdpLoginUrl: string
  spIdpEndpoint: string
  cpIdpEndpoint: string
  spEsrvcId: string
  cpEsrvcId: string
  spFormSgKeyPath: string
  cpFormSgKeyPath: string
  spFormSgCertPath: string
  cpFormSgCertPath: string
  spIdpCertPath: string
  cpIdpCertPath: string
}

export interface IVerifiedFields {
  verificationSecretKey: string
}

export interface IWebhookVerifiedContent {
  signingSecretKey: string
}

export interface IFeatureManager {
  [FeatureNames.AggregateStats]: IAggregateStats
  [FeatureNames.Captcha]: ICaptcha
  [FeatureNames.GoogleAnalytics]: IGoogleAnalytics
  [FeatureNames.Sentry]: ISentry
  [FeatureNames.Sms]: ISms
  [FeatureNames.SpcpMyInfo]: ISpcpMyInfo
  [FeatureNames.VerifiedFields]: IVerifiedFields
  [FeatureNames.WebhookVerifiedContent]: IWebhookVerifiedContent
}

export interface RegisterableFeature<K extends FeatureNames> {
  name: K
  schema: Schema<IFeatureManager[K]>
}
