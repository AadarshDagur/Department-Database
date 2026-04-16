-- Department Database Management System - PostgreSQL Schema

-- Drop existing tables and types if recreating (Uncomment if needed)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- User roles enum
CREATE TYPE user_type AS ENUM ('faculty', 'student', 'admin');

-- Departments

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) DEFAULT '',
  username VARCHAR(150) UNIQUE NOT NULL,
  user_type user_type NOT NULL DEFAULT 'student',
  profile_image VARCHAR(500) DEFAULT '/uploads/defaults/profile.png',
  cover_image VARCHAR(500) DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  is_doctorate BOOLEAN DEFAULT FALSE,
  get_otp_email BOOLEAN DEFAULT TRUE,
  get_email_notification BOOLEAN DEFAULT TRUE,
  get_email_broadcast BOOLEAN DEFAULT TRUE,
  date_joined TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);


-- OTP
CREATE TABLE otp_details (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE
);

-- Batches
CREATE TABLE batches (
  id SERIAL PRIMARY KEY,
  degree VARCHAR(20) NOT NULL DEFAULT 'UG' CHECK (degree IN ('UG', 'PG', 'PhD')),
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Student details
CREATE TABLE student_details (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_number VARCHAR(50),
  degree VARCHAR(20) DEFAULT 'UG',
  faculty_advisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL
);

-- =========================================
-- BaseModel fields (shared by content tables)
-- is_draft, object_type, is_approved, is_deleted,
-- deleted_by, deleted_at, created_by, created_date,
-- draft_id, users_text, tags_text
-- =========================================

-- Publications
CREATE TABLE publications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  publication_type VARCHAR(20) DEFAULT 'Journal' CHECK (publication_type IN ('Journal', 'Conference', 'Book', 'Book Chapter', 'Patent')),
  status VARCHAR(20) DEFAULT 'Published' CHECK (status IN ('Published', 'Submitted', 'Accepted', 'Rejected')),
  doi VARCHAR(200),
  isbn VARCHAR(50),
  issn VARCHAR(50),
  corpus_id VARCHAR(100),
  journal_name VARCHAR(300),
  publisher VARCHAR(300),
  volume VARCHAR(50),
  pages VARCHAR(50),
  year INTEGER,
  month VARCHAR(20),
  url VARCHAR(500),
  field_tags TEXT[] DEFAULT '{}',
  published_date DATE,
  accepted_date DATE,
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A' CHECK (object_type IN ('DR', 'P', 'A', 'R')),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE publication_authors (
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, user_id)
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  code VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'Ongoing' CHECK (status IN ('Ongoing', 'Completed', 'Cancelled')),
  investment DECIMAL(15, 2),
  start_date DATE,
  end_date DATE,
  url VARCHAR(500),
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_type VARCHAR(30) DEFAULT 'Workshop' CHECK (event_type IN ('Workshop', 'Conference', 'Seminar', 'Invited Lecture')),
  speakers TEXT,
  participant_count INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  venue VARCHAR(300),
  url VARCHAR(500),
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE event_organizers (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  achievement_type VARCHAR(30) DEFAULT 'Hackathon' CHECK (achievement_type IN ('Hackathon', 'Competition', 'Internship')),
  position VARCHAR(100),
  event_name VARCHAR(300),
  event_date DATE,
  url VARCHAR(500),
  faculty_approval INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE achievement_participants (
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (achievement_id, user_id)
);

CREATE TABLE visits (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  visit_type VARCHAR(30) DEFAULT 'Lecture' CHECK (visit_type IN ('Lecture', 'Conference', 'Seminar')),
  institution VARCHAR(300),
  from_date DATE,
  to_date DATE,
  url VARCHAR(500),
  visitor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE student_projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Ongoing' CHECK (status IN ('Ongoing', 'Completed', 'Cancelled')),
  mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  url VARCHAR(500),
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE student_project_members (
  student_project_id INTEGER NOT NULL REFERENCES student_projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (student_project_id, user_id)
);

CREATE TABLE research_labs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  lab_type VARCHAR(20) DEFAULT 'Research Lab' CHECK (lab_type IN ('UG Lab', 'PG Lab', 'Research Lab')),
  code VARCHAR(50) UNIQUE,
  head_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  equipment TEXT,
  website VARCHAR(500),
  address VARCHAR(500),
  -- BaseModel fields
  is_draft BOOLEAN DEFAULT FALSE,
  object_type VARCHAR(5) DEFAULT 'A',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  draft_id INTEGER,
  users_text TEXT,
  tags_text TEXT
);

CREATE TABLE user_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE broadcast_notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  message TEXT,
  target_role user_type,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Queries / Issues
CREATE TABLE queries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(50) DEFAULT 'Bug' CHECK (category IN ('Bug', 'Feature Request', 'General', 'Other')),
  subject VARCHAR(300) NOT NULL,
  description TEXT,
  screenshot VARCHAR(500),
  status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approve Requests (for achievements)
CREATE TABLE approve_requests (
  id SERIAL PRIMARY KEY,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Edit History (tracks changes to content)
CREATE TABLE edit_history (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_publications_type ON publications(publication_type);
CREATE INDEX idx_publications_draft ON publications(is_draft);
CREATE INDEX idx_publications_deleted ON publications(is_deleted);
CREATE INDEX idx_publications_object_type ON publications(object_type);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_achievements_type ON achievements(achievement_type);
CREATE INDEX idx_otp_user ON otp_details(user_id);
CREATE INDEX idx_notifications_user ON user_notifications(user_id);
