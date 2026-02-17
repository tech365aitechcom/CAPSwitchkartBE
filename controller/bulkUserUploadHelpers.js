import userRegistry from '../models/UsersModel.js'
import bcrypt from 'bcryptjs'
import { BulkUserUploadLog } from '../models/BulkUploadModel.js'
import mongoose from 'mongoose'
import companyModel from '../models/companyModel.js'

const roleCompanyAdmin = 'Company Admin'
const superAdmin = 'Super Admin'
const roleAdminManager = 'Admin Manager'
const roleTechnician = 'Technician'
const BULK_PASSWORD_MIN_LENGTH = 6
const ROLES_WITH_ASSIGNED_STORES = [roleAdminManager, roleTechnician]

const USER_ROLES = [
  roleAdminManager,
  roleTechnician,
  'Sale User',
  'Admin',
  roleCompanyAdmin,
  'Manager',
  'Sales',
]

// Validation helpers
export const validateRequiredFields = (fields) => {
  const errors = []
  const requiredFields = [
    { key: 'firstName', name: 'First Name' },
    { key: 'email', name: 'Email' },
    { key: 'password', name: 'Password' },
    { key: 'phoneNumber', name: 'Mobile Number' },
    { key: 'storeName', name: 'Store Name' },
    { key: 'role', name: 'Role' },
  ]

  requiredFields.forEach(({ key, name }) => {
    if (!fields[key]) {
      errors.push(`${name} is mandatory.`)
    }
  })

  return errors
}

export const validateFieldFormats = (fields, existingEmails) => {
  const errors = []
  const { email, password, phoneNumber, role } = fields

  if (email && !/\S+@\S+\.\S+/.test(email)) {
    errors.push('Invalid email format.')
  }

  if (email && existingEmails.has(email.toLowerCase())) {
    errors.push('User exists already, please login instead.')
  }

  if (password && password.length < BULK_PASSWORD_MIN_LENGTH) {
    errors.push('Password size is very too small')
  }

  if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
    errors.push('Mobile Number must be 10 digits.')
  }

  if (role && !USER_ROLES.includes(role)) {
    errors.push(`Invalid role. Use one of: ${USER_ROLES.join(', ')}.`)
  }

  return errors
}

export const validateStore = (storeName, storeMap) => {
  const errors = []
  const storeId = storeMap.get(storeName?.toLowerCase())

  if (storeName && !storeId) {
    errors.push(`Store Name '${storeName}' not found.`)
  }

  return { errors, storeId }
}

export const validateRow = (row, existingEmails, storeMap) => {
  const normalizedRow = Object.keys(row).reduce((acc, key) => {
    const value = row[key] ? row[key].toString().trim() : ''
    acc[key.trim()] = value
    return acc
  }, {})

  const fields = {
    firstName: normalizedRow['First Name'],
    email: normalizedRow.Email,
    password: normalizedRow.Password,
    phoneNumber: normalizedRow['Mobile Number'],
    storeName: normalizedRow['Store Name'],
    role: normalizedRow.Role,
    companyCode: normalizedRow.Company,
  }

  const requiredFieldErrors = validateRequiredFields(fields)
  const formatErrors = validateFieldFormats(fields, existingEmails)
  const { errors: storeErrors, storeId } = validateStore(
    fields.storeName,
    storeMap
  )

  const errors = [...requiredFieldErrors, ...formatErrors, ...storeErrors]

  return { normalizedRow, errors, storeId, companyCode: fields.companyCode }
}

export const createUserFromRow = async (
  row,
  storeId,
  companyId,
  uploadedBy
) => {
  const {
    'First Name': firstName,
    'Last Name': lastName,
    Email: email,
    Password: password,
    'Mobile Number': phoneNumber,
    Role: role,
    City: city,
    Address: address,
  } = row

  const shouldUseAssignedStores = ROLES_WITH_ASSIGNED_STORES.includes(role)

  const hashedPassword = await bcrypt.hash(password, 11)
  await userRegistry.create({
    firstName,
    lastName,
    name: `${firstName} ${lastName || ''}`.trim(),
    email,
    password: hashedPassword,
    phoneNumber: phoneNumber.toString(),
    role,
    storeId: shouldUseAssignedStores ? undefined : storeId || undefined,
    assignedStores: shouldUseAssignedStores && storeId ? [storeId] : [],
    companyId,
    city,
    address,
    grestMember: false,
    createdBy: uploadedBy,
  })
}

