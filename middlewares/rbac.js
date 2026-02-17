import users from '../models/UsersModel.js'

// Role hierarchy definition
export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  ADMIN_MANAGER: 'Admin Manager',
  TECHNICIAN: 'Technician',
  SALES: 'Sale User',
}

// Centralized messages to avoid duplicated literals
const MESSAGES = {
  UNAUTHORIZED_NO_USER_ID: 'Unauthorized - No user ID found',
  UNAUTHORIZED_USER_NOT_FOUND: 'Unauthorized - User not found',
  ACCESS_DENIED: 'Access denied - Insufficient permissions',
  ACCOUNT_DISABLED: 'Account is disabled',
  CANNOT_MODIFY_SUPERADMIN: 'Cannot modify super admin accounts',
  CANNOT_ASSIGN_SUPERADMIN: 'Cannot assign super admin role',
  CANNOT_ASSIGN_HIGHER_ROLE:
    'Cannot assign role equal to or higher than your own',
  RBAC_ERROR: 'Error checking permissions',
  VALIDATION_ERROR: 'Error validating request',
}

// Centralized permission strings to avoid duplicated literals
const PERMISSIONS = {
  BRAND_GET_ALL_BRANDS_MODELS: 'brand:getAllBrandsModels',
  BRAND_GET_BRANDS: 'brand:getBrands',
  BRAND_SELECTED_BRAND_MODELS: 'brand:SelectedBrandModels',
  CATEGORY_GET_CATEGORY: 'category:getCategory',
  GRADE_GET_MODEL_WISE_PRICE: 'grade:getModelWisePrice',
  GRADE_MODEL_PRICE_LIST: 'grade:modelPriceList',
  LEAD_SET_UPLOAD_IMAGE: 'leadSet:uploadImage',
  PROFILE_DELETE_IMAGE: 'profile:Deleteimage',
  PROFILE_EDIT_USER: 'profile:Edituser',
  PROFILE_UPLOAD_IMAGE: 'profile:Uploadimage',
  PROSPECT_FIND_ALL_SELLED: 'prospect:findAllSelled',
  PROSPECT_FIND_LEAD_BY_ID: 'prospect:findLeadById',
  QUESTIONNAIRE_CUSTOMER_DETAIL: 'questionnaire:customerDetail',
  QUESTIONNAIRE_GET_DOCUMENTS: 'questionnaire:getDocuments',
  QUESTIONNAIRE_GET_SUBMITTED_DATA: 'questionnaire:getSubmitedData',
  QUESTIONNAIRE_UPLOAD_DOCUMENTS: 'questionnaire:uploadDocuments',
  SMS_SEND_OTP: 'sms:sendOTP',
  SMS_VERIFY_OTP: 'sms:verifyOTP',
  STORE_CONFIG_GET_ALL_DEVICE_STATUS: 'storeConfig:getAllDeviceStatus',
  STORE_CONFIG_GET_LEAD_BY_UNIQUE_CODE: 'storeConfig:getLeadByUniqueCode',
  STORE_CONFIG_GET_ALL_LEADS_COMPLETE: 'storeConfig:getAllLeadsComplete',
  STORE_CONFIG_GET_UP_TO_VALUE: 'storeConfig:getUpToValue',
  USER_REGISTRY_CREATE_USER: 'userregistry:createUser',
  USER_REGISTRY_UPDATE_PASSWORD: 'userregistry:updatePassword',
  USER_LOGIN: 'user:login',
  USER_PASSWORD_SET: 'user:PasswordSet',
  USER_SEND_OTP: 'user:sendOTP',
  USER_VERIFY_EMAIL_OTP: 'user:verifyEmailOtp',
}

// === New: centralized response helpers (reduce duplicated literals) ===
const respondUnauthorized = (res, messageKey = 'UNAUTHORIZED_NO_USER_ID') =>
  res.status(401).json({ success: false, message: MESSAGES[messageKey] })

const respondForbidden = (res, messageKey = 'ACCESS_DENIED') =>
  res.status(403).json({ success: false, message: MESSAGES[messageKey] })

