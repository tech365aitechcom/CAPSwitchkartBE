import express from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import cron from 'node-cron'
import leads from './models/leadsModel.js'
import UsersRoutes from './routes/UsersRoute.js'
import brandsRoute from './routes/brandsRoute.js'
import questionnaireRoute from './routes/questionnaireRoute.js'
import phoneConditonRote from './routes/phoneConditonRoute.js'
import gradePriceRoute from './routes/gradePriceRoute.js'
import mastersRoute from './routes/mastersRoute.js'
import leadsRoute from './routes/leadsRoute.js'
import discountsRoute from './routes/discountRoute.js'
import userDashboard from './routes/userDashboard.js'
import pendingDevicesRoute from './routes/pendingDevicesRoutes.js'
import pickupDevicesRoute from './routes/pickupDevicesRoute.js'
import leadLifecycleRoute from './routes/leadLifecycleRoute.js'
import Profile_crud from './routes/ProfileCrudRoute.js'
import outstandingRoute from './routes/outstandingRoute.js'
import userRegistryRoute from './routes/userRegistryRoute.js'
import offerRoute from './routes/offerRoute.js'
import storeRoute from './routes/storeRoute.js'
import companyRoute from './routes/companyRoute.js'
import S3Route from './routes/s3Route.js'
import transporter from './utils/mailTransporter.js'
import xlsx from 'xlsx'
import lqdPriceRoute from './routes/lqdPriceRoute.js'
import liquidatorRoute from './routes/liquidatorRoute.js'
import categoryRoute from './routes/categoryRoute.js'
import smsRoute from './routes/smsRoute.js'
import quoteLogRoute from './routes/quoteLogRoute.js'
import generateReceiptRoute from './routes/generateReceiptRoute.js'
import sangeetaconfigRoute from './routes/sangeetaconfigRoute.js'
import moduleRoute from './routes/moduleRoute.js'
import couponRoute from './routes/couponRoute.js'
import scheduleCouponExpiryCheck from './utils/scheduleCouponExpiryCheck.js'
import digilockerRoute from './routes/digilockerRoute.js'

const server = express()
dotenv.config()

// Security Headers Middleware
// Use Helmet to set various HTTP security headers
server.use(
  helmet({
    // Strict-Transport-Security: Forces HTTPS connections
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Content-Security-Policy: Prevents XSS attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // X-Frame-Options: Prevents clickjacking
    frameguard: {
      action: 'deny',
    },
    // X-Content-Type-Options: Prevents MIME sniffing
    noSniff: true,
    // Referrer-Policy: Controls referrer information
    referrerPolicy: {
      policy: 'no-referrer',
    },
    // Permissions-Policy: Controls browser features
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  }),
)

// Additional security headers not covered by Helmet
server.use((req, res, next) => {
  // Permissions-Policy header (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  )
  next()
})

server.disable('x-powered-by')

server.use(cors())
server.use(morgan('dev'))
server.use(bodyParser.urlencoded({ extended: true }))
server.use(bodyParser.json())
server.use(
  session({
    secret: 'techHelps',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }),
)

// mongoose.connect("mongodb+srv://akhil1659:akhil1659@cluster0.35ongwb.mongodb.net/", { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
const db = mongoose.connection
db.on('error', (err) => {
  console.log(err)
})

db.once('open', () => {
  console.log('Database Connected')
})

cron.schedule(
  '0 0 * * *',
  () => {
    // Run this job every day at midnight in India time
    updateStatusForDevices()
    sendReport()
  },
  {
    timezone: 'Asia/Kolkata', // Specify the timezone
  },
)

// Initialize coupon expiry scheduler
scheduleCouponExpiryCheck()

const updateStatusForDevices = async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    await leads.updateMany(
      { status: 'On Hold', updatedAt: { $lt: twentyFourHoursAgo } },
      { $set: { status: 'Available For Pickup' } },
    )
    console.log('Status updated for devices after 24 hours.')
  } catch (error) {
    console.log(error)
  }
}

async function processResults(result) {
  return result.map((item) => {
    const qnaList = {
      Core: [],
      Cosmetics: [],
      Display: [],
      Functional_major: [],
      Functional_minor: [],
      Warranty: [],
    }
    for (const section of item.QNA) {
      for (const category in section) {
        for (const question of section[category]) {
          qnaList[category].push(`${question.quetion}: ${question.key}`)
        }
      }
    }
    const qnamod = {
      Core: qnaList.Core.join(' || \n'),
      Cosmetics: qnaList.Cosmetics.join(' || \n'),
      Display: qnaList.Display.join(' || \n'),
      Functional_major: qnaList.Functional_major.join(' || \n'),
      Functional_minor: qnaList.Functional_minor.join(' || \n'),
      Warranty: qnaList.Warranty.join(' || \n'),
    }
    return {
      LeadId: item.LeadId,
      Date: item.Date,
      UserName: item.userName,
      Category: item.Category,
      ProductName: item.ProductName,
      Variant: item.variant,
      FinalPrice: item.price.toString(),
      IMEI: item.IMEI,
      UniqueId: item.uniqueCode,
      CustomerName: item.CustomerName,
      CustomerMobileNo: item.CustomerMobileNo,
      CustomerEmail: item.CustomerEmail,
      QNACore: qnamod.Core,
      QNACosmetics: qnamod.Cosmetics,
      QNADisplay: qnamod.Display,
      QNAFunMajor: qnamod.Functional_major,
      QNAFunMinor: qnamod.Functional_minor,
      QNAWarranty: qnamod.Warranty,
    }
  })
}

