import moment from "moment";

function timeRangeCal(time, fromdate, todate) {
  const now = moment().utc();

  const getTimeRange = (inputTime) => {
    switch (inputTime) {
      case "today":
        return { startDate: now.clone().startOf("day"), endDate: now.clone().endOf("day") };
      case "yesterday":
        return { startDate: now.clone().subtract(1, "days").startOf("day"), endDate: now.clone().subtract(1, "days").endOf("day") };
      case "7days":
      case "7 days":
        return { startDate: now.clone().subtract(7, "days"), endDate: now.clone() };
      case "15days":
      case "15 days":
        return { startDate: now.clone().subtract(15, "days"), endDate: now.clone() };
      case "lastmonth":
      case "1 month":
        return { startDate: now.clone().subtract(1, "months").startOf("month"), endDate: now.clone().subtract(1, "months").endOf("month") };
      case "thismonth":
        return { startDate: now.clone().startOf("month"), endDate: now.clone().endOf("month") };
      default:
        return { startDate: now.clone().startOf("year"), endDate: now.clone().endOf("day") };
    }
  };

  if (time) {
    return getTimeRange(time);
  }

  if (fromdate && todate) {
    return { startDate: moment(fromdate).startOf("day"), endDate: moment(todate).endOf("day") };
  }

  if (fromdate) {
    return { startDate: moment(fromdate).startOf("day"), endDate: now.clone().endOf("day") };
  }

  if (todate) {
    return { startDate: now.clone().startOf("year"), endDate: moment(todate).endOf("day") };
  }

  return { startDate: now.clone().startOf("year"), endDate: now.clone().endOf("day") };
}

export default { timeRangeCal };
