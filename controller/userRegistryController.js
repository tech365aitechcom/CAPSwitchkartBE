import userRegistry from '../models/UsersModel.js'
import bcrypt from 'bcryptjs'
import { BulkUserUpload, BulkUserUploadLog } from '../models/BulkUploadModel.js'
import mongoose from 'mongoose'
import companyModel from '../models/companyModel.js'
import storeModel from '../models/storeModel.js'
import { parseFile } from '../utils/fileParsingUtils.js'
import { processRows } from './bulkUserUploadHelpers.js'

const ISE = 'Internal Server Error'

const roleSaleUser = 'Sale User'
const roleSales = 'Sales'
const roleTechnician = 'Technician'
const roleManager = 'Manager'
const roleAdmin = 'Admin'
const roleAdminManager = 'Admin Manager'
const roleCompanyAdmin = 'Company Admin'
const superAdmin = 'Super Admin'

const PASSWORD_MIN_LENGTH = 6
const BULK_PASSWORD_MIN_LENGTH = 6

// Query field selections (used multiple times)
const SELECT_ROLE_COMPANY = 'role companyId'
const SELECT_COMPANY_ROLE = 'companyId role'
const SELECT_COMPANY_CREATED_BY = 'companyId createdBy'
const SELECT_USER_SCOPE = 'role storeId companyId assignedStores'
const USER_ROLES = [
  roleAdminManager,
  roleTechnician,
  roleSaleUser,
  roleAdmin,
  roleCompanyAdmin,
  roleManager,
  roleSales,
]

// Roles with assigned stores (for filtering)
const ROLES_WITH_ASSIGNED_STORES = [roleAdminManager, roleTechnician]

// Error messages
const ERROR_MSGS = {
  INVALID_COMPANY_ID: 'Invalid companyId format',
  FORBIDDEN_DIFFERENT_COMPANY:
    'Forbidden: Cannot search users from another company',
  NOT_ASSIGNED_TO_STORE: 'User not assigned to a store.',
  FORBIDDEN_USER_NOT_FOUND: 'Forbidden: User not found.',
}

// ---------------- Helper Functions ----------------
// Helper to validate store assignment for user creation
const validateStoreAssignment = async (
  storeId,
  assignedStores,
  role,
  companyId
) => {
  const shouldUseAssignedStores = ROLES_WITH_ASSIGNED_STORES.includes(role)

  // Validate storeId if provided and role doesn't use assignedStores
  if (storeId && !shouldUseAssignedStores) {
    const store = await storeModel.findOne({
      _id: storeId,
      companyId: companyId,
    })
    if (!store) {
      return {
        error: 'Store does not belong to this company or does not exist',
      }
    }
  }

  // Validate assigned stores belong to the same company
  let validatedAssignedStores = []
  if (
    shouldUseAssignedStores &&
    assignedStores &&
    Array.isArray(assignedStores) &&
    assignedStores.length > 0
  ) {
    const stores = await storeModel.find({
      _id: { $in: assignedStores },
      companyId: companyId,
    })

    if (stores.length !== assignedStores.length) {
      return {
        error:
          'Some assigned stores do not belong to this company or do not exist',
      }
    }
    validatedAssignedStores = assignedStores
  }

  return { shouldUseAssignedStores, validatedAssignedStores }
}

// Helper to check if Company Admin already exists
const validateCompanyAdminUniqueness = async (role, companyId) => {
  if (role !== roleCompanyAdmin) {
    return null
  }

  const existingCompanyAdmin = await userRegistry.findOne({
    companyId: companyId,
    role: roleCompanyAdmin,
  })

  if (existingCompanyAdmin) {
    return 'A Company Admin already exists for this company. Only one Company Admin is allowed per company.'
  }

  return null
}

// Helper to validate required fields for user creation
const validateUserCreationFields = (
  companyId,
  email,
  password,
  role,
  phoneNumber
) => {
  if (!companyId || !email || !password || !role || !phoneNumber) {
    return 'companyId, email, password, role, and phoneNumber are required'
  }
  return null
}

// Helper to validate company scoping for user creation
const validateCompanyScoping = (companyId, loggedInUser) => {
  if (loggedInUser && loggedInUser.role !== superAdmin) {
    if (companyId.toString() !== loggedInUser.companyId.toString()) {
      return 'Cannot create user for another company'
    }
  }
  return null
}

