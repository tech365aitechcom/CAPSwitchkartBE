import moment from "moment";
import offers from "../models/offerModel.js";

async function createOffer(req, res) {
  const userId = req.userId;
  req.body.createdBy = userId;
  const { offerName, price, validFrom, validTo, warranty, createdBy } =
    req.body;

  if (
    !offerName ||
    !price ||
    !validFrom ||
    !validTo ||
    !createdBy ||
    warranty === undefined
  ) {
    return res.status(400).send({ error: "All fields are required" });
  }

  try {
    const offer = new offers({
      offerName,
      price,
      validFrom,
      validTo,
      createdBy,
      warranty,
    });

    const savedOffer = await offer.save();

    const responseOffer = {
      _id: savedOffer._id,
      offerName: savedOffer.offerName,
      price: savedOffer.price,
      validFrom: savedOffer.validFrom,
      validTo: savedOffer.validTo,
      createdBy: savedOffer.createdBy,
      warranty: savedOffer.warranty,
    };

    return res.status(201).send(responseOffer);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
}

async function editOffer(req, res) {
  const { id } = req.params;
  console.log(id);
  const userId = req.userId;
  req.body.updatedBy = userId;
  delete req.body.createdBy;
  const { offerName, price, validFrom, validTo, updatedBy, warranty } =
    req.body;

  if (
    !offerName ||
    !price ||
    !validFrom ||
    !validTo ||
    !updatedBy ||
    warranty === undefined
  ) {
    return res.status(400).send({ error: "All fields are required" });
  }

  try {
    const updatedOffer = await offers.findByIdAndUpdate(
      id,
      {
        offerName,
        price,
        validFrom,
        validTo,
        updatedBy,
        warranty,
      },
      { new: true }
    );

    if (!updatedOffer) {
      return res.status(404).send({ error: "Offer not found" });
    }

    return res.status(200).json({ message: "sucessfully updated offer" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
}

async function getOfferList(req, res) {
  try {
    const { search, fromdate, todate } = req.query;
    let startDate, endDate;

    if (fromdate && todate) {
      startDate = moment(fromdate).startOf("day");
      endDate = moment(todate).endOf("day");
    }

    const query = {};
    if (startDate && endDate) {
      query.validFrom = { $gte: startDate.toDate() };
      query.validTo = { $lte: endDate.toDate() };
    }

    if (search) {
      const searchNumber = Number(search);
      const searchBoolean = search.toLowerCase() === "true";
      query.$or = [
        { offerName: { $regex: search, $options: "i" } },
      ];
      if (search.toLowerCase() === "true" || search.toLowerCase() === "false"){
        query.$or.push({ warranty: searchBoolean });
      }
      if (!isNaN(searchNumber)) {
        query.$or.push({ price: searchNumber });
      }
    }
    const allOffers = await offers.find(query);

    const responseOffers = allOffers.map((offer) => ({
      _id: offer._id,
      offerName: offer.offerName,
      price: offer.price,
      validFrom: offer.validFrom,
      validTo: offer.validTo,
      createdBy: offer.createdBy,
      warranty: offer.warranty,
    }));

    return res.status(200).json(responseOffers);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
}

async function deleteOffer(req, res) {
  const { id } = req.params;

  try {
    const deletedOffer = await offers.findByIdAndRemove(id);

    if (!deletedOffer) {
      return res.status(404).send({ error: "Offer not found" });
    }

    return res.status(200).json({ message: "Offer successfully deleted" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
}

export default { createOffer, editOffer, getOfferList, deleteOffer };