const respondServerError = (res, messageKey = 'RBAC_ERROR') =>
  res.status(500).json({ success: false, message: MESSAGES[messageKey] })
// =====================================================================

// Define permissions for each role based on API_PERMISSIONS.csv
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'], // All permissions
  [ROLES.ADMIN_MANAGER]: [
    'brand:create',
    'brand:createModel',
    PERMISSIONS.BRAND_GET_ALL_BRANDS_MODELS,
    PERMISSIONS.BRAND_GET_BRANDS,
    PERMISSIONS.BRAND_SELECTED_BRAND_MODELS,
    PERMISSIONS.CATEGORY_GET_CATEGORY,
    'company:findAll',
    'company:findById',
    PERMISSIONS.GRADE_GET_MODEL_WISE_PRICE,
    PERMISSIONS.GRADE_MODEL_PRICE_LIST,
    'leadSet:bulkuploadImage',
    'leadSet:getCounts',
    'leadSet:addOrderCreated',
    'leadSet:addQuickQoute',
    PERMISSIONS.LEAD_SET_UPLOAD_IMAGE,
    'liquidator:findAll',
    'master:insertMany',
    'offer:createOffer',
    'offer:editOffer',
    'offer:getOfferList',
    'outstanding:allLots',
    'outstanding:devicesList',
    'outstanding:forwardRequest',
    'outstanding:searchLots',
    'outstanding:updateStatus',
    'pendingDevice:allDevices',
    'pendingDevice:pickupRequest',
    'pendingDevice:searchDevice',
    'pendingDevice:updateStatus',
    'pendingDevice:updateRequest',
    'pickupDevice:allLots',
    'pickupDevice:devicesList',
    'pickupDevice:lotsHistory',
    'pickupDevice:searchLots',
    'pickupDevice:technicianReport',
    'pickupDevice:updateStatus',
    'pickupDevice:updatePaymentReceiptAndRemarks',
    PERMISSIONS.PROFILE_DELETE_IMAGE,
    PERMISSIONS.PROFILE_EDIT_USER,
    PERMISSIONS.PROFILE_UPLOAD_IMAGE,
    'prospect:calculatePriceAdmin',
    'prospect:findAll',
    'prospect:orderCreated',
    'prospect:QuoteCreated',
    PERMISSIONS.PROSPECT_FIND_ALL_SELLED,
    PERMISSIONS.PROSPECT_FIND_LEAD_BY_ID,
    'questionnaire:create',
    'questionnaire:insertMany',
    'questionnaire:calculatePrice',
    'questionnaire:calculatePriceWatch',
    PERMISSIONS.QUESTIONNAIRE_CUSTOMER_DETAIL,
    'questionnaire:findAll',
    PERMISSIONS.QUESTIONNAIRE_GET_DOCUMENTS,
    PERMISSIONS.QUESTIONNAIRE_GET_SUBMITTED_DATA,
    'questionnaire:questionnaireList',
    PERMISSIONS.QUESTIONNAIRE_UPLOAD_DOCUMENTS,
    'quoteTracking:getUserActivityLog',
    'quoteTracking:getQuoteTrackingData',
    'quoteTracking:downloadQuoteTrackingData',
    'receipt:receiptController',
    PERMISSIONS.SMS_SEND_OTP,
    PERMISSIONS.SMS_VERIFY_OTP,
    PERMISSIONS.STORE_CONFIG_GET_ALL_DEVICE_STATUS,
    PERMISSIONS.STORE_CONFIG_GET_LEAD_BY_UNIQUE_CODE,
    PERMISSIONS.STORE_CONFIG_GET_ALL_LEADS_COMPLETE,
    PERMISSIONS.STORE_CONFIG_GET_UP_TO_VALUE,
    'store:adminReport',
    'store:findAll',
    'store:findById',
    'userDashboard:addViewedPhone',
    'userDashboard:adminSelingget',
    'userDashboard:topSelling',
    'userDashboard:getViewedPhone',
    'userDashboard:Prospect',
    'userDashboard:saled',
    'userDashboard:searchPhone',
    'userregistry:userList',
    'userregistry:bulkUploadUsers',
    'userregistry:getUploadHistory',
    'userregistry:getUploadLogDetails',
    PERMISSIONS.USER_REGISTRY_CREATE_USER,
    'userregistry:userSearch',
    'userregistry:editUser',
    PERMISSIONS.USER_REGISTRY_UPDATE_PASSWORD,
    'user:updateEditUsers',
    'user:getAllUsers',
    PERMISSIONS.USER_LOGIN,
    PERMISSIONS.USER_PASSWORD_SET,
    PERMISSIONS.USER_SEND_OTP,
    'user:updateUserStatus',
    PERMISSIONS.USER_VERIFY_EMAIL_OTP,
  ],
  [ROLES.TECHNICIAN]: [
    PERMISSIONS.CATEGORY_GET_CATEGORY,
    PERMISSIONS.GRADE_GET_MODEL_WISE_PRICE,
    PERMISSIONS.GRADE_MODEL_PRICE_LIST,
    'leadSet:bulkuploadImage',
    PERMISSIONS.LEAD_SET_UPLOAD_IMAGE,
    'outstanding:allLots',
    'outstanding:devicesList',
    'outstanding:forwardRequest',
    'outstanding:searchLots',
    'outstanding:updateStatus',
    'pendingDevice:allDevices',
    'pendingDevice:pickupRequest',
    'pendingDevice:searchDevice',
    'pendingDevice:updateStatus',
    'pendingDevice:updateRequest',
    'pickupDevice:allLots',
    'pickupDevice:devicesList',
    'pickupDevice:lotsHistory',
    'pickupDevice:searchLots',
    'pickupDevice:technicianReport',
    'pickupDevice:updateStatus',
    PERMISSIONS.PROFILE_DELETE_IMAGE,
    PERMISSIONS.PROFILE_EDIT_USER,
    PERMISSIONS.PROFILE_UPLOAD_IMAGE,
    PERMISSIONS.PROSPECT_FIND_ALL_SELLED,
    PERMISSIONS.PROSPECT_FIND_LEAD_BY_ID,
    // Questionnaires
    PERMISSIONS.QUESTIONNAIRE_CUSTOMER_DETAIL,
    PERMISSIONS.QUESTIONNAIRE_GET_DOCUMENTS,
    PERMISSIONS.QUESTIONNAIRE_GET_SUBMITTED_DATA,
    PERMISSIONS.QUESTIONNAIRE_UPLOAD_DOCUMENTS,
    // SMS
    PERMISSIONS.SMS_SEND_OTP,
    PERMISSIONS.SMS_VERIFY_OTP,
    // Store Config
    PERMISSIONS.STORE_CONFIG_GET_ALL_DEVICE_STATUS,
    PERMISSIONS.STORE_CONFIG_GET_LEAD_BY_UNIQUE_CODE,
    PERMISSIONS.STORE_CONFIG_GET_ALL_LEADS_COMPLETE,
    PERMISSIONS.STORE_CONFIG_GET_UP_TO_VALUE,
    // User Registry
    PERMISSIONS.USER_REGISTRY_CREATE_USER,
    PERMISSIONS.USER_REGISTRY_UPDATE_PASSWORD,
    // Users
    PERMISSIONS.USER_LOGIN,
    PERMISSIONS.USER_PASSWORD_SET,
    PERMISSIONS.USER_SEND_OTP,
    PERMISSIONS.USER_VERIFY_EMAIL_OTP,
  ],
  [ROLES.SALES]: [
    // Brands
    PERMISSIONS.BRAND_GET_ALL_BRANDS_MODELS,
    PERMISSIONS.BRAND_GET_BRANDS,
    PERMISSIONS.BRAND_SELECTED_BRAND_MODELS,
    // Category
    PERMISSIONS.CATEGORY_GET_CATEGORY,
    // Coupons
    'coupon:applyCoupon',
    'coupon:findEligibleCoupon',
    'coupon:listCoupons',
    'coupon:removeCoupon',
    // Discounts
    'discount:applyDiscount',
    'discount:findByLeadId',
    // Grades
    PERMISSIONS.GRADE_GET_MODEL_WISE_PRICE,
    PERMISSIONS.GRADE_MODEL_PRICE_LIST,
    // LeadSet
    'leadSet:getCounts',
    'leadSet:addOrderCreated',
    'leadSet:addQuickQoute',
    PERMISSIONS.LEAD_SET_UPLOAD_IMAGE,
    // Offer
    'offer:getOfferList',
    // Profile
    PERMISSIONS.PROFILE_DELETE_IMAGE,
    PERMISSIONS.PROFILE_EDIT_USER,
    PERMISSIONS.PROFILE_UPLOAD_IMAGE,
    // Prospects
    'prospect:findAll',
    'prospect:orderCreated',
    'prospect:QuoteCreated',
    PERMISSIONS.PROSPECT_FIND_LEAD_BY_ID,
    // Questionnaires
    'questionnaire:calculatePrice',
    'questionnaire:calculatePriceWatch',
    PERMISSIONS.QUESTIONNAIRE_CUSTOMER_DETAIL,
    PERMISSIONS.QUESTIONNAIRE_GET_DOCUMENTS,
    PERMISSIONS.QUESTIONNAIRE_GET_SUBMITTED_DATA,
    'questionnaire:itemPurchased',
    PERMISSIONS.QUESTIONNAIRE_UPLOAD_DOCUMENTS,
    // Quote Tracking
    'quoteTracking:logQuoteAttempt',
    // Receipt
    'receipt:receiptController',
    // SMS
    PERMISSIONS.SMS_SEND_OTP,
    PERMISSIONS.SMS_VERIFY_OTP,
    // Store Config
    PERMISSIONS.STORE_CONFIG_GET_ALL_DEVICE_STATUS,
    PERMISSIONS.STORE_CONFIG_GET_LEAD_BY_UNIQUE_CODE,
    PERMISSIONS.STORE_CONFIG_GET_ALL_LEADS_COMPLETE,
    PERMISSIONS.STORE_CONFIG_GET_UP_TO_VALUE,
    // User Dashboard
    'userDashboard:addViewedPhone',
    'userDashboard:topSelling',
    'userDashboard:getViewedPhone',
    'userDashboard:Prospect',
    'userDashboard:saled',
    'userDashboard:searchPhone',
    // User Registry
    PERMISSIONS.USER_REGISTRY_CREATE_USER,
    PERMISSIONS.USER_REGISTRY_UPDATE_PASSWORD,
    // Users
    PERMISSIONS.USER_LOGIN,
    PERMISSIONS.USER_PASSWORD_SET,
    PERMISSIONS.USER_SEND_OTP,
    PERMISSIONS.USER_VERIFY_EMAIL_OTP,
  ],
}

