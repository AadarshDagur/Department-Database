const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    console.log('Starting clear and seed...');

    const tables = [
      'student_details', 'otp_details',
      'achievement_participants', 'achievements',
      'event_organizers', 'events',
      'project_members', 'projects',
      'student_project_members', 'student_projects',
      'publication_authors', 'publications',
      'user_notifications', 'broadcast_notifications',
      'queries', 'approve_requests', 'edit_history', 'visits',
      'research_labs', 'users', 'batches'
    ];

    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    console.log('Database cleared.');

    const hash = await bcrypt.hash('12345678', 10);

    const bRes = await pool.query(
      `INSERT INTO batches (degree, year) VALUES
       ('UG', 2021), ('UG', 2022), ('UG', 2023), ('PG', 2023), ('PhD', 2020)    
       RETURNING id, degree, year`
    );

    const batches = bRes.rows;

    const admins = await pool.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash, user_type) VALUES
       ('admin1', 'Admin', 'One', 'admin1@gmail.com', $1, 'admin') RETURNING id`,
      [hash]
    );

    let facsSql = "INSERT INTO users (username, first_name, last_name, email, password_hash, user_type) VALUES\n";
    const facVals = [];
    for(let i=1; i<=10; i++){
        facsSql += `('faculty${i}', 'Faculty', '${i}', 'faculty${i}@gmail.com', $1, 'faculty')${i===10 ? '' : ','}\n`;
    }
    facsSql += "RETURNING id";
    const facs = await pool.query(facsSql, [hash]);

    let studsSql = "INSERT INTO users (username, first_name, last_name, email, password_hash, user_type) VALUES\n";
    for(let i=1; i<=10; i++){
        studsSql += `('student${i}', 'Student', '${i}', 'student${i}@gmail.com', $1, 'student')${i===10 ? '' : ','}\n`;
    }
    studsSql += "RETURNING id";
    const studs = await pool.query(studsSql, [hash]);

    let studDetSql = "INSERT INTO student_details (user_id, entry_number, degree, batch_id, faculty_advisor_id) VALUES\n";
    const studDetVals = [];
    let pcount = 1;
    for(let i=0; i<10; i++){
        studDetVals.push(studs.rows[i].id);
        const en = `202${i%3}CSB100${i}`;
        studDetVals.push(en);
        studDetVals.push('UG');
        studDetVals.push(batches[i % 3].id);
        studDetVals.push(facs.rows[i % 3].id);
        
        studDetSql += `($${pcount++}, $${pcount++}, $${pcount++}, $${pcount++}, $${pcount++})${i===9 ? '' : ',\n'}`;
    }
    await pool.query(studDetSql, studDetVals);

    console.log('Users inserted. Inserting dynamic entities...');

    // Publications
    const pubsData = [
      ["Deep Learning for Medical Image Analysis", "An overview of DL in health"],
      ["A Novel Approach to NLP using Transformers", "Applying attention to language"],
      ["Blockchain in Supply Chain Management", "Enhancing trust in logistics"],
      ["Optimization Algorithms in Cloud Computing", "Survey of heuristic bounds"],
      ["Cybersecurity Protocols for IoT Devices", "Hardening edge networks"],
      ["Predictive Analytics in Renewable Energy", "Forecasting solar power grids"],
      ["Machine Learning for Financial Forecasting", "Stock market predictor models"],
      ["Graph Neural Networks for Drug Discovery", "Synthesizing safe compounds"],
      ["Reinforcement Learning in Robotics", "Walking policies via deep RL"],
      ["Security Challenges in Quantum Computing", "Post-quantum cryptosystems"]
    ];

    let pubSql = `INSERT INTO publications (title, description, publication_type, status, doi, isbn, issn, journal_name, publisher, volume, pages, year, month, published_date, accepted_date, url, object_type, created_by, is_draft) VALUES\n`;
    const pubVals = [];
    for(let i=0; i<10; i++){
       pubVals.push(pubsData[i][0], pubsData[i][1], i%2===0?'Journal':'Conference', 'Published', `10.100${i}/xyz${i}`, `978-3-16-148410-${i}`, `1234-567${i}`, `Journal of AI ${i}`, `Springer ${i}`, `${i+1}`, `${i*10}-${i*10+15}`, 2026, 'April', `2026-04-0${i+1}`, `2026-02-0${(i%9)+1}`, `https://example.com/pub${i}`, 'A', facs.rows[i].id, false);
       pubSql += `($${i*19+1}, $${i*19+2}, $${i*19+3}, $${i*19+4}, $${i*19+5}, $${i*19+6}, $${i*19+7}, $${i*19+8}, $${i*19+9}, $${i*19+10}, $${i*19+11}, $${i*19+12}, $${i*19+13}, $${i*19+14}, $${i*19+15}, $${i*19+16}, $${i*19+17}, $${i*19+18}, $${i*19+19})${i===9?'':',\n'}`;
    }
    pubSql += "RETURNING id";
    const pubs = await pool.query(pubSql, pubVals);

    let pubAuthSql = "INSERT INTO publication_authors (publication_id, user_id) VALUES ";
    const pubAuthVals = [];
    let paCount = 1;
    for(let i=0; i<10; i++){
        pubAuthVals.push(pubs.rows[i].id, facs.rows[i].id);
        pubAuthSql += `($${paCount++}, $${paCount++})${i===9?'':', '}`;
    }
    await pool.query(pubAuthSql, pubAuthVals);

    // Achievements
    const achData = [
      "Winner, National Level Hackathon",
      "Gold Medalist in ACM ICPC",
      "Best Research Paper Award",
      "Google Summer of Code Finalist",
      "Outstanding Student Award",
      "AWS Cloud Challenge Winner",
      "Top Coder at CodeForces",
      "First Prize at Smart India Hackathon",
      "IBM Certified Solutions Architect",
      "Microsoft AI Hackathon Runner-up"
    ];
    let achSql = `INSERT INTO achievements (title, description, achievement_type, position, event_name, event_date, url, created_by) VALUES\n`;
    const achVals = [];
    for(let i=0; i<10; i++){
       achVals.push(achData[i], `${achData[i]} details`, 'Competition', `1st`, `Event ${i}`, `2026-01-1${i%9+1}`, `http://example.com/achieve${i}`, studs.rows[i].id);
       achSql += `($${i*8+1}, $${i*8+2}, $${i*8+3}, $${i*8+4}, $${i*8+5}, $${i*8+6}, $${i*8+7}, $${i*8+8})${i===9?'':',\n'}`;
    }
    achSql += "RETURNING id";
    const achs = await pool.query(achSql, achVals);

    let achPartSql = "INSERT INTO achievement_participants (achievement_id, user_id) VALUES ";
    const achPartVals = [];
    let apCount = 1;
    for(let i=0; i<10; i++){
        achPartVals.push(achs.rows[i].id, studs.rows[i].id);
        achPartSql += `($${apCount++}, $${apCount++})${i===9?'':', '}`;
    }
    await pool.query(achPartSql, achPartVals);

    // Events
    const evData = [
      "International Conference on AI 2025",
      "Web3 and Blockchain Summit",
      "Cybersecurity Awareness Workshop",
      "Data Science Symposium",
      "Cloud Computing Masterclass",
      "Next-Gen Robotics Expo",
      "IoT Innovations Summit",
      "Machine Learning Bootcamp",
      "Quantum Computing Seminar",
      "Software Engineering Hackathon"
    ];
    let evSql = `INSERT INTO events (title, description, event_type, speakers, participant_count, start_date, end_date, venue, url, created_by) VALUES\n`;
    const evVals = [];
    for(let i=0; i<10; i++){
       evVals.push(evData[i], `${evData[i]} description`, 'Workshop', `Prof. Speaker ${i}`, 150+i, `2026-05-0${i%9+1}`, `2026-05-0${i%9+5}`, `Auditorium ${i}`, `http://events.com/${i}`, admins.rows[0].id);
       evSql += `($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})${i===9?'':',\n'}`;
    }
    evSql += "RETURNING id";
    const evs = await pool.query(evSql, evVals);

    let evOrgSql = "INSERT INTO event_organizers (event_id, user_id) VALUES ";
    const evOrgVals = [];
    let eoCount = 1;
    for(let i=0; i<10; i++){
        evOrgVals.push(evs.rows[i].id, admins.rows[0].id);
        evOrgSql += `($${eoCount++}, $${eoCount++})${i===9?'':', '}`;
    }
    await pool.query(evOrgSql, evOrgVals);

    const projs = [
      "AI-based Disease Prediction System",
      "Blockchain Voting Platform",
      "Autonomous Drone Navigation System",
      "Smart Home Energy Manager",
      "Real-time Traffic Monitoring System",
      "Personalized E-Learning Assistant",
      "Gesture Recognition Interface",
      "Automated Malware Detection Tool",
      "Voice-controlled Wheelchair",
      "Decentralized Finance Tracker"
    ];

    // Student Projects
    let sprojSql = `INSERT INTO student_projects (title, description, status, mentor_id, start_date, end_date, url, created_by) VALUES\n`;
    const sprojVals = [];
    for(let i=0; i<10; i++){
       sprojVals.push(projs[i], `${projs[i]} description`, 'Ongoing', facs.rows[i].id, `2026-01-01`, `2026-12-31`, `http://studentproj.com/${i}`, studs.rows[i].id);
       sprojSql += `($${i*8+1}, $${i*8+2}, $${i*8+3}, $${i*8+4}, $${i*8+5}, $${i*8+6}, $${i*8+7}, $${i*8+8})${i===9?'':',\n'}`;
    }
    sprojSql += "RETURNING id";
    const sprojs = await pool.query(sprojSql, sprojVals);

    let spmSql = "INSERT INTO student_project_members (student_project_id, user_id) VALUES ";
    const spmVals = [];
    let spmCount = 1;
    for(let i=0; i<10; i++){
        spmVals.push(sprojs.rows[i].id, studs.rows[i].id);
        spmSql += `($${spmCount++}, $${spmCount++})${i===9?'':', '}`;
    }
    await pool.query(spmSql, spmVals);

    const fprojsData = [
      "Scalable Architecture for Big Data",
      "Advanced Natural Language Processing Models",
      "Secure IoT Framework for Smart Cities",
      "Real-time Image Synthesis",
      "Advanced Compiler Optimization",
      "Next-Generation Battery Technology Integration",
      "Autonomous Vehicle Mapping",
      "Cyber-Physical System Verification",
      "Large Scale Database Search Improvements",
      "Cryptographic Key Exchange Mechanisms"
    ];

    // Projects (Faculty)
    let fprojSql = `INSERT INTO projects (title, description, code, status, investment, start_date, end_date, url, created_by) VALUES\n`;
    const fprojVals = [];
    for(let i=0; i<10; i++){
       fprojVals.push(fprojsData[i], `${fprojsData[i]} description`, `PRJ-${i}`, 'Ongoing', 1000000 + i*50000, `2025-06-01`, `2028-05-31`, `http://facproj.com/${i}`, facs.rows[i].id);
       fprojSql += `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})${i===9?'':',\n'}`;
    }
    fprojSql += "RETURNING id";
    const fprojs = await pool.query(fprojSql, fprojVals);

    let fpmSql = "INSERT INTO project_members (project_id, user_id) VALUES ";
    const fpmVals = [];
    let fpmCount = 1;
    for(let i=0; i<10; i++){
        fpmVals.push(fprojs.rows[i].id, facs.rows[i].id);
        fpmSql += `($${fpmCount++}, $${fpmCount++})${i===9?'':', '}`;
    }
    await pool.query(fpmSql, fpmVals);


    const vData = [
      ["Industrial Visit to Google Bangalore", "Google Bangalore"],
      ["Research Tour at Microsoft Research", "Microsoft Research"],
      ["Technical Visit to ISRO Supercomputer Centre", "ISRO"],
      ["Study Visit to TCS Innovation Lab", "TCS"],
      ["IBM Quantum Research Lab Tour", "IBM"],
      ["Amazon Web Services Facility Visit", "AWS"],
      ["Infosys Global Education Center Tour", "Infosys"],
      ["Intel Software Development Lab Visit", "Intel"],
      ["Wipro Campus Industrial Tour", "Wipro"],
      ["Cisco R&D Center Visit", "Cisco"]
    ];
    // Visits
    let vSql = `INSERT INTO visits (title, description, visit_type, institution, from_date, to_date, url, visitor_id, created_by) VALUES\n`;
    const vVals = [];
    for(let i=0; i<10; i++){
       vVals.push(vData[i][0], `Toured facility ${i}`, 'Seminar', vData[i][1], `2026-10-0${i%9+1}`, `2026-10-0${i%9+3}`, `http://visit.com/${i}`, facs.rows[i].id, facs.rows[i].id);
       vSql += `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})${i===9?'':',\n'}`;  
    }
    await pool.query(vSql, vVals);

    // Research Labs
    const rData = [
      "Artificial Intelligence Lab",
      "Blockchain Research Center",
      "Robotics and Automation Lab",
      "Cybersecurity Cell",
      "Data Analytics Institute",
      "Cloud Computing Hub",
      "IoT Innovation Lab",
      "Quantum Computing Base",
      "Computer Vision Lab",
      "Networking Systems Lab"
    ];
    let rSql = `INSERT INTO research_labs (name, description, lab_type, code, head_id, equipment, website, address) VALUES\n`;
    const rVals = [];
    for(let i=0; i<10; i++){
       rVals.push(rData[i], `${rData[i]} is awesome`, 'Research Lab', `LAB${i}`, facs.rows[i].id, `Servers, GPUs`, `http://lab.com/${i}`, `Room L${100+i}`); 
       rSql += `($${i*8+1}, $${i*8+2}, $${i*8+3}, $${i*8+4}, $${i*8+5}, $${i*8+6}, $${i*8+7}, $${i*8+8})${i===9?'':',\n'}`;  
    }
    await pool.query(rSql, rVals);


    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
  }
}

seed();