// Helper to validate role is allowed
const validateRoleAllowed = (role) => {
  if (!USER_ROLES.includes(role)) {
    return 'Cannot Assign This Role Out of Scope'
  }
  return null
}

// Helper to validate user doesn't already exist
const validateUserDoesNotExist = async (email) => {
  const existingUser = await userRegistry.findOne({ email })
  if (existingUser) {
    return 'User exists already, please login instead.'
  }
  return null
}

// Helper to validate password length
const validatePasswordLength = (password) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'Password size is very too small'
  }
  return null
}

// Helper to check edit permissions
const checkEditPermission = (loggedInUser, existingUser) => {
  // Super Admin can edit anyone
  if (loggedInUser.role === superAdmin) {
    return null
  }

  // Admin Manager and Company Admin can edit users they created
  const canEditAsCreator =
    (loggedInUser.role === roleAdminManager ||
      loggedInUser.role === roleCompanyAdmin) &&
    existingUser.createdBy &&
    existingUser.createdBy.toString() === loggedInUser._id.toString()

  if (canEditAsCreator) {
    return null
  }

  // Check company scoping
  if (existingUser.companyId.toString() !== loggedInUser.companyId.toString()) {
    return 'Cannot edit user from another company'
  }

  // Check if they have permission to edit users they didn't create
  if (
    existingUser.createdBy &&
    existingUser.createdBy.toString() !== loggedInUser._id.toString()
  ) {
    return 'You can only edit users you created'
  }

  return null
}

// Helper to apply company scoping to pipeline
const applyCompanyScopingToPipeline = (
  pipeline,
  loggedInUser,
  isSuperAdmin
) => {
  if (!isSuperAdmin && loggedInUser.companyId) {
    pipeline.unshift({ $match: { companyId: loggedInUser.companyId } })
  }
}

// Helper to check company scoping for user operations
const validateUserCompanyScoping = (
  targetCompanyId,
  loggedInUserCompanyId,
  isSuperAdmin
) => {
  if (isSuperAdmin) {
    return null
  }
  if (targetCompanyId.toString() !== loggedInUserCompanyId.toString()) {
    return 'Cannot perform operation on user from another company'
  }
  return null
}

// Helper to build upload filter for company scoping
const buildUploadFilterByCompany = async (loggedInUser, isSuperAdmin) => {
  if (isSuperAdmin) {
    return {}
  }
  // For Company Admin, filter by company users
  const companyUsers = await userRegistry
    .find({ companyId: loggedInUser.companyId })
    .select('_id')
  return { uploadedBy: { $in: companyUsers.map((u) => u._id) } }
}

// Helper to build base user aggregation pipeline with store and company lookups
const buildBaseUserPipeline = (loggedInUserId, includeUserId = false) => {
  const pipeline = [
    { $match: { role: { $in: USER_ROLES }, _id: { $ne: loggedInUserId } } },
  ]

  if (includeUserId) {
    pipeline.push({ $addFields: { tempUserId: { $toString: '$_id' } } })
  }

  pipeline.push(
    {
      $lookup: {
        from: 'stores',
        localField: 'storeId',
        foreignField: '_id',
        as: 'stores',
      },
    },
    { $unwind: { path: '$stores', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'stores',
        localField: 'assignedStores',
        foreignField: '_id',
        as: 'assignedStoresData',
      },
    },
    {
      $lookup: {
        from: 'companies',
        localField: 'companyId',
        foreignField: '_id',
        as: 'companyData',
      },
    },
    { $unwind: { path: '$companyData', preserveNullAndEmptyArrays: true } }
  )

  return pipeline
}

// Helper to apply user scoping to pipeline based on role
const applyUserScopingToPipeline = (pipeline, loggedInUser, isSuperAdmin) => {
  if (isSuperAdmin) {
    return null
  }

  if (loggedInUser.role === roleCompanyAdmin) {
    pipeline.unshift({
      $match: { companyId: loggedInUser.companyId },
    })
    return null
  }

  if (ROLES_WITH_ASSIGNED_STORES.includes(loggedInUser.role)) {
    if (loggedInUser.assignedStores && loggedInUser.assignedStores.length > 0) {
      pipeline.unshift({
        $match: {
          $or: [
            { storeId: { $in: loggedInUser.assignedStores } },
            { assignedStores: { $in: loggedInUser.assignedStores } },
          ],
        },
      })
      return null
    }
  }

  if (loggedInUser.storeId) {
    pipeline.unshift({ $match: { storeId: loggedInUser.storeId } })
    return null
  }

  // No access - return empty indicator
  return { isEmpty: true }
}

