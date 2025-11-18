import discounts from "../models/discountsModel.js";
import leads from "../models/leadsModel.js";

const create = async (req, res) => {
  try {
    const data = await discounts.create(req.body);
    return res
      .status(200)
      .json({ data, message: "Discount created successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(403).json({ message: "id is required", status: 403 });
    }
    await discounts.findByIdAndUpdate({ _id: id }, req.body);
    return res.status(200).json({ message: "Discount updated successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const findByLeadId = async (req, res) => {
  try {
    const { leadId } = req.query;
    if (!leadId) {
      return res
        .status(403)
        .json({ message: "leadId is required", status: 403 });
    }
    const data = await discounts.find({ leadId });
    if (!data.length) {
      return res
        .status(400)
        .json({ message: "Discount does not exist for selected lead" });
    }
    return res
      .status(200)
      .json({ data, message: "Discount fetched successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const applyDiscount = async (req, res) => {
  try {
    const { leadId, discount } = req.body;
    if (!leadId || !discount) {
      return res
        .status(403)
        .json({ message: "leadId and Discount are required", status: 403 });
    }
    const lead = await leads.findById(leadId).select("price actualPrice");
    if (lead) {
      lead.price = lead.actualPrice + parseInt(discount);
      await leads.findByIdAndUpdate({ _id: lead._id }, lead);
      lead.price = lead.price + lead.bonusPrice;
      return res
        .status(200)
        .json({ data: lead, message: "Discount applied successfully." });
    } else {
      return res
        .status(404)
        .json({ data: lead, message: "Lead does not exist." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export default {
  create,
  update,
  findByLeadId,
  applyDiscount,
};
