import jwt from 'jsonwebtoken'
import users from '../models/UsersModel.js'

const allowedDomains = 'https://buyback.grest.in'

const authJwt = async (req, res, next) => {
  try {
    const origin = req.headers['origin']
    const apiPath = req.path
    console.log(origin, ' ', apiPath)

    if (origin === allowedDomains) {
      console.log('bypass')
      req.userId = '6540d7df4058702d148699e8'
      req.storeName = 'GRESTBYPASS'
      return next()
    }

    const token = req.headers['authorization']
    if (!token) {
      return res.status(403).send({ message: 'No token provided!' })
    }

    // Verify token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECERET, (err, dec) => {
        if (err) {
          reject(err)
        } else {
          resolve(dec)
        }
      })
    })

    // Check token version to ensure session is still valid
    const user = await users.findById(decoded.userId).select('tokenVersion')

    if (!user) {
      return res.status(401).send({ message: 'User not found!' })
    }

    // Verify token version matches (for session invalidation)
    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res
        .status(401)
        .send({ message: 'Session expired. Please login again.' })
    }

    req.userId = decoded.userId
    req.storeName = decoded.storeName
    req.role = decoded.role

    return next()
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(401).send({ message: 'Unauthorized!' })
  }
}

export default authJwt