// Helper to validate and apply company filter
const validateAndApplyCompanyFilter = (
  companyId,
  loggedInUser,
  isSuperAdmin,
  pipeline,
  res
) => {
  if (!companyId) {
    return null
  }

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return res.status(400).json({ msg: ERROR_MSGS.INVALID_COMPANY_ID })
  }

  if (!isSuperAdmin && companyId !== loggedInUser.companyId.toString()) {
    return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_DIFFERENT_COMPANY })
  }

  const companyObjectId = new mongoose.Types.ObjectId(companyId)
  pipeline.unshift({
    $match: { companyId: companyObjectId },
  })

  return null
}

// ---------------- User List ----------------
const userList = async (req, res) => {
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_USER_SCOPE)
    if (!loggedInUser) {
      return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_USER_NOT_FOUND })
    }
    const isSuperAdmin = loggedInUser.role === superAdmin

    const pipeline = buildBaseUserPipeline(loggedInUser._id, false)
    pipeline.push({ $project: { password: 0 } }, { $sort: { updatedAt: -1 } })

    // Company scoping - users can only see users from their company
    applyCompanyScopingToPipeline(pipeline, loggedInUser, isSuperAdmin)

    // Filter by companyId if provided in query (only Super Admin can filter by different company)
    if (req.query.companyId && isSuperAdmin) {
      pipeline.unshift({
        $match: { companyId: new mongoose.Types.ObjectId(req.query.companyId) },
      })
    }

    const users = await userRegistry.aggregate(pipeline)
    return res
      .status(200)
      .json({ data: users, msg: 'Successfully fetched all users' })
  } catch (err) {
    console.error('Error in userList:', err)
    return res
      .status(500)
      .json({ msg: 'Fetching users failed, please try again later.' })
  }
}

