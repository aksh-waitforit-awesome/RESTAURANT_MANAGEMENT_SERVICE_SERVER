const ForbiddenError = require("../errors/forbiddenError");

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError("Access denied");
    }
    next();
  };
};

module.exports = allowRoles;
