'use strict'

const config = require('../../config/config')
const formsgSdk = require('../../config/formsg-sdk')
const { isEmpty } = require('lodash')

const mongoose = require('mongoose')
const crypto = require('crypto')
const HttpStatus = require('http-status-codes')
const axios = require('axios')

const { getRequestIp } = require('../utils/request')
const logger = require('../../config/logger').createLoggerWithLabel('spcp')
const { mapDataToKey } = require('../../shared/util/verified-content')
const getFormModel = require('../models/form.server.model').default
const getLoginModel = require('../models/login.server.model').default
const Form = getFormModel(mongoose)
const Login = getLoginModel(mongoose)

const jwtNames = {
  SP: 'jwtSp',
  CP: 'jwtCp',
}
const destinationRegex = /^\/([\w]+)\/?/

const addLoginToDB = function (form) {
  let login = new Login({
    form: form._id,
    admin: form.admin._id,
    agency: form.admin.agency._id,
    authType: form.authType,
    esrvcId: form.esrvcId,
  })
  return login.save().catch((err) => {
    logger.error('Error adding login to database:', err)
  })
}

const getForm = function (destination, cb) {
  let formId = destinationRegex.exec(destination)[1]
  Form.findById({ _id: formId })
    .populate({
      path: 'admin',
      populate: {
        path: 'agency',
        model: 'Agency',
      },
    })
    .exec(cb)
}

const destinationIsValid = function (destination) {
  // Parse formId from the string
  // e.g. "/5b9b5fcfdb4da66ef52b73b3/preview" -> "5b9b5fcfdb4da66ef52b73b3"
  // with or without "/preview"
  if (!destination || !destinationRegex.test(destination)) {
    return false
  }
  return true
}

const isArtifactValid = function (idpPartnerEntityIds, samlArt, authType) {
  // Artifact should be 44 bytes long, of type 0x0004 and
  // source id should be SHA-1 hash of the issuer's entityID
  let hexEncodedArtifact = Buffer.from(samlArt, 'base64').toString('hex')
  let artifactHexLength = hexEncodedArtifact.length
  let typeCode = parseInt(hexEncodedArtifact.substr(0, 4))
  let sourceId = hexEncodedArtifact.substr(8, 40)
  let hashedEntityId = crypto
    .createHash('sha1')
    .update(idpPartnerEntityIds[authType], 'utf8')
    .digest('hex')

  return (
    artifactHexLength === 88 && typeCode === 4 && sourceId === hashedEntityId
  )
}

const isValidAuthenticationQuery = (
  destination,
  idpPartnerEntityIds,
  samlArt,
  authType,
) => {
  return (
    destination &&
    isArtifactValid(idpPartnerEntityIds, samlArt, authType) &&
    destinationRegex.test(destination)
  )
}

const handleOOBAuthenticationWith = (ndiConfig, authType, extractUser) => {
  const {
    authClients,
    cpCookieMaxAge,
    spCookieMaxAgePreserved,
    spCookieMaxAge,
    spcpCookieDomain,
    idpPartnerEntityIds,
  } = ndiConfig
  return function (req, res) {
    let authClient = authClients[authType] ? authClients[authType] : undefined
    let jwtName = jwtNames[authType]
    let { SAMLart: samlArt, RelayState: relayState } = req.query
    const payloads = String(relayState).split(',')

    if (payloads.length !== 2) {
      return res.status(HttpStatus.BAD_REQUEST).send()
    }

    const destination = payloads[0]
    const rememberMe = payloads[1] === 'true'

    if (
      !isValidAuthenticationQuery(
        destination,
        idpPartnerEntityIds,
        samlArt,
        authType,
      )
    ) {
      res.status(HttpStatus.UNAUTHORIZED).send()
      return
    }

    // Resolve known express req.query issue where pluses become spaces
    samlArt = String(samlArt).replace(/ /g, '+')

    if (!destinationIsValid(destination))
      return res.status(HttpStatus.BAD_REQUEST).send()

    getForm(destination, (err, form) => {
      if (err || !form || form.authType !== authType) {
        res.status(HttpStatus.NOT_FOUND).send()
        return
      }
      authClient.getAttributes(samlArt, destination, (err, data) => {
        if (err) {
          logger.error(getRequestIp(req), req.url, req.headers, err)
        }
        const { attributes } = data
        const { userName, userInfo } = extractUser(attributes)
        if (userName && destination) {
          // Create JWT
          let payload = {
            userName,
            userInfo,
            rememberMe,
          }

          let cookieDuration
          if (authType === 'CP') {
            cookieDuration = cpCookieMaxAge
          } else {
            cookieDuration = rememberMe
              ? spCookieMaxAgePreserved
              : spCookieMaxAge
          }

          let jwt = authClient.createJWT(
            payload,
            cookieDuration / 1000,
            // NOTE: cookieDuration is interpreted as a seconds count if numeric.
          )
          // Add login to DB
          addLoginToDB(form).then(() => {
            const spcpSettings = spcpCookieDomain
              ? { domain: spcpCookieDomain, path: '/' }
              : {}
            // Redirect to form
            res.cookie(jwtName, jwt, {
              maxAge: cookieDuration,
              httpOnly: false, // the JWT needs to be read by client-side JS
              sameSite: 'lax', // Setting to 'strict' prevents Singpass login on Safari, Firefox
              secure: !config.isDev,
              ...spcpSettings,
            })
            res.redirect(destination)
          })
        } else if (destination) {
          res.cookie('isLoginError', true)
          res.redirect(destination)
        } else {
          res.redirect('/')
        }
      })
    })
  }
}