// ---------------- User Search ----------------
const userSearch = async (req, res) => {
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_USER_SCOPE)
    if (!loggedInUser) {
      return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_USER_NOT_FOUND })
    }
    const isSuperAdmin = loggedInUser.role === superAdmin
    const { uid = '', role = '', storeName = '', companyId } = req.query

    const pipeline = buildBaseUserPipeline(loggedInUser._id, true)
    pipeline.push({ $addFields: { companyName: '$companyData.companyName' } })

    // Filter by companyId if provided in query
    if (companyId) {
      const error = validateAndApplyCompanyFilter(
        companyId,
        loggedInUser,
        isSuperAdmin,
        pipeline,
        res
      )
      if (error) {
        return error
      }
    } else {
      // Apply role-based filtering if no companyId filter was applied
      const scopingResult = applyUserScopingToPipeline(
        pipeline,
        loggedInUser,
        isSuperAdmin
      )
      if (scopingResult?.isEmpty) {
        return res
          .status(200)
          .json({ data: [], msg: ERROR_MSGS.NOT_ASSIGNED_TO_STORE })
      }
    }

    // Add search conditions
    pipeline.push({
      $match: {
        $and: [
          {
            $or: [
              { tempUserId: { $regex: uid, $options: 'i' } },
              { firstName: { $regex: uid, $options: 'i' } },
              { lastName: { $regex: uid, $options: 'i' } },
              { name: { $regex: uid, $options: 'i' } },
              { phoneNumber: { $regex: uid, $options: 'i' } },
              { email: { $regex: uid, $options: 'i' } },
            ],
          },
          { role: { $regex: role, $options: 'i' } },
          storeName
            ? { 'stores.storeName': { $regex: storeName, $options: 'i' } }
            : {},
        ],
      },
    })

    pipeline.push({ $sort: { updatedAt: -1 } }, { $project: { password: 0 } })

    const usersList = await userRegistry.aggregate(pipeline)
    return res
      .status(200)
      .json({ data: usersList, msg: 'Successfully searched data' })
  } catch (error) {
    console.error('Error in userSearch:', error)
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Update Password ----------------
const updatePassword = async (req, res) => {
  const { email, newPassword: rawNewPassword, oldPassword } = req.body
  try {
    // SECURITY FIX: Use authenticated user's ID from token, not email from request body
    // This prevents any user from changing another user's password
    const existingUser = await userRegistry.findById(req.userId)

    if (!existingUser) {
      return res.status(422).json({ msg: 'User does not exist' })
    }

    console.log(email, existingUser.email)

    // Verify that the email from request matches the authenticated user's email
    if (email && email !== existingUser.email) {
      return res.status(403).json({
        msg: 'Email mismatch. You can only change your own password.',
      })
    }

    // Verify the old password belongs to the authenticated user
    const verifyPassword = await bcrypt.compare(
      oldPassword,
      existingUser.password
    )
    if (!verifyPassword) {
      return res.status(400).json({ msg: 'Incorrect Password' })
    }

    if (!rawNewPassword || rawNewPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(500).json({ msg: 'password size is very too small' })
    }

    const newPassword = await bcrypt.hash(rawNewPassword, 5)
    // Increment token version to invalidate all existing sessions
    const currentTokenVersion = existingUser.tokenVersion || 0
    await userRegistry.findByIdAndUpdate(existingUser._id, {
      password: newPassword,
      tokenVersion: currentTokenVersion + 1,
    })

    return res
      .status(200)
      .json({ msg: 'Successfully updated user password. Please login again.' })
  } catch (error) {
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Create User ----------------
const createUser = async (req, res) => {
  const userDetail = req.body
  try {
    const {
      companyId,
      email,
      password,
      role,
      phoneNumber,
      assignedStores,
      storeId,
    } = userDetail

    // Validate required fields
    const requiredFieldsError = validateUserCreationFields(
      companyId,
      email,
      password,
      role,
      phoneNumber
    )
    if (requiredFieldsError) {
      return res.status(422).json({ msg: requiredFieldsError })
    }

    // Validate company exists
    const company = await companyModel.findById(companyId)
    if (!company) {
      return res.status(404).json({ msg: 'Company not found' })
    }

    // Company scoping check
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_COMPANY_ROLE)
    const scopingError = validateCompanyScoping(companyId, loggedInUser)
    if (scopingError) {
      return res.status(403).json({ msg: scopingError })
    }

    // Validate role is allowed
    const roleError = validateRoleAllowed(role)
    if (roleError) {
      return res.status(422).json({ msg: roleError })
    }

    // Check if Company Admin already exists
    const companyAdminError = await validateCompanyAdminUniqueness(
      role,
      companyId
    )
    if (companyAdminError) {
      return res.status(422).json({ msg: companyAdminError })
    }

    // Check if user already exists
    const existingUserError = await validateUserDoesNotExist(email)
    if (existingUserError) {
      return res.status(422).json({ msg: existingUserError })
    }

    // Validate password length
    const passwordError = validatePasswordLength(password)
    if (passwordError) {
      return res.status(500).json({ msg: passwordError })
    }

    // Validate store assignments
    const storeValidation = await validateStoreAssignment(
      storeId,
      assignedStores,
      role,
      companyId
    )
    if (storeValidation.error) {
      return res.status(400).json({ msg: storeValidation.error })
    }

    const { shouldUseAssignedStores, validatedAssignedStores } = storeValidation

    const hashedPassword = await bcrypt.hash(password, 5)
    const newUser = await userRegistry.create({
      firstName: userDetail.firstName,
      lastName: userDetail.lastName,
      name: `${userDetail.firstName || ''} ${userDetail.lastName || ''}`.trim(),
      email,
      password: hashedPassword,
      phoneNumber: phoneNumber.toString(),
      grestMember: false,
      role,
      address: userDetail.address,
      city: userDetail.city,
      companyId,
      storeId: shouldUseAssignedStores ? undefined : storeId || undefined,
      assignedStores: shouldUseAssignedStores ? validatedAssignedStores : [],
      createdBy: req.userId || undefined, // Store who created this user
    })

    return res.status(200).json({
      msg: 'User registered successfully.',
      data: { userId: newUser._id },
    })
  } catch (err) {
    console.error('Create user error:', err)
    return res
      .status(500)
      .json({ msg: 'User registration failed, please try again.' })
  }
}

// ---------------- Edit User ----------------
const editUser = async (req, res) => {
  try {
    const updateData = { ...req.body }
    const { userID, role, assignedStores } = updateData
    delete updateData.password
    delete updateData._id
    delete updateData.companyId // Cannot change company

    if (!userID) {
      return res.status(422).json({ msg: 'userID is required' })
    }

    // Get existing user
    const existingUser = await userRegistry
      .findById(userID)
      .select(SELECT_COMPANY_CREATED_BY)
    if (!existingUser) {
      return res
        .status(404)
        .json({ msg: 'User not found, failed to update data' })
    }

    // Check edit permissions
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_COMPANY_ROLE)

    const permissionError = checkEditPermission(loggedInUser, existingUser)
    if (permissionError) {
      return res.status(403).json({ msg: permissionError })
    }

    if (role && !USER_ROLES.includes(role)) {
      return res
        .status(422)
        .json({ msg: 'Cannot Assign This Role Out of Scope' })
    }

    // Validate assigned stores if provided
    if (
      assignedStores &&
      Array.isArray(assignedStores) &&
      assignedStores.length > 0
    ) {
      const stores = await storeModel.find({
        _id: { $in: assignedStores },
        companyId: existingUser.companyId,
      })

      if (stores.length !== assignedStores.length) {
        return res.status(400).json({
          msg: 'Some assigned stores do not belong to this company or do not exist',
        })
      }
    }

    const updatedUser = await userRegistry.findByIdAndUpdate(
      userID,
      updateData,
      { new: true, runValidators: true }
    )

    return res
      .status(200)
      .json({ data: updatedUser, msg: 'Successfully updated user data' })
  } catch (error) {
    console.error('Error updating user:', error)
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Delete User ----------------
const deleteUser = async (req, res) => {
  const { userID } = req.body
  const modifierId = req.userId
  try {
    // Get logged in user
    const loggedInUser = await userRegistry
      .findById(modifierId)
      .select(SELECT_ROLE_COMPANY)
    if (!loggedInUser) {
      return res.status(403).json({
        msg: 'Unauthorized: User not found.',
      })
    }

    // Get user to be deleted
    const userToDelete = await userRegistry
      .findById(userID)
      .select(SELECT_COMPANY_CREATED_BY)
    if (!userToDelete) {
      return res.status(404).json({
        msg: 'User not found.',
      })
    }

    // Authorization check - only allow if:
    // 1. Super Admin (can delete anyone)
    // 2. Admin Manager or Company Admin who created this user
    const isSuperAdmin = loggedInUser.role === superAdmin
    const isAdminManagerOrCompanyAdmin =
      loggedInUser.role === roleAdminManager ||
      loggedInUser.role === roleCompanyAdmin
    const isCreator =
      userToDelete.createdBy &&
      userToDelete.createdBy.toString() === loggedInUser._id.toString()

    const hasPermission =
      isSuperAdmin || (isAdminManagerOrCompanyAdmin && isCreator)

    if (!hasPermission) {
      return res.status(403).json({
        msg: 'You can only delete users you created.',
      })
    }

    await userRegistry.findByIdAndDelete(userID)
    return res.status(200).json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return res
      .status(500)
      .json({ msg: 'Failed to delete user, please try again.' })
  }
}

// ---------------- Bulk Upload Users ----------------
const bulkUploadUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded.' })
  }

  const uploadJob = new BulkUserUpload({
    fileName: req.file.originalname,
    uploadedBy: req.userId,
    status: 'In Progress',
  })
  await uploadJob.save()

  try {
    // Get uploader's company info for company scoping
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_ROLE_COMPANY)
    if (!loggedInUser) {
      uploadJob.status = 'Failed'
      await uploadJob.save()
      return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_USER_NOT_FOUND })
    }

    const rows = await parseFile(req.file)
    if (rows.length === 0) {
      uploadJob.status = 'Completed'
      await uploadJob.save()
      return res.status(400).json({ msg: 'The uploaded file is empty.' })
    }

    uploadJob.totalRecords = rows.length
    await uploadJob.save()

    const result = await processRows(rows, uploadJob, loggedInUser)
    return res.status(200).json({
      msg: 'File processed successfully.',
      result: { total: rows.length, ...result },
    })
  } catch (error) {
    uploadJob.status = 'Failed'
    await uploadJob.save()
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Upload History ----------------
const getUploadHistory = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1
  const limit = parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_ROLE_COMPANY)
    if (!loggedInUser) {
      return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_USER_NOT_FOUND })
    }

    const isSuperAdmin = loggedInUser.role === superAdmin

    // Build filter based on role
    const uploadFilter = await buildUploadFilterByCompany(
      loggedInUser,
      isSuperAdmin
    )

    const history = await BulkUserUpload.find(uploadFilter)
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalRecords = await BulkUserUpload.countDocuments(uploadFilter)
    const totalPages = Math.ceil(totalRecords / limit)

    return res.status(200).json({
      data: history,
      pagination: { currentPage: page, totalPages, totalRecords },
      msg: 'Successfully fetched upload history.',
    })
  } catch (error) {
    console.error('Fetch Upload History Error:', error)
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Upload Log Details ----------------
const getUploadLogDetails = async (req, res) => {
  const { uploadId } = req.params
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_ROLE_COMPANY)
    if (!loggedInUser) {
      return res.status(403).json({ msg: ERROR_MSGS.FORBIDDEN_USER_NOT_FOUND })
    }

    const isSuperAdmin = loggedInUser.role === superAdmin

    // Check if upload belongs to user's company
    const parentJob = await BulkUserUpload.findById(uploadId).populate(
      'uploadedBy',
      'companyId'
    )
    if (!parentJob) {
      return res.status(404).json({ msg: 'Upload job not found.' })
    }

    // Company scoping check
    if (!isSuperAdmin) {
      if (!parentJob.uploadedBy || !parentJob.uploadedBy.companyId) {
        return res.status(403).json({
          msg: 'Forbidden: You can only view upload logs from your company.',
        })
      }
      const scopingError = validateUserCompanyScoping(
        parentJob.uploadedBy.companyId,
        loggedInUser.companyId,
        false
      )
      if (scopingError) {
        return res.status(403).json({
          msg: 'Forbidden: You can only view upload logs from your company.',
        })
      }
    }

    const logs = await BulkUserUploadLog.find({ uploadId }).sort({
      rowNumber: 1,
    })

    return res
      .status(200)
      .json({ data: logs, msg: 'Successfully fetched log details.' })
  } catch (error) {
    console.error('Fetch Log Details Error:', error)
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Logout User ----------------
const logout = async (req, res) => {
  try {
    const user = await userRegistry.findById(req.userId).select('tokenVersion')

    if (!user) {
      return res.status(404).json({ msg: 'User not found' })
    }

    // Increment token version to invalidate all existing sessions/tokens
    const currentTokenVersion = user.tokenVersion || 0
    await userRegistry.findByIdAndUpdate(req.userId, {
      tokenVersion: currentTokenVersion + 1,
    })

    return res.status(200).json({
      msg: 'Logged out successfully. All active sessions have been invalidated.',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ msg: ISE })
  }
}

// ---------------- Assign Stores to User ----------------
const assignStores = async (req, res) => {
  try {
    const { userId, storeIds } = req.body

    if (!userId || !storeIds || !Array.isArray(storeIds)) {
      return res.status(422).json({
        msg: 'userId and storeIds (array) are required',
      })
    }

    // Get user to assign stores to
    const user = await userRegistry.findById(userId).select('companyId role')
    if (!user) {
      return res.status(404).json({ msg: 'User not found' })
    }

    // Company scoping check
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select(SELECT_COMPANY_ROLE)
    const isSuperAdmin = loggedInUser.role === superAdmin
    const scopingError = validateUserCompanyScoping(
      user.companyId,
      loggedInUser.companyId,
      isSuperAdmin
    )
    if (scopingError) {
      return res.status(403).json({ msg: scopingError })
    }

    // Validate all stores belong to user's company
    if (storeIds.length > 0) {
      const stores = await storeModel.find({
        _id: { $in: storeIds },
        companyId: user.companyId,
      })

      if (stores.length !== storeIds.length) {
        return res.status(400).json({
          msg: "Some stores do not belong to this user's company or do not exist",
        })
      }
    }

    // Update user's assigned stores
    const updatedUser = await userRegistry
      .findByIdAndUpdate(
        userId,
        { assignedStores: storeIds },
        { new: true, runValidators: true }
      )
      .populate('assignedStores', 'storeName uniqueId')

    return res.status(200).json({
      msg: 'Stores assigned successfully',
      data: updatedUser,
    })
  } catch (error) {
    console.error('Assign stores error:', error)
    return res.status(500).json({ msg: ISE })
  }
}

export default {
  userList,
  updatePassword,
  userSearch,
  createUser,
  editUser,
  deleteUser,
  bulkUploadUsers,
  getUploadLogDetails,
  getUploadHistory,
  logout,
  assignStores,
}
