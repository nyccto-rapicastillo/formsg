import { FeatureNames, RegisterableFeature } from './types'

const HOUR_IN_MILLIS = 1000 * 60 * 60
const DAY_IN_MILLIS = 24 * HOUR_IN_MILLIS

const spcpMyInfoFeature: RegisterableFeature<FeatureNames.SpcpMyInfo> = {
  name: FeatureNames.SpcpMyInfo,
  schema: {
    isSPMaintenance: {
      doc:
        'If set, displays a banner message on SingPass forms. Overrides IS_CP_MAINTENANCE',
      format: '*',
      default: null,
      env: 'IS_SP_MAINTENANCE',
    },
    isCPMaintenance: {
      doc: 'If set, displays a banner message on CorpPass forms',
      format: '*',
      default: null,
      env: 'IS_CP_MAINTENANCE',
    },
    spCookieMaxAge: {
      doc: 'Max SingPass cookie age with remember me unchecked',
      format: 'int',
      default: 1 * HOUR_IN_MILLIS,
      env: 'SP_COOKIE_MAX_AGE',
    },
    spCookieMaxAgePreserved: {
      doc: 'Max SingPass cookie age with remember me checked',
      format: 'int',
      default: 30 * DAY_IN_MILLIS,
      env: 'SPCP_COOKIE_MAX_AGE_PRESERVED',
    },
    spcpCookieDomain: {
      doc: 'Domain name set on cookie that holds the SPCP jwt',
      format: String,
      default: '',
      env: 'SPCP_COOKIE_DOMAIN',
    },
    cpCookieMaxAge: {
      doc: 'Max CorpPass cookie age',
      format: 'int',
      default: 6 * HOUR_IN_MILLIS,
      env: 'CP_COOKIE_MAX_AGE',
    },
    spIdpId: {
      doc:
        'Partner ID of National Digital Identity Office for SingPass authentication',
      format: 'url',
      default: null,
      env: 'SINGPASS_IDP_ID',
    },
    cpIdpId: {
      doc:
        'Partner ID of National Digital Identity Office for CorpPass authentication',
      format: 'url',
      default: null,
      env: 'CORPPASS_IDP_ID',
    },
    spPartnerEntityId: {
      doc:
        'Partner ID registered with National Digital Identity Office for SingPass authentication',
      format: 'url',
      default: null,
      env: 'SINGPASS_PARTNER_ENTITY_ID',
    },
    cpPartnerEntityId: {
      doc:
        'Partner ID registered with National Digital Identity Office for CorpPass authentication',
      format: 'url',
      default: null,
      env: 'CORPPASS_PARTNER_ENTITY_ID',
    },
    spIdpLoginUrl: {
      doc: 'URL of SingPass Login Page',
      format: 'url',
      default: null,
      env: 'SINGPASS_IDP_LOGIN_URL',
    },
    cpIdpLoginUrl: {
      doc: 'URL of CorpPass Login Page',
      format: 'url',
      default: null,
      env: 'CORPPASS_IDP_LOGIN_URL',
    },
    spIdpEndpoint: {
      doc: 'URL to retrieve NRIC of SingPass-validated user from',
      format: 'url',
      default: null,
      env: 'SINGPASS_IDP_ENDPOINT',
    },
    cpIdpEndpoint: {
      doc: 'URL to retrieve UEN of CorpPass-validated user from',
      format: 'url',
      default: null,
      env: 'CORPPASS_IDP_ENDPOINT',
    },
    spEsrvcId: {
      doc:
        'e-service ID registered with National Digital Identity office for SingPass authentication',
      format: String,
      default: null,
      env: 'SINGPASS_ESRVC_ID',
    },
    cpEsrvcId: {
      doc:
        'e-service ID registered with National Digital Identity office for CorpPass authentication',
      format: String,
      default: null,
      env: 'CORPPASS_ESRVC_ID',
    },
    spFormSgKeyPath: {
      doc:
        'Path to X.509 key used for SingPass related communication with National Digital Identity office',
      format: String,
      default: null,
      env: 'SP_FORMSG_KEY_PATH',
    },
    cpFormSgKeyPath: {
      doc:
        'Path to X.509 key used for CorpPass related communication with National Digital Identity office',
      format: String,
      default: null,
      env: 'CP_FORMSG_KEY_PATH',
    },
    spFormSgCertPath: {
      doc:
        'Path to X.509 cert used for SingPass related communication with National Digital Identity office',
      format: String,
      default: null,
      env: 'SP_FORMSG_CERT_PATH',
    },
    cpFormSgCertPath: {
      doc:
        'Path to X.509 cert used for CorpPass related communication with National Digital Identity office',
      format: String,
      default: null,
      env: 'CP_FORMSG_CERT_PATH',
    },
    spIdpCertPath: {
      doc:
        'Path to National Digital Identity offices X.509 cert used for SingPass related communication',
      format: String,
      default: null,
      env: 'SP_IDP_CERT_PATH',
    },
    cpIdpCertPath: {
      doc:
        'Path to National Digital Identity offices X.509 cert used for CorpPass related communication',
      format: String,
      default: null,
      env: 'CP_IDP_CERT_PATH',
    },
  },
}

export default spcpMyInfoFeature