/**
 * Generates redirect URL to Official SingPass/CorpPass log in page
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 * @param  {function} next - Express next function
 */
exports.createSpcpRedirectURL = (authClients) => {
  return (req, res, next) => {
    const { target, authType, esrvcId } = req.query
    let authClient = authClients[authType] ? authClients[authType] : undefined
    if (target && authClient && esrvcId) {
      req.redirectURL = authClient.createRedirectURL(target, esrvcId)
      return next()
    } else {
      return res.status(HttpStatus.BAD_REQUEST).send('Redirect URL malformed')
    }
  }
}

exports.returnSpcpRedirectURL = function (req, res) {
  return res.status(HttpStatus.OK).send({ redirectURL: req.redirectURL })
}

const getSubstringBetween = (text, markerStart, markerEnd) => {
  const start = text.indexOf(markerStart)
  if (start === -1) {
    return null
  } else {
    const end = text.indexOf(markerEnd, start)
    return end === -1 ? null : text.substring(start + markerStart.length, end)
  }
}

exports.validateESrvcId = (req, res) => {
  let { redirectURL } = req
  let validateUrl = redirectURL

  axios
    .get(validateUrl, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
      },
      timeout: 10000, // 10 seconds
      // Throw error if not status 200.
      validateStatus: (status) => status === HttpStatus.OK,
    })
    .then(({ data }) => {
      // The successful login page should have the title 'SingPass Login'
      // The error page should have the title 'SingPass - System Error Page'
      const title = getSubstringBetween(data, '<title>', '</title>')
      if (title === null) {
        logger.error({ Error: 'Could not find title', redirectURL, data })
        return res.status(HttpStatus.BAD_GATEWAY).send({
          message: 'Singpass returned incomprehensible content',
        })
      }
      if (title.indexOf('Error') === -1) {
        return res.status(HttpStatus.OK).send({
          isValid: true,
        })
      }

      // The error page should have text like 'System Code:&nbsp<b>138</b>'
      const errorCode = getSubstringBetween(
        data,
        'System Code:&nbsp<b>',
        '</b>',
      )
      return res.status(HttpStatus.OK).send({
        isValid: false,
        errorCode,
      })
    })
    .catch((err) => {
      const { statusCode } = err.response || {}
      logger.error({
        Error: 'Could not contact singpass to validate eservice id',
        redirectURL,
        err,
        statusCode,
      })
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
        message: 'Failed to contact Singpass',
      })
    })
}

/**
 * Assertion Consumer Endpoint - Authenticates form-filler with SingPass and creates session
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 */
exports.singPassLogin = (ndiConfig) => {
  return handleOOBAuthenticationWith(ndiConfig, 'SP', (attributes) => {
    let userName = attributes && attributes.UserName
    return userName ? { userName } : {}
  })
}

/**
 * Assertion Consumer Endpoint - Authenticates form-filler with CorpPass and creates session
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 */
exports.corpPassLogin = (ndiConfig) => {
  return handleOOBAuthenticationWith(ndiConfig, 'CP', (attributes) => {
    let userName =
      attributes && attributes.UserInfo && attributes.UserInfo.CPEntID
    let userInfo =
      attributes && attributes.UserInfo && attributes.UserInfo.CPUID
    return userName && userInfo ? { userName, userInfo } : {}
  })
}