// Check if user has required permission
const hasPermission = (userRole, requiredPermission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || []

  // Super admin has all permissions
  if (permissions.includes('*')) {
    return true
  }

  // Exact match
  if (permissions.includes(requiredPermission)) {
    return true
  }

  // Wildcard check: if requiredPermission is like 'resource:action', allow if 'resource:*' present
  const [resource] = requiredPermission.split(':')
  return permissions.includes(`${resource}:*`)
}

// Middleware to check role-based access
export const checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return respondUnauthorized(res, 'UNAUTHORIZED_NO_USER_ID')
      }

      // Fetch user from database to get current role
      const user = await users.findById(req.userId).select('role status')
      if (!user) {
        return respondUnauthorized(res, 'UNAUTHORIZED_USER_NOT_FOUND')
      }

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(user.role)) {
        return respondForbidden(res, 'ACCESS_DENIED')
      }

      // Attach role to request for further use
      req.userRole = user.role
      return next()
    } catch (error) {
      console.error('RBAC Error:', error)
      return respondServerError(res, 'RBAC_ERROR')
    }
  }
}

// Middleware to check permission-based access
export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return respondUnauthorized(res, 'UNAUTHORIZED_NO_USER_ID')
      }

      // Fetch user from database
      const user = await users.findById(req.userId).select('role status')

      if (!user) {
        return respondUnauthorized(res, 'UNAUTHORIZED_USER_NOT_FOUND')
      }

      // Check if user account is active
      if (!user.status) {
        return respondForbidden(res, 'ACCOUNT_DISABLED')
      }

      // Check if user has required permission
      if (!hasPermission(user.role, requiredPermission)) {
        return respondForbidden(res, 'ACCESS_DENIED')
      }

      // Attach role to request
      req.userRole = user.role
      return next()
    } catch (error) {
      console.error('Permission Check Error:', error)
      return respondServerError(res, 'RBAC_ERROR')
    }
  }
}

// Helper to check if user can modify target user
const canModifyTargetUser = (currentUserRole, targetUserRole) => {
  if (currentUserRole === ROLES.SUPER_ADMIN) {
    return true
  }
  return targetUserRole !== ROLES.SUPER_ADMIN
}

// Helper to check role assignment permission
const canAssignRole = (
  currentUserRole,
  requestedRole,
  currentRoleLevel,
  requestedRoleLevel,
  isRoleChanging
) => {
  if (currentUserRole === ROLES.SUPER_ADMIN) {
    return true
  }
  if (requestedRole === ROLES.SUPER_ADMIN) {
    return false
  }
  if (!isRoleChanging) {
    return true
  }
  return requestedRoleLevel < currentRoleLevel
}

// Role hierarchy for privilege checks
const ROLE_HIERARCHY = [
  ROLES.SALES,
  ROLES.TECHNICIAN,
  ROLES.ADMIN_MANAGER,
  ROLES.SUPER_ADMIN,
]

// Helper to validate target user modification
const validateTargetUserModification = async (
  targetUserId,
  currentUserRole
) => {
  if (!targetUserId) {
    return null
  }

  const targetUser = await users.findById(targetUserId).select('role')
  if (targetUser && !canModifyTargetUser(currentUserRole, targetUser.role)) {
    return 'CANNOT_MODIFY_SUPERADMIN'
  }

  return null
}

