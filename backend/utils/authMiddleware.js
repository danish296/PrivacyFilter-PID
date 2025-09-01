const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_jwt_secret_here'; // use env var in prod

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid' });
  }
};
