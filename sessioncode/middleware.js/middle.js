const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Not logged in" });
  }
  next();
};

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.Middleware = requireAuth;
