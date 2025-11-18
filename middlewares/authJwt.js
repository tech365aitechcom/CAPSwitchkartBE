import jwt from "jsonwebtoken";

const allowedDomains = "https://buyback.grest.in";

const authJwt = (req, res, next) => {
  try {
    let tokenVerified = false;
    const origin = req.headers["origin"];
    const apiPath = req.path;
    console.log(origin, " ", apiPath);

    if (origin === allowedDomains) {
      console.log("bypass");
      req.userId = "6540d7df4058702d148699e8";
      req.storeName = "GRESTBYPASS";
      return next();
    }

    const token = req.headers["authorization"];
    if (!token) {
      return res.status(403).send({ message: "No token provided!" });
    }

    jwt.verify(token, process.env.JWT_SECERET, (err, decoded) => {
      if (err) {
        tokenVerified = false;
      } else {
        req.userId = decoded.userId;
        req.storeName = decoded.storeName;
        tokenVerified = true;
      }
    });

    if (tokenVerified) {
      return next();
    } else {
      return res.status(401).send({ message: "Unauthorized!" });
    }
  } catch (error) {
    return res.status(500).send({ message: "Token Authorization Failed" });
  }
};

export default authJwt;
