import UsersModel from '../models/UsersModel.js'
import storeModel from '../models/storeModel.js'
import { ROLES } from './rbac.js'

// Helper to check cross-company access
const checkCrossCompanyAccess = (user, targetCompanyId) => {
  if (!targetCompanyId || !user.companyId) {
    return true
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    return true
  }
  return targetCompanyId.toString() === user.companyId.toString()
}

// Helper to apply company filter for non-super-admins
const applyCompanyFilter = async (req, user) => {
  if (user.role === ROLES.SUPER_ADMIN) {
    return
  }

  if (user.role === ROLES.COMPANY_ADMIN) {
    req.isCompanyAdminScope = true
    req.query.companyId = user.companyId.toString()
    const companyStores = await storeModel
      .find({ companyId: user.companyId })
      .select('_id')
      .lean()
    req.companyStoreIds = companyStores.map((store) => store._id)
  } else {
    req.query.companyId = user.companyId.toString()
  }
}

/**
 * Middleware to enforce company-level data scoping
 * Ensures users can only access data belonging to their company
 */
const companyScopingMiddleware = async (req, res, next) => {
  try {
    const userId = req.userId

    if (!userId) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: User not authenticated' })
    }

    const user = await UsersModel.findById(userId)
      .select('companyId role assignedStores')
      .lean()

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.companyId && user.role !== ROLES.SUPER_ADMIN) {
      return res
        .status(403)
        .json({ message: 'User not associated with any company' })
    }

    req.userCompanyId = user.companyId
    req.userRole = user.role
    req.assignedStores = user.assignedStores || []

    // Check body companyId
    if (!checkCrossCompanyAccess(user, req.body.companyId)) {
      return res.status(403).json({
        message: 'Forbidden: Cannot access data from another company',
      })
    }

    // Check query companyId
    if (req.query.companyId) {
      if (!checkCrossCompanyAccess(user, req.query.companyId)) {
        return res.status(403).json({
          message: 'Forbidden: Cannot filter by another company',
        })
      }
    } else {
      await applyCompanyFilter(req, user)
    }

    return next()
  } catch (error) {
    console.error('Company scoping error:', error)
    return res
      .status(500)
      .json({ message: 'Internal server error in company scoping' })
  }
}

/**
 * Middleware to enforce store-level access control
 * Managers and Technicians can only access their assigned stores
 */
const storeAccessMiddleware = async (req, res, next) => {
  try {
    const userRole = req.userRole
    const assignedStores = req.assignedStores || []
    const requestedStoreId =
      req.params.storeId || req.body.storeId || req.query.storeId

    // Admins and SuperAdmins can access all stores in their company
    if (userRole === ROLES.SUPER_ADMIN) {
      return next()
    }

    // Managers and Technicians can only access assigned stores
    if (userRole === 'Manager' || userRole === 'Technician') {
      if (requestedStoreId) {
        const hasAccess = assignedStores.some(
          (storeId) => storeId.toString() === requestedStoreId.toString()
        )

        if (!hasAccess) {
          return res.status(403).json({
            message: 'Forbidden: You do not have access to this store',
          })
        }
      }
      // Attach store filter for list queries
      req.storeFilter = { _id: { $in: assignedStores } }
    }

    return next()
  } catch (error) {
    console.error('Store access control error:', error)
    return res
      .status(500)
      .json({ message: 'Internal server error in store access control' })
  }
}

/**
 * Combined middleware for complete authorization
 */
const authorizeCompanyAndStore = [
  companyScopingMiddleware,
  storeAccessMiddleware,
]

export {
  companyScopingMiddleware,
  storeAccessMiddleware,
  authorizeCompanyAndStore,
}
export default companyScopingMiddleware
