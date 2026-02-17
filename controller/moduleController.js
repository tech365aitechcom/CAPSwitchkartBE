import moduleModel from '../models/moduleModel.js'

const getModule = async (req, res) => {
  try {
    const config = await moduleModel.findOne().sort({ updatedAt: -1 })
    if (!config) {
      return res
        .status(404)
        .json({ success: false, message: 'Module config not found' })
    }
    return res.status(200).json(config)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

const updateModule = async (req, res) => {
  try {
    const config = await moduleModel.findOne().sort({ createdAt: -1 })
    if (!config) {
      const newConfig = await moduleModel.create({
        ...req.body,
        createdBy: req.userId,
      })
      return res.status(201).json(newConfig)
    }
    const updated = await moduleModel.findByIdAndUpdate(
      config._id,
      { ...req.body, updatedBy: req.userId },
      { new: true },
    )
    return res.status(200).json(updated)
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export default { getModule, updateModule }