const docUserPipe = [
  {
    $lookup: {
      from: 'documents',
      localField: 'documentId',
      foreignField: '_id',
      as: 'document',
    },
  },
  {
    $unwind: {
      path: '$document',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
    },
  },
  {
    $unwind: {
      path: '$user',
      preserveNullAndEmptyArrays: true,
    },
  },
]

const codModPipe = [
  {
    $lookup: {
      from: 'condtioncodes',
      localField: 'gradeId',
      foreignField: '_id',
      as: 'gradeInfo',
    },
  },
  {
    $unwind: {
      path: '$gradeInfo',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'models',
      localField: 'modelId',
      foreignField: '_id',
      as: 'model',
    },
  },
  {
    $unwind: {
      path: '$model',
      preserveNullAndEmptyArrays: true,
    },
  },
]

const sendReport = async (req, res) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    const result = await leads.aggregate([
      {
        $match: { updatedAt: { $gte: twentyFourHoursAgo }, is_selled: true },
      },
      ...docUserPipe,
      ...codModPipe,
      {
        $addFields: {
          LeadId: {
            $toString: '$_id',
          },
          Date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$updatedAt',
            },
          },
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          Category: '$model.type',
          ProductName: '$model.name',
          variant: { $concat: ['$ram', '/', '$storage'] },
          IMEI: '$document.IMEI',
          CustomerName: '$name',
          CustomerMobileNo: '$phoneNumber',
          CustomerEmail: '$emailId',
        },
      },
      {
        $sort: {
          updatedAt: -1,
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          brandId: 0,
          createdAt: 0,
          documentId: 0,
          modelId: 0,
          userId: 0,
          emailId: 0,
          phoneNumber: 0,
          name: 0,
          storage: 0,
          gradeId: 0,
          reciept: 0,
          ram: 0,
          status: 0,
          updatedAt: 0,
          model: 0,
          user: 0,
          document: 0,
          gradeInfo: 0,
          actualPrice: 0,
        },
      },
    ])

    const mod = await processResults(result)

    let Message = `
    <div
      style="max-width: 90%; margin: auto; padding-top: 20px;"
    >
      <br/>
      <span style="font-weight:800; display:block;">The list of orders completed for - ${new Date(
        Date.now(),
      )}</span>
    </div>
  `
    if (mod.length === 0) {
      Message = `
    <div
      style="max-width: 90%; margin: auto; padding-top: 20px;"
    >
      <br/>
      <span style="font-weight:800; display:block;">There are 0 order completed on - ${new Date(
        Date.now(),
      )}</span>
    </div>
  `
    }
    var newWB = xlsx.utils.book_new()
    var newWS = xlsx.utils.json_to_sheet(mod)
    xlsx.utils.book_append_sheet(newWB, newWS, 'name')
    const buffer = xlsx.write(newWB, { bookType: 'xlsx', type: 'buffer' })
    const toEmails = process.env.EMAILS
      ? process.env.EMAILS.split(',').map((email) => email.trim())
      : []
    await transporter.sendMail({
      from: 'jayant@365aitech.com',
      to: toEmails,
      subject: 'Grest C2B(Lambda tradin) Order Completed Report',
      attachments: [
        {
          filename: 'leads_report.xlsx',
          content: buffer,
        },
      ],
      html: Message,
    })
    console.log('email sent successfully')
  } catch (error) {
    console.log(error.message)
    return
  }
}

if (process.env.ENVIRONMENT !== 'lambda') {
  const PORT = process.env.PORT || 3000

  server.listen(PORT, () => {
    console.log(`Sever running on port: ${PORT}`)
  })
}

server.get('/test123', (req, res) => {
  res.send('test successful')
})
server.use('/upload', express.static('upload'))
server.use('/api/users', UsersRoutes)
server.use('/api/s3', S3Route)
server.use('/api/category', categoryRoute)
server.use('/api/brands', brandsRoute)
server.use('/api/questionnaires', questionnaireRoute)
server.use('/api/conditions', phoneConditonRote)
server.use('/api/grades', gradePriceRoute)
server.use('/api/masters', mastersRoute)
server.use('/api/prospects', leadsRoute)
server.use('/api/discounts', discountsRoute)
server.use('/api/user/Dashboard', userDashboard)
server.use('/api/pendingDevices', pendingDevicesRoute)
server.use('/api/pickupDevices', pickupDevicesRoute)
server.use('/api/leadSet', leadLifecycleRoute)
server.use('/api/profile', Profile_crud)
server.use('/api/outstanding', outstandingRoute)
server.use('/api/userregistry', userRegistryRoute)
server.use('/api/offer', offerRoute)
server.use('/api/store', storeRoute)
server.use('/api/company', companyRoute)
server.use('/api/liquidators', liquidatorRoute)
server.use('/api/lqdprices', lqdPriceRoute)
server.use('/api/sms', smsRoute)
server.use('/api/receipt', generateReceiptRoute)
server.use('/api/quoteTracking', quoteLogRoute)
server.use('/api/store-config', sangeetaconfigRoute)
server.use('/api/coupons', couponRoute)
server.use('/api/digilocker', digilockerRoute)
server.use('/api/module', moduleRoute)

server.get('/', (req, res) => {
  res.send('Welcome to the API!')
})
export default server
