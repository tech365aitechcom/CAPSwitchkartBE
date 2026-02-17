import express from 'express'
import multer from 'multer'
import userRegistryController from '../controller/userRegistryController.js'
import verifyToken from '../middlewares/authJwt.js'
import {
  checkRole,
  preventPrivilegeEscalation,
  ROLES,
} from '../middlewares/rbac.js'
import companyScopingMiddleware from '../middlewares/companyScopingMiddleware.js'

const userRegistryRoute = express.Router()

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new Error('Invalid file type. Only .csv and .xlsx files are allowed.'),
      false
    )
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
})

userRegistryRoute
  .get(
    '/all',
    verifyToken,
    companyScopingMiddleware,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    userRegistryController.userList
  )
  .get(
    '/search',
    verifyToken,
    companyScopingMiddleware,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    userRegistryController.userSearch
  )
  .post('/register', verifyToken, userRegistryController.createUser)
  .post('/logout', verifyToken, userRegistryController.logout)
  .post('/updatePassword', verifyToken, userRegistryController.updatePassword)
  .put(
    '/update',
    verifyToken,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    preventPrivilegeEscalation,
    userRegistryController.editUser
  )
  .delete(
    '/delete',
    verifyToken,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    userRegistryController.deleteUser
  )
  .post(
    '/bulk-upload',
    verifyToken,
    companyScopingMiddleware,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    upload.single('file'),
    userRegistryController.bulkUploadUsers
  )
  .get(
    '/bulk-upload/history',
    verifyToken,
    companyScopingMiddleware,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    userRegistryController.getUploadHistory
  )
  .get(
    '/bulk-upload/history/:uploadId',
    verifyToken,
    companyScopingMiddleware,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER, ROLES.COMPANY_ADMIN]),
    userRegistryController.getUploadLogDetails
  )
  .post(
    '/assign-stores',
    verifyToken,
    checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER]),
    userRegistryController.assignStores
  )

export default userRegistryRoute
