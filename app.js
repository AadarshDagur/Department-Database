require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const ejsMate = require('ejs-mate');
const pool = require('./config/database');
const { normalizeUserType } = require('./utils/helpers');

const app = express();

// View engine
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 20 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

// Flash messages
app.use(flash());

// Global template variables
app.use(async (req, res, next) => {
  try {
    let unreadNotifications = 0;
    if (req.session && req.session.user) {
      req.session.user.user_type = normalizeUserType(req.session.user.user_type);
      const notifResult = await pool.query(
        'SELECT COUNT(*) FROM user_notifications WHERE user_id = $1 AND is_read = FALSE',
        [req.session.user.id]
      );
      unreadNotifications = parseInt(notifResult.rows[0].count, 10) || 0;
    }

    res.locals.currentUser = req.session.user || null;
    res.locals.unreadNotifications = unreadNotifications;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/publications', require('./routes/publications'));
app.use('/projects', require('./routes/projects'));
app.use('/events', require('./routes/events'));
app.use('/achievements', require('./routes/achievements'));
app.use('/visits', require('./routes/visits'));
app.use('/student-projects', require('./routes/studentProjects'));
app.use('/research-labs', require('./routes/researchLabs'));
app.use('/batches', require('./routes/batches'));
app.use('/users', require('./routes/users'));
app.use('/notifications', require('./routes/notifications'));
app.use('/reports', require('./routes/reports'));
app.use('/approvals', require('./routes/approvals'));
app.use('/queries', require('./routes/queries'));
app.use('/profile', require('./routes/profile'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('errors/404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  req.flash('error', err.message || 'Something went wrong');
  res.status(500).render('errors/500', { error: err });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export the app for Vercel Serverless
module.exports = app;module.exports = app;
