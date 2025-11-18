
const receiptController = async (req, res) => {
  try {
    return res.status(200).json({ url: "receiptUrl" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate receipt." });
  }
};

export default {receiptController};
