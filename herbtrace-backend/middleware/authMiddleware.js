const jwt = require("jsonwebtoken");

const protect = (requiredRole) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided." });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role !== requiredRole) {
        return res.status(403).json({ error: `This action requires the ${requiredRole} role.` });
      }

      req.user = decoded; // attach it, in case the route wants userId/role later
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
};

module.exports = protect;