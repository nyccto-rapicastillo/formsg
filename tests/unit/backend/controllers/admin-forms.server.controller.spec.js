const HttpStatus = require('http-status-codes')
const mongoose = require('mongoose')

const dbHandler = require('../helpers/db-handler')
const roles = require('../helpers/roles')

const User = dbHandler.makeModel('user.server.model', 'User')
const Form = dbHandler.makeModel('form.server.model', 'Form')
const FormFeedback = dbHandler.makeModel(
  'form_feedback.server.model',
  'FormFeedback',
)
const EmailForm = mongoose.model('email')

const Controller = spec(
  'dist/backend/app/controllers/admin-forms.server.controller',
).makeModule(mongoose)

describe('Admin-Forms Controller', () => {
  // Declare global variables
  let req
  let res
  let testForm
  let testAgency
  let testUser

  beforeAll(async () => await dbHandler.connect())
  beforeEach(async () => {
    res = jasmine.createSpyObj('res', ['status', 'send', 'json'])
    const collections = await dbHandler.preloadCollections()

    testUser = collections.user
    testAgency = collections.agency
    testForm = collections.form

    req = {
      query: {},
      params: {},
      body: {},
      session: {
        user: {
          _id: testUser._id,
          email: testUser.email,
        },
      },
      headers: {},
      ip: '127.0.0.1',
    }
  })

  afterEach(async () => await dbHandler.clearDatabase())
  afterAll(async () => await dbHandler.closeDatabase())

  describe('isFormActive', () => {
    it('should return 404 if form is archived', () => {
      let req = { form: { status: 'ARCHIVED' }, headers: {}, ip: '127.0.0.1' }
      res.status.and.callFake(function () {
        return this
      })
      res.send.and.callFake(function () {
        return this
      })
      Controller.isFormActive(req, res, () => {})
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
    })

    it('should pass on to the next middleware if not archived', () => {
      let req = { form: { status: 'PUBLIC' }, headers: {}, ip: '127.0.0.1' }
      let next = jasmine.createSpy()
      Controller.isFormActive(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('isFormEncryptMode', () => {
    let next
    beforeEach(() => {
      req.form = testForm
      res.status.and.callFake(() => res)
      next = jasmine.createSpy()
    })
    it('should reject forms that are not encrypt mode', () => {
      req.form.responseMode = 'email'
      Controller.isFormEncryptMode(req, res, next)
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    })
    it('should accept forms that are encrypt mode', () => {
      req.form.responseMode = 'encrypt'
      Controller.isFormEncryptMode(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('should successfully save a Form object with user defined fields', (done) => {
      let expected = {
        title: 'form_title',
        emails: ['email@hello.gov.sg', 'user@byebye.gov.sg'],
      }
      req.body.form = _.cloneDeep(expected)

      // Check for user-defined fields
      res.json.and.callFake((args) => {
        let returnObj = args.toObject()
        expect(returnObj.title).toEqual(expected.title)
        expect(returnObj.emails).toEqual(expected.emails)
        expect(returnObj.admin.toString()).toEqual(
          req.session.user._id.toString(),
        )
        Form.findOne({ title: expected.title }, (err, foundForm) => {
          if (err || !foundForm) {
            done(err || new Error('Form not saved'))
          } else {
            done()
          }
        })
      })
      Controller.create(req, res)
    })

    it('should return 400 error when form param not supplied', (done) => {
      req.body.form = null
      res.status.and.callFake(() => {
        expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
        done()
        return res
      })
      Controller.create(req, res)
    })

    it('should return 405 error when saving a Form object with invalid fields', (done) => {
      req.body.form = { title: 'bad_form', emails: 'wrongemail.com' }
      res.status.and.callFake(() => {
        expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
        done()
        return res
      })
      Controller.create(req, res)
    })
  })

  describe('update', () => {
    it('should successfully update a Form object with new fields', (done) => {
      let expected = {
        title: 'form_title2',
        startPage: {
          colorTheme: 'blue',
          estTimeTaken: 1,
        },
        permissionList: [],
      }
      req.form = testForm
      req.body.form = _.cloneDeep(expected)
      // Check for user-defined fields
      res.json.and.callFake(() => {
        Form.findOne({ _id: req.form._id }, (err, updatedForm) => {
          expect(err).not.toBeTruthy()
          let updatedFormObj = updatedForm.toObject()
          expect(updatedFormObj.title).toEqual(expected.title)
          expect(updatedFormObj.startPage).toEqual(expected.startPage)
          done()
        })
      })
      Controller.update(req, res)
    })

    it('should return 405 error when updating a Form object with invalid fields', (done) => {
      req.form = testForm
      req.body.form = {
        title: 'form_title3',
        startPage: {
          colorTheme: 'wrong_color',
          estTimeTaken: 1,
        },
        permissionList: [],
      }
      res.status.and.callFake(() => {
        expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
        done()
        return res
      })
      Controller.update(req, res)
    })
  })

  describe('delete', () => {
    it('should delete from by setting status to archived', (done) => {
      req.form = testForm
      res.json.and.callFake(() => {
        Form.findOne({ _id: testForm._id }, (err, foundForm) => {
          if (err || !foundForm) {
            done(err || new Error('Form not found'))
          } else {
            let foundFormObj = foundForm.toObject()
            expect(foundFormObj.status).toEqual('ARCHIVED')
            done()
          }
        })
      })
      Controller.delete(req, res)
    })
  })

  describe('duplicate', () => {
    it('should duplicate form with correct title, new admin and no collaborators', async (done) => {
      // Insert collaborator into User collection before duplicating form.
      const collabAdmin = await User.create({
        email: 'test1@test.gov.sg',
        _id: mongoose.Types.ObjectId('000000000002'),
        agency: testAgency._id,
      })

      let collaboratedForm = new EmailForm({
        title: 'Form to duplicate',
        emails: 'test1@test.gov.sg',
        admin: collabAdmin._id,
        permissionList: [roles.collaborator(testUser.email)],
      })
      req.form = collaboratedForm
      // Passed in create-form-modal.client.controller
      req.body.emails = testUser.email
      req.body.title = 'Form to duplicate_3'

      collaboratedForm.save().then(() => {
        res.json.and.callFake((args) => {
          expect(args.title).toEqual(collaboratedForm.title + '_' + 3)
          Form.findOne({ _id: args._id }, (err, foundForm) => {
            if (!err) {
              let duplicatedForm = foundForm.toObject()
              expect(duplicatedForm.admin.toString()).toEqual(
                req.session.user._id.toString(),
              )
              expect(duplicatedForm.permissionList).toEqual([])
            }
            done(err)
          })
        })
        Controller.duplicate(req, res)
      })
    })
  })

  describe('list', () => {
    it('should fetch forms with corresponding admin or collaborators and sorted by last modified', async (done) => {
      const currentAdmin = testUser
      // Insert additional user into User collection.
      const collabAdmin = await User.create({
        email: 'test1@test.gov.sg',
        _id: mongoose.Types.ObjectId('000000000002'),
        agency: testAgency._id,
      })
      // Is admin
      let form1 = new Form({
        title: 'Test Form1',
        emails: currentAdmin.email,
        admin: currentAdmin._id,
      }).save()
      // Is collab
      let form2 = new Form({
        title: 'Test Form2',
        emails: collabAdmin.email,
        admin: collabAdmin._id,
        permissionList: [roles.collaborator(currentAdmin.email)],
      }).save()
      // Should not be fetched since archived
      let form3 = new Form({
        title: 'Test Form3',
        emails: currentAdmin.email,
        admin: currentAdmin._id,
        status: 'ARCHIVED',
      }).save()
      // This form should not be fetched (not collab or admin)
      let form4 = new Form({
        title: 'Test Form3',
        emails: currentAdmin.email,
        admin: collabAdmin._id,
        permissionList: [roles.collaborator('nofetch@test.gov.sg')],
      }).save()

      Promise.all([form1, form2, form3, form4])
        .then(() => {
          res.json.and.callFake((args) => {
            let times = args.map((f) => f.lastModified)
            // Should be sorted by last modified in descending order
            expect(times).toEqual(
              times.sort((a, b) => {
                return b - a
              }),
            )
            // 3 forms to be fetched
            expect(args.length).toEqual(3)
            done()
          })
          Controller.list(req, res)
        })
        .catch((err) => {
          done(err)
        })
    })
  })

  describe('getFeedback', () => {
    it('should retrieve correct response based on saved FormFeedbacks', (done) => {
      // Define feedback to be added to MongoMemoryServer db
      let p1 = new FormFeedback({
        formId: mongoose.Types.ObjectId('4edd40c86762e0fb12000003'),
        rating: 2,
        comment: 'nice',
        created: '2018-05-18 09:12:07.126Z',
      }).save()
      let p2 = new FormFeedback({
        formId: mongoose.Types.ObjectId('4edd40c86762e0fb12000003'),
        rating: 5,
        comment: 'great',
        created: '2018-03-15 03:52:07.126Z',
      }).save()

      Promise.all([p1, p2]).then(([_r1, _r2]) => {
        req.form = { _id: '4edd40c86762e0fb12000003' }
        let expected = {
          average: '3.50',
          count: 2,
          feedback: [
            {
              index: 2,
              timestamp: 1526634727126,
              rating: 2,
              comment: 'nice',
              date: '18 May 2018',
              dateShort: '18 May',
            },
            {
              index: 1,
              timestamp: 1521085927126,
              rating: 5,
              comment: 'great',
              date: '15 Mar 2018',
              dateShort: '15 Mar',
            },
          ],
        }
        res.json.and.callFake((args) => {
          expect(args.average).toEqual(expected.average)
          expect(args.count).toEqual(expected.count)
          expect(args.feedback.length).toEqual(2)
          expect(args.feedback).toContain(expected.feedback[0])
          expect(args.feedback).toContain(expected.feedback[1])
          done()
        })
        Controller.getFeedback(req, res)
      })
    })
  })
})
