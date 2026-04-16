CSV upload samples for this app.

Files included:
- `publications_sample.csv`
- `projects_sample.csv`
- `events_sample.csv`
- `achievements_sample.csv`
- `visits_sample.csv`
- `student_projects_sample.csv`
- `users_sample.csv`

Notes:
- For `authors`, `members`, `organizers`, and `participants`, the importer accepts comma-separated emails. It also now accepts full names for publications, but emails are the safest format.
- `research_labs` does not currently have a CSV upload route, so there is no import sample for it yet.
- `visits` CSV upload does not currently accept `visitor_id`; uploaded visits are created by the logged-in user.
- `student_projects` CSV upload does not currently accept `mentor_id`; it imports only the fields wired in `routes/studentProjects.js`.
- `users` bulk upload is separate from the generic CSV importer and expects the columns shown in `users_sample.csv`.

Current-user-based emails used here:
- `test2@gmail.com`
- `test3@gmail.com`
- `test4@gmail.com`
- `test5@gmail.com`
- `test6@gmail.com`
- `test7@gmail.com`

User upload note:
- `faculty_advisor_email` is still set to `abcd@gmail.com` in the sample because that matches your current user-upload format. This advisor email must already exist as a faculty user in the database for user CSV import to succeed.