// Build lookup maps
export const buildLookupMaps = async (loggedInUser) => {
  const isSuperAdmin = loggedInUser.role === superAdmin
  const StoreModel = mongoose.model('store')

  const storeFilter =
    !isSuperAdmin && loggedInUser.companyId
      ? { companyId: loggedInUser.companyId }
      : {}

  const allStores = await StoreModel.find(storeFilter, 'storeName')
  const storeMap = new Map(
    allStores.map((s) => [s.storeName.toLowerCase(), s._id])
  )

  const companyFilter =
    !isSuperAdmin && loggedInUser.companyId
      ? { _id: loggedInUser.companyId }
      : {}
  const allCompanies = await companyModel.find(companyFilter, 'companyCode _id')
  const companyMap = new Map(
    allCompanies
      .filter((c) => c.companyCode)
      .map((c) => [c.companyCode.toLowerCase().trim(), c._id])
  )

  return { storeMap, companyMap }
}

export const buildExistingDataMaps = async () => {
  const allUsers = await userRegistry.find({}, 'email role companyId')
  const existingEmails = new Set(allUsers.map((u) => u.email.toLowerCase()))

  const companyAdminMap = new Map()
  allUsers.forEach((u) => {
    if (u.role === roleCompanyAdmin && u.companyId) {
      companyAdminMap.set(u.companyId.toString(), true)
    }
  })

  return { existingEmails, companyAdminMap }
}

export const resolveCompanyId = (
  companyCode,
  companyMap,
  loggedInUserCompanyId
) => {
  if (!companyCode) {
    return { companyId: loggedInUserCompanyId, errors: [] }
  }

  const companyId = companyMap.get(companyCode.toLowerCase().trim())
  if (!companyId) {
    return {
      companyId: null,
      errors: [`Company '${companyCode}' not found.`],
    }
  }

  return { companyId, errors: [] }
}

export const validateCompanyAdminForBulkUpload = (
  role,
  companyId,
  companyAdminMap
) => {
  if (
    role === roleCompanyAdmin &&
    companyId &&
    companyAdminMap.has(companyId.toString())
  ) {
    return [
      'A Company Admin already exists for this company. Only one Company Admin is allowed per company.',
    ]
  }
  return []
}

export const processSingleRow = async (row, index, context) => {
  const {
    uploadJob,
    loggedInUser,
    storeMap,
    companyMap,
    existingEmails,
    companyAdminMap,
    failedRecordsForCSV,
  } = context

  const rowNumber = index + 2
  const { normalizedRow, errors, storeId, companyCode } = validateRow(
    row,
    existingEmails,
    storeMap
  )

  const { companyId, errors: companyErrors } = resolveCompanyId(
    companyCode,
    companyMap,
    loggedInUser.companyId
  )
  errors.push(...companyErrors)

  if (!companyId) {
    errors.push('Valid company is required.')
  }

  const role = normalizedRow.Role
  const companyAdminErrors = validateCompanyAdminForBulkUpload(
    role,
    companyId,
    companyAdminMap
  )
  errors.push(...companyAdminErrors)

  if (errors.length > 0) {
    const errorMessage = errors.join(' ')
    failedRecordsForCSV.push([...Object.values(normalizedRow), errorMessage])
    await BulkUserUploadLog.create({
      uploadId: uploadJob._id,
      rowNumber,
      rowData: row,
      status: 'Fail',
      errorMessage,
    })
    return { succeeded: false }
  }

  await createUserFromRow(normalizedRow, storeId, companyId, loggedInUser._id)
  existingEmails.add(normalizedRow.Email.toLowerCase())

  if (role === roleCompanyAdmin && companyId) {
    companyAdminMap.set(companyId.toString(), true)
  }

  await BulkUserUploadLog.create({
    uploadId: uploadJob._id,
    rowNumber,
    rowData: row,
    status: 'Success',
  })

  return { succeeded: true }
}

export const processRows = async (rows, uploadJob, loggedInUser) => {
  const { storeMap, companyMap } = await buildLookupMaps(loggedInUser)
  const { existingEmails, companyAdminMap } = await buildExistingDataMaps()

  let succeededCount = 0
  let failedCount = 0
  const failedRecordsForCSV = []

  const context = {
    uploadJob,
    loggedInUser,
    storeMap,
    companyMap,
    existingEmails,
    companyAdminMap,
    failedRecordsForCSV,
  }

  for (const [index, row] of rows.entries()) {
    const result = await processSingleRow(row, index, context)

    if (result.succeeded) {
      succeededCount++
    } else {
      failedCount++
    }
  }

  uploadJob.succeeded = succeededCount
  uploadJob.failed = failedCount
  uploadJob.status = 'Completed'
  await uploadJob.save()

  return { succeededCount, failedCount, failedRecordsForCSV }
}
