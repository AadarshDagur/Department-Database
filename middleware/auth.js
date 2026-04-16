const { normalizeUserType } = require('../utils/helpers');

// Authentication middleware
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'You must be logged in');
  res.redirect('/login');
}

// Role-based access
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'You must be logged in');
      return res.redirect('/login');
    }
    const normalizedRole = normalizeUserType(req.session.user.user_type);
    const normalizedAllowed = roles.map(normalizeUserType);
    if (!normalizedAllowed.includes(normalizedRole)) {
      req.flash('error', 'You do not have permission to access this page');
      return res.redirect('/dashboard');
    }
    next();
  };
}

// At least faculty level
function isFacultyOrAbove(req, res, next) {
  const allowed = ['faculty', 'admin'];
  if (!req.session.user || !allowed.includes(normalizeUserType(req.session.user.user_type))) {
    req.flash('error', 'Faculty access required');
    return res.redirect('/dashboard');
  }
  next();
}

// Faculty only
function isFaculty(req, res, next) {
  if (!req.session.user || normalizeUserType(req.session.user.user_type) !== 'faculty') {
    req.flash('error', 'Faculty access required');
    return res.redirect('/dashboard');
  }
  next();
}

// Admin only
function isStaffOrAdmin(req, res, next) {
  const allowed = ['admin'];
  if (!req.session.user || !allowed.includes(normalizeUserType(req.session.user.user_type))) {
    req.flash('error', 'Admin access required');
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { isLoggedIn, requireRole, isFacultyOrAbove, isFaculty, isStaffOrAdmin };
