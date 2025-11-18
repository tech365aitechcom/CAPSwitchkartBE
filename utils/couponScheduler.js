import cron from "node-cron";
import CouponModel from "../models/couponModel.js";

const scheduleCouponExpiryCheck = () => {
  cron.schedule(
    "1 0 * * *",
    async () => {
      try {
        const now = new Date();
        const result = await CouponModel.updateMany(
          {
            status: "Active",
            validTo: { $lt: now },
          },
          {
            $set: { status: "Inactive" },
          }
        );

        if (result.modifiedCount > 0) {
          console.log(
            `Successfully deactivated ${result.modifiedCount} expired coupons.`
          );
        } else {
          console.log("No expired coupons to deactivate.");
        }
      } catch (error) {
        console.error("Error during scheduled coupon expiry check:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );
};

export default scheduleCouponExpiryCheck;
