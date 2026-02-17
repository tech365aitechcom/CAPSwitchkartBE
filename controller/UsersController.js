import users from '../models/UsersModel.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import otpModel from '../models/otpModel.js'
import otpGenerator from 'otp-generator'
import transporter from '../utils/mailTransporter.js'
const filePath = './data.json'
const JWT_SECERET = process.env.JWT_SECERET
const salt = await bcrypt.genSalt()
import storeModel from '../models/storeModel.js'
import companyModel from '../models/companyModel.js'

const updateEditUsers = async (req, res, next) => {
  try {
    const id = req.body._id
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const dataToSave = {
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      state: req.body.state,
      city: req.body.city,
      role: req.body.role || 'user',
      status: req.body.status,
      password: hashedPassword,
    }

    const data = await users.findOne({ _id: req.body._id })

    if (data) {
      await users.findByIdAndUpdate(id, {
        $set: dataToSave,
      })
      return res.status(200).json({ messgae: 'users updated' })
    }

    const { name, email, phoneNumber, state, city } = req.body
    if (!name || !email || !phoneNumber || !state || !city) {
      return res.status(403).json({
        success: false,
        message: 'All fields are required',
      })
    }

    const existingUser = await users.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      })
    }

    const newUser = new users(dataToSave)
    await newUser.save()
    return res.send({ message: 'New Users Stored.' })
  } catch (error) {
    console.log(error)
    return res.status(400).json({ messgae: 'An error Occoured', error })
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await users.findOne({ email })
    if (!user) {
      return res.status(400).json({
        error: 'Please try to login with correct credentials',
      })
    }
    const store = await storeModel
      .findById(user?.storeId)
      .select('storeName')
      .select('region')

    // Fetch company data
    const company = await companyModel.findById(user?.companyId).select('name')

    // Fetch creator's name (for technician and other roles)
    let creatorName = user.managerName // Default to managerName field if exists
    if (user.createdBy) {
      const creator = await users.findById(user.createdBy).select('name')
      if (creator) {
        creatorName = creator.name
      }
    }

    console.log({ store })
    const verifyPassword = await comparePasswordAsync(password, user.password)

    if (!verifyPassword) {
      return res
        .status(400)
        .json({ status: '400', message: 'Incorrect Password' })
    }

    const authToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        storeName: store?.storeName || 'unicon',
        tokenVersion: user.tokenVersion || 0,
      },
      JWT_SECERET,
      {
        expiresIn: 86400, // 24 hours
      }
    )

    const profile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.state,
      city: user.city,
      storeName: store?.storeName,
      region: store?.region,
      address: user.address,
      companyId: company?._id,
      companyName: company?.name,
      firstName: user.firstName,
      lastName: user.lastName,
      managerName: creatorName, // Name of the user who created this account
      pincode: user.pincode,
      website: user.website,
      profileImage: user.profileImage,
      phoneNumber: user.phoneNumber,
    }
    return res.json({ authToken, profile })
  } catch (err) {
    console.log({ err })
    return res.status(400).json({ messgae: err.message })
  }
}

const handleVerifyOTP = async (req, res) => {
  try {
    const user = await users.findOne({ email: req.session.email })
    if (!user) {
      return res.status(401).send({ message: 'User not found.' })
    }
    if (req.body.otp === req.session.otp) {
      delete req.session.otp
      delete req.session.email
      user.isVerified = true
      await user.save()
      const token = jwt.sign(
        { userId: user.id, role: user.role, storeName: 'unicon' },
        JWT_SECERET,
        {
          expiresIn: 86400, // 24 hours
        }
      )
      return res.send({ token })
    } else {
      return res.status(401).send({ message: 'Invalid OTP.' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: 'Error verifying OTP.' })
  }
}

const updateUserStatus = async (req, res, next) => {
  try {
    await users.findByIdAndUpdate(
      { _id: req.body.id },
      { status: req.body.status }
    )
    return res
      .status(200)
      .json({ message: 'User status updated successfully.' })
  } catch (error) {
    return res.status(400).json({ messgae: error.message })
  }
}

//sending otp to email
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(403).json({
        success: false,
        message: 'Email is required',
      })
    }

    // Check if the email exists in the system
    const userExists = await users.findOne({ email })
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'Email not registered in our system',
      })
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    })

    await new otpModel({ email, otp }).save()

    await transporter.sendMail({
      from: process.env.MAIL,
      to: [email],
      subject: 'Verification Email',
      html: `
            <div
              style="max-width: 90%; margin: auto; padding-top: 20px;"
            >
              <br/>
              <span style="font-weight:800; display:block;">${otp} is your verification code for ${process.env.DOMAIN} .</span>
            </div>
          `,
    })

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    })
  } catch (error) {
    console.log(error.message)
    return res.status(500).json({ success: false, error: error.message })
  }
}

const verifyEmailOtp = async (req, res) => {
  try {
    const { otp, email } = req.body

    if (!otp || !email) {
      return res.status(403).json({
        success: false,
        message: 'Email and otp fields are required',
      })
    }

    const response = await otpModel
      .find({ email })
      .sort({ createdAt: -1 })
      .limit(1)
    if (response.length === 0 || otp !== response[0].otp) {
      return res.status(400).json({
        success: false,
        message: 'The OTP is not valid',
      })
    } else {
      await otpModel.deleteOne({ _id: response[0]._id })

      return res.status(200).json({
        success: true,
        message: 'Verified',
      })
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

const comparePasswordAsync = async function (candidatePassword, pass) {
  if (!pass) {
    return Promise.resolve(false)
  }
  return bcrypt.compare(candidatePassword, pass)
}

const getAllUsers = async (req, res) => {
  try {
    const data = await users.find({}).select('email name')
    return res
      .status(200)
      .json({ data, message: 'Users fetched successfully.' })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

//set password
const PasswordSet = async (req, res) => {
  try {
    const { email, newPassword } = req.body

    const user = await users.findOne({ email: email })
    if (!user) {
      return res.status(400).send('User not found.')
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    // Increment token version to invalidate all existing sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await user.save()
    return res
      .status(200)
      .send('Your password has been reset. Please login again.')
  } catch (error) {
    console.error(error)
    return res
      .status(500)
      .send('An error occurred while resetting the password.')
  }
}

export default {
  handleVerifyOTP,
  updateEditUsers,
  login,
  updateUserStatus,
  sendOTP,
  verifyEmailOtp,
  getAllUsers,
  PasswordSet,
}
