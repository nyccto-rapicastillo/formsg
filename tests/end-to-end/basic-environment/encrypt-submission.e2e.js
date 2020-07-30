const {
  makeMongooseFixtures,
  makeModel,
  deleteDocById,
  createForm,
  getOptionalVersion,
  getBlankVersion,
  verifySubmissionDisabled,
} = require('../helpers/util')
const {
  verifySubmissionE2e,
  clearDownloadsFolder,
} = require('../helpers/encrypt-mode')
const { allFields } = require('../helpers/all-fields')
const {
  hiddenFieldsData,
  hiddenFieldsLogicData,
} = require('../helpers/all-hidden-form')
const chainDisabled = require('../helpers/disabled-form-chained')

const { cloneDeep } = require('lodash')
const aws = require('aws-sdk')

let User
let Form
let Agency
let govTech
let db

fixture('[Basic] Storage mode submissions')
  .before(async () => {
    db = await makeMongooseFixtures()
    Agency = makeModel(db, 'agency.server.model', 'Agency')
    User = makeModel(db, 'user.server.model', 'User')
    Form = makeModel(db, 'form.server.model', 'Form')
    govTech = await Agency.findOne({ shortName: 'govtech' }).exec()

    // Create s3 bucket for attachments
    const s3 = new aws.S3({
      endpoint: process.env.FORMSG_LOCALSTACK_ENDPT,
      s3ForcePathStyle: true,
    })
    await s3
      .createBucket({ Bucket: process.env.ATTACHMENT_S3_BUCKET })
      .promise()
  })
  .after(async () => {
    // Delete models defined by mongoose and close connection
    db.models = {}
    await db.close()
  })
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 800)
  })
  .afterEach(async (t) => {
    await deleteDocById(User, t.ctx.formData.user._id)
    await deleteDocById(Form, t.ctx.form._id)
    // Clear used files
    clearDownloadsFolder(t.ctx.form.title, t.ctx.form._id)
  })

// Form with all field types available in storage mode
test.before(async (t) => {
  const formData = await getDefaultFormOptions()
  formData.formFields = cloneDeep(allFields)
  t.ctx.formData = formData
})('Create and submit form with all field types', async (t) => {
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData)
})

// Form where all basic field types are hidden by logic
test.before(async (t) => {
  const formData = await getDefaultFormOptions()
  formData.formFields = cloneDeep(hiddenFieldsData)
  formData.logicData = cloneDeep(hiddenFieldsLogicData)
  t.ctx.formData = formData
})('Create and submit form with all field types hidden', async (t) => {
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData)
})

// Form where all fields are optional and no field is answered
test.before(async (t) => {
  const formData = await getDefaultFormOptions()
  formData.formFields = allFields.map((field) => {
    return getBlankVersion(getOptionalVersion(field))
  })
  t.ctx.formData = formData
})('Create and submit form with all field types optional', async (t) => {
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionE2e(t, t.ctx.form, t.ctx.formData)
})

// Form where submission is prevented using chained logic
test.before(async (t) => {
  const formData = await getDefaultFormOptions()
  formData.formFields = cloneDeep(chainDisabled.fields)
  formData.logicData = cloneDeep(chainDisabled.logicData)
  t.ctx.formData = formData
})('Create and disable form with chained logic', async (t) => {
  t.ctx.form = await createForm(t, t.ctx.formData, Form)
  await verifySubmissionDisabled(
    t,
    t.ctx.form,
    t.ctx.formData,
    chainDisabled.toastMessage,
  )
})

// Creates an object with default encrypt-mode form options, with optional modifications.
// Note that a new user needs to be created for each test, otherwise the extractOTP function
// may get the wrong OTP due to a concurrency issue where it grabs the wrong email from the
// user inbox.
const getDefaultFormOptions = async ({
  title = 'Submission e2e Form',
  authType = 'NIL',
  status = 'PUBLIC',
  esrvcId = '',
} = {}) => {
  title += String(Date.now())
  const user = await User.create({
    email: String(Date.now()) + '@data.gov.sg',
    agency: govTech._id,
  })
  return {
    user,
    formOptions: {
      responseMode: 'encrypt',
      hasCaptcha: false,
      status,
      title,
      authType,
      esrvcId,
    },
  }
}