// Helper to validate role assignment
const validateRoleAssignment = async (
  requestedRole,
  currentUserRole,
  targetUserId
) => {
  if (!requestedRole) {
    return null
  }

  const currentUserRoleLevel = ROLE_HIERARCHY.indexOf(currentUserRole)
  const requestedRoleLevel = ROLE_HIERARCHY.indexOf(requestedRole)

  let isRoleChanging = true
  if (targetUserId) {
    const targetUser = await users.findById(targetUserId).select('role')
    if (targetUser && targetUser.role === requestedRole) {
      isRoleChanging = false
    }
  }

  if (
    !canAssignRole(
      currentUserRole,
      requestedRole,
      currentUserRoleLevel,
      requestedRoleLevel,
      isRoleChanging
    )
  ) {
    return requestedRole === ROLES.SUPER_ADMIN
      ? 'CANNOT_ASSIGN_SUPERADMIN'
      : 'CANNOT_ASSIGN_HIGHER_ROLE'
  }

  return null
}

// Middleware to prevent privilege escalation in user updates
export const preventPrivilegeEscalation = async (req, res, next) => {
  try {
    const currentUser = await users.findById(req.userId).select('role')
    if (!currentUser) {
      return respondUnauthorized(res, 'UNAUTHORIZED_NO_USER_ID')
    }

    const targetUserId = req.body._id || req.body.id || req.body.userID

    // Check if trying to modify a super admin account
    const modificationError = await validateTargetUserModification(
      targetUserId,
      currentUser.role
    )
    if (modificationError) {
      return respondForbidden(res, modificationError)
    }

    // Check role assignment
    const roleAssignmentError = await validateRoleAssignment(
      req.body.role,
      currentUser.role,
      targetUserId
    )
    if (roleAssignmentError) {
      return respondForbidden(res, roleAssignmentError)
    }

    return next()
  } catch (error) {
    console.error('Privilege Escalation Check Error:', error)
    return respondServerError(res, 'VALIDATION_ERROR')
  }
}

export default {
  checkRole,
  checkPermission,
  preventPrivilegeEscalation,
  ROLES,
}
