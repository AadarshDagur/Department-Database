# Department Database Management System

A comprehensive Node.js-based web application designed to manage, store, and display records for an academic or research department. Built with Express, PostgreSQL, and EJS, it provides features ranging from managing user profiles (Students, Faculty, and Admins) to tracking department publications, projects, achievements, events, and visits. 

## Features

- **User Roles & Authorization**: Role-based access control governing Admin, Faculty, and Student privileges.
- **Bulk Data Uploads via CSV**: Support for importing hundreds of records directly into PostgreSQL tables with relation mapping (e.g., matching external CSV members to existing registered users).
- **CRUD Entities**: 
  - Achievements
  - Events
  - Projects & Student Projects
  - Publications
  - Research Labs & Visits
- **Secure File Storage**: Supports image & document attachments, designed to integrate seamlessly mapped filesystem handlers (including serverless implementations).
- **EJS Server-side Rendering**: Fully encapsulated views utilizing Bootstrap layouts.
- **Automated Email Notifications**: Nodemailer-based broadcast and OTP verification flows.

## Tech Stack

- **Backend**: Node.js & Express
- **Database**: PostgreSQL (with `pg` and `connect-pg-simple` for session management)
- **Authentication**: Custom Auth with bcrypt hashing and session cookies
- **View Engine**: EJS (Embedded JavaScript templates) & EJS-Mate
- **File Uploads**: Multer
- **Data Parsing**: `csv-parse/sync`

## Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) database

### 2. Setup

Clone the repository and install the initial dependencies:
```bash
git clone https://github.com/your-username/department-database.git
cd department-database
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory based on the `.env.example` structure:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/dep_db
SESSION_SECRET=your_super_secret_cookie_key

# Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 4. Database Setup & Seeding
Initialize the database schemas and run the pre-configured mock seeded data to populate default `user` accounts (such as `faculty1@gmail.com` to `faculty10@gmail.com`, etc.):
```bash
npm run db:setup
npm run db:seed
```

### 5. Start the Application
```bash
npm run dev
```
Navigate your browser to `http://localhost:3000`.

## Deployment (Vercel)

This application is configured out-of-the-box to run gracefully on serverless edge environments such as **Vercel**. 

1. Ensure your external PostgreSQL is accessible (e.g., Supabase, Neon, or Railway) and the `DATABASE_URL` is set in Vercel's environment variables.
2. Ensure Vercel `NODE_ENV` is set to `production`.
3. Simply deploy using the Vercel CLI:
```bash
npm i -g vercel
vercel --prod
```

## Structure
- `/config`: Database connection singletons.
- `/db`: Migration, setup, and bulk seeding scripts.
- `/middleware`: Authentication guards and Multer file rules.
- `/routes`: Explicit entity and HTTP routing endpoints.
- `/sample_csv`: Dummy data templates matching current strict mapping for CSV bulk-upload systems.
- `/views`: EJS server templates structured by entity category.