/**
 * Adds session to returned JSON if form-filler is SPCP Authenticated
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 * @param  {Object} next - Express next middleware function
 */
exports.addSpcpSessionInfo = (authClients) => {
  return (req, res, next) => {
    const { authType } = req.form
    let authClient = authClients[authType] ? authClients[authType] : undefined
    let jwtName = jwtNames[authType]
    let jwt = req.cookies[jwtName]
    if (authType && authClient && jwt) {
      // add session info if logged in
      authClient.verifyJWT(jwt, (err, payload) => {
        if (err) {
          // Do not specify userName to call MyInfo endpoint with if jwt is invalid
          // Client will inform the form-filler to log in with SingPass again
          logger.error(getRequestIp(req), req.url, req.headers, err)
        } else {
          const { userName } = payload
          // For use in addMyInfo middleware
          res.locals.spcpSession = {
            userName: userName,
          }
        }
        return next()
      })
    } else {
      return next()
    }
  }
}

/**
 * Get MyInfo attributes that are requested in this particular submission
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 */
exports.getRequestedAttributes = function (req, res, next) {
  const { form } = req
  res.locals.requestedAttributes = form.getUniqMyinfoAttrs() || []
  return next()
}

/**
 * Encrypt and sign verified fields if exist
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 */
exports.encryptedVerifiedFields = (signingSecretKey) => {
  return (req, res, next) => {
    const authType = req.form && req.form.authType
    // Early return if this is not a Singpass/Corppass submission.
    if (!authType) return next()

    const verifiedContent = mapDataToKey({ type: authType, data: res.locals })

    if (isEmpty(verifiedContent)) return next()

    try {
      const encryptedVerified = formsgSdk.crypto.encrypt(
        verifiedContent,
        req.form.publicKey,
        signingSecretKey,
      )

      res.locals.verified = encryptedVerified
      return next()
    } catch (error) {
      logger.error(
        `Error 400 - Unable to encrypt verified content: formId=${
          req.form._id
        } error='${error}' ip=${getRequestIp(req)}`,
      )
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Invalid data was found. Please submit again.' })
    }
  }
}

/**
 * Append additional verified responses(s) for SP and CP responses so that they show up in email response
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 */
exports.appendVerifiedSPCPResponses = function (req, res, next) {
  const { form } = req
  const { uinFin, userInfo } = res.locals
  switch (form.authType) {
    case 'SP':
      req.body.parsedResponses.push({
        question: 'SingPass Validated NRIC',
        fieldType: 'authenticationSp',
        isVisible: true,
        answer: uinFin,
      })
      break
    case 'CP':
      // Add UEN to responses
      req.body.parsedResponses.push({
        question: 'CorpPass Validated UEN',
        fieldType: 'authenticationCp',
        isVisible: true,
        answer: uinFin,
      })
      // Add UID to responses
      req.body.parsedResponses.push({
        question: 'CorpPass Validated UID',
        fieldType: 'authenticationCp',
        isVisible: true,
        answer: userInfo,
      })
      break
  }
  return next()
}

/**
 * Checks if user is SPCP-authenticated before allowing submission
 * @param  {Object} req - Express request object
 * @param  {Object} res - Express response object
 * @param  {Object} next - Express next middleware function
 */
exports.isSpcpAuthenticated = (authClients) => {
  return (req, res, next) => {
    const { authType } = req.form
    let authClient = authClients[authType] ? authClients[authType] : undefined
    if (authType && authClient) {
      // form requires spcp authentication
      let jwtName = jwtNames[authType]
      let jwt = req.cookies[jwtName]
      authClient.verifyJWT(jwt, (err, payload) => {
        if (err) {
          logger.error(getRequestIp(req), req.url, req.headers, err)
          res.status(HttpStatus.UNAUTHORIZED).send({
            message: 'User is not SPCP authenticated',
            spcpSubmissionFailure: true,
          })
        } else {
          res.locals.uinFin = payload.userName
          res.locals.userInfo = payload.userInfo
          return next()
        }
      })
    } else {
      // form does not require spcp authentication
      return next()
    }
  }
}
