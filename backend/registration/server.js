import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
const Regisrouter = express.Router();

import cookieParser from "cookie-parser";
import session from "express-session";

// Configuration
const saltRounds = 10; // For bcrypt hashing

// MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root', // replace with your MySQL username
    password: '', // replace with your MySQL password
    database: 'fissk_online_academy',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create users table if not exists
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        connection.release();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
}

initializeDatabase();

Regisrouter.use(session({
secret:'fissk',
resave:false,
saveUninitialized:false,
cookie: {
    secure:false, //set to true if using HTTPS
    maxAge: 24*60*60*1000 //24 hours
}
}));

// Middleware: check if user is instructor
function isInstructor(req, res, next) {
    if (!req.session.user || req.session.user.user_type !== 'instructor') {
        return res.status(403).json({
            success: false,
            message: 'Access denied'
        });
    }
    next();
}


// Registration endpoint
Regisrouter.post('/instructor-register', async (req, res) => {
    const { firstName, lastName, phone, email, password, bio, qualifications, experience_years } = req.body;
    const user = {
        firstname: `${firstName}`,
        lastname: `${lastName}`,
        email: `${email}`,
        user_type: 'instructor',
        bio: `${bio}`,
        qualifications: `${qualifications}`,
        experience_years: `${experience_years}`,
        phone: `${phone}`
    };
 //   console.log(experience_years)

    if (!firstName || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required',
            field: !firstName ? 'name' : !email ? 'email' : 'password'
        });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
                field: 'email'
            });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await pool.query(
            'INSERT INTO users (first_name, last_name, phone, email, password, user_type, bio, qualifications, experience_years) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [firstName, lastName, phone, email, hashedPassword, user.user_type, bio, qualifications, experience_years]
        );

       
        // 🔥 Store user in session
        req.session.user = user;

     //   console.log('Session:', req.session);

        // ⛔ DO NOT MODIFY THIS RESPONSE (your instruction)
        res.json({ success: true, message: 'User registered successfully' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


Regisrouter.post('/student-register', async (req, res) => {
    const { firstName, lastName, phone, email, password } = req.body;
    const user = {
        firstname: `${firstName}`,
        lastname: `${lastName}`,
        email: `${email}`,
        phone: `${phone}`,
        user_type: 'student'
    };

    if (!firstName || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required',
            field: !firstName ? 'name' : !email ? 'email' : 'password'
        });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
                field: 'email'
            });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
     
             await pool.query(
            'INSERT INTO users (first_name, last_name, phone, email, password, user_type) VALUES (?,?, ?, ?, ?, ?)',
            [firstName, lastName, phone, email, hashedPassword, user.user_type]
        );
        
        // 🔥 Store user in session
        req.session.user = user;

      //  console.log('Session:', req.session);

        // ⛔ DO NOT MODIFY THIS RESPONSE (your instruction)
        res.json({ success: true, message: 'User registered successfully' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Login endpoint (example - not in original code)
Regisrouter.post('/student-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND user_type = "student"', [email]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        let sessionUser = {
            id: user.id,
            firstname: `${user.first_name}`,
            lastname: `${user.last_name}`,
            email: `${user.email}`,
            user_type: user.user_type || "student"
        };

        // ⛔ DO NOT CHANGE THIS RESPONSE
        res.json({
            success: true,
            message: 'Login successful',
            sessionUser
        });

        // 🔥 Store session AFTER sending JSON (as you demanded)
        req.session.user = sessionUser;

        //console.log('Session:', req.session.user);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.post('/instructor-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND user_type = "instructor"', [email]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        let sessionUser = {
            id: user.id,
            firstname: `${user.first_name}`,
            lastname: `${user.last_name}`,
            email: `${user.email}`,
            user_type: user.user_type || "student"
        };

        // ⛔ DO NOT CHANGE THIS RESPONSE
        res.json({
            success: true,
            message: 'Login successful',
            sessionUser
        });

        // 🔥 Store session AFTER sending JSON (as you demanded)
        req.session.user = sessionUser;

     //   console.log('Session:', req.session.user);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.get('/session-variables', async (req, res) => {
    const user = req.session.user;

    res.send({ 
        success: true, 
        message: 'session successful',
        userData: user
    });

    //console.log(user);
});
Regisrouter.get('/logout', async (req, res) => {
    req.session.destroy();
    res.send("You are logged out");
});

Regisrouter.get('/user', async (req, res) => {
    
  //  console.log(req.session.user);
    return res.json({ 
        success: true, 
        message: 'session successful',
        userData: req.session.user
    });
});

Regisrouter.post('/create-class', async (req, res) => {
    const {email, payload } = req.body;
   // console.log(payload.title, email)
      // Find user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
        
        const user = users[0];
   
   /* if (!req.session.user || req.session.user.user_type !== 'instructor') {
        return res.status(403).json({ 
            success: false, 
            message: 'Only instructors can create classes'
        });
    }*/
    
    try {
        // Check if class already exists
        const [classes] = await pool.query('SELECT * FROM classes WHERE title = ?', [payload.title]);
        if (classes.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Class already created',
                field: 'class name'
            });
        }
        
        await pool.query(
            `INSERT INTO classes (title, description, category, level, duration, instructor_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [payload.title, payload.description, payload.category, payload.level, payload.duration, user.id]
        );
        
        res.json({ success: true, message: 'Class created successfully' });
    } catch (error) {
        console.error('Course creation error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }

});

Regisrouter.post('/join-class', async (req, res) => {
    const { email, classId } = req.body;
    
 //   console.log(classId, email)
    try {
        // Find user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
        
        const user = users[0];
          const [classes] = await pool.query('SELECT * FROM classes WHERE id = ?', [classId]);
        
        if (classes.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
        
        const classB = classes[0];
    //    console.log(classB);

          // Check if already enrolled
        const [existing] = await pool.query(
            'SELECT * FROM enrollments WHERE user_id = ? AND class_id = ?',
            [user.id, classB.id]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Already enrolled in this class' 
            });
        }
               
        // Insert new user with hashed password
        await pool.query(
            'INSERT INTO enrollments (user_id, class_id ) VALUES (?, ?)',
            [user.id, classB.id]
        );

        res.json({ success: true, message: 'Class registered successfully' });
    } catch (error) {
        console.error('Course creation error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }

});

Regisrouter.get('/classes', async (req, res) => {
   const [classes] = await pool.query(
        'SELECT * FROM classes ORDER BY id DESC'
    );
    res.json({
        success:true,
        classes
    });
});

Regisrouter.get('/classes-on-homepage', async (req, res) => {
   const [classes] = await pool.query(
        'SELECT * FROM classes ORDER BY id DESC LIMIT 3'
    );
    res.json({
        success:true,
        classes
    });
});

Regisrouter.post('/user-progress', async (req, res) => {
    const { userId, classId } = req.body;
   const [progress] = await pool.query(
        'SELECT progress FROM enrollments WHERE user_id = ? AND class_id = ?', [userId, classId]
    );
    res.json({
        success:true,
        progress
    });
});

Regisrouter.post('/get-user-classes', async (req, res) => {
    const { email } = req.body;
    
    try {
        // Find user by email
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
        
        const user = users[0];
     //   console.log(user);
   const [classes] = await pool.query( `
        SELECT 
            e.class_id,
            e.progress,
            e.completed,
            e.enrolled_at,
            e.last_accessed,
            c.*
        FROM enrollments AS e
        JOIN users AS u ON u.id = e.user_id
        JOIN classes AS c ON c.id = e.class_id
        WHERE u.id = ?
    `, [user.id]
    );
    res.json({
        success:true,
        classes: classes
    });
      } catch (error) {
        console.error('Course creation error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.post('/dashboard/live-sessions', async (req, res) => {
    const { id } = req.body;
    console.log(id)
    //write the sql to get specific live sessions for students based on their registered classes
    try {
        // Upcoming Sessions
        const [upcoming] = await pool.execute(
            ` SELECT 
    e.class_id,
    c.title AS class_title,
    ls.id AS session_id,
    ls.title AS session_title,
    ls.description,
    ls.date,
    ls.time,
    ls.duration,
    ls.session_type,
    CONCAT(u.first_name, ' ', u.last_name) AS instructor
FROM enrollments e
JOIN classes c 
    ON c.id = e.class_id
JOIN live_sessions ls 
    ON ls.class_id = c.id
JOIN users u 
    ON u.id = c.instructor_id
WHERE e.user_id = ?
  AND ls.session_type = 'upcoming'
ORDER BY ls.date ASC, ls.time ASC;  `, [id]
        );

        // Recorded Sessions
        const [recorded] = await pool.execute(
            ` SELECT 
    e.class_id,
    c.title AS class_title,
    ls.id AS session_id,
    ls.title AS session_title,
    ls.description,
    ls.date,
    ls.time,
    ls.duration,
    ls.session_type,
    CONCAT(u.first_name, ' ', u.last_name) AS instructor
FROM enrollments e
JOIN classes c 
    ON c.id = e.class_id
JOIN live_sessions ls 
    ON ls.class_id = c.id
JOIN users u 
    ON u.id = c.instructor_id
WHERE e.user_id = ?
  AND ls.session_type = 'recorded'
ORDER BY ls.date ASC, ls.time ASC; `, [id]
        );

        return res.json({
            upcoming,
            recorded
        });

    } catch (error) {
        console.error("Live session error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

Regisrouter.post('/class/upcoming', async (req, res) => {
    const { id } = req.body;
    console.log(id)
    //write the sql to get specific live sessions for students based on their registered classes
    try {
        // Upcoming Sessions
        const [upcoming] = await pool.execute(
            ` SELECT 
    ls.id AS session_id,
    ls.title AS session_title,
    ls.description,
    ls.date,
    ls.time,
    ls.duration,
    ls.session_type
FROM live_sessions ls 
WHERE ls.class_id = ?
  AND ls.session_type = 'upcoming'
ORDER BY ls.date ASC, ls.time ASC;   `, [id]
        );
        return res.json({
            upcoming
        });

    } catch (error) {
        console.error("Live session error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


Regisrouter.post('/dashboard/learning-time', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        // Get user ID
        const [user] = await pool.execute(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (user.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const userId = user[0].id;

        // Sum total learning time
        const [result] = await pool.execute(
            `SELECT SUM(time_spent_seconds) AS total_seconds 
             FROM user_progress WHERE user_id = ?`,
            [userId]
        );

        const totalSeconds = result[0].total_seconds || 0;

        // Convert seconds → hours & minutes
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
       
        return res.json({
            total_seconds: totalSeconds,
            readable: `${hours}h ${minutes}m`
        });

    } catch (error) {
        console.error("Learning time error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


    Regisrouter.post('/dashboard/load-stats', async (req, res) => {
        const  {id}  = req.body;
        //console.log(instructorId)
    try {
   /*     const [[stats]] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM classes WHERE instructor_id = ?) AS totalClasses,
                (SELECT COUNT(*) 
                    FROM enrollments e 
                    JOIN classes c ON e.class_id = c.id
                    WHERE c.instructor_id = ?) AS totalStudents,
                (SELECT COUNT(*) 
                    FROM live_sessions l 
                    JOIN users u ON l.instructor_id = u.id
                    WHERE u.id = ?) AS totalVideos,
                (SELECT COALESCE(AVG(rating),0) 
                    FROM classes WHERE instructor_id = ?) AS avgRating
         `, [insId, id, insId, insId]);
*/
        const [[notifications]] = await pool.query(`SELECT * FROM notifications WHERE user_id = ?`, [id]);
        
        const stats = {
            'notifications': notifications,

         };
        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching stats" });
    }
    });


Regisrouter.get('/instructor/session', (req, res) => {
    if (!req.session.user || req.session.user.user_type !== "instructor") {
        return res.status(403).json({
            success: false,
            message: "Not logged in as instructor"
        });
    }

    res.json({
        success: true,
        instructor: req.session.user
    });
});


Regisrouter.post('/classes/instructor', async (req, res) => {
    const { instructor_id } = req.body;
    
    
    try {
        // Find user by email
        const [instructor] = await pool.query('SELECT * FROM users WHERE user_type="instructor" AND id = ?', [instructor_id]);
        
        if (instructor.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials'
            });
        }
        
        const instructorB = instructor[0];
       // console.log(instructorB);
   
    res.json({
        success:true,
        instructorData: instructorB
    });
      } catch (error) {
        console.error('Course creation error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.get('/class/:classId', async (req, res) => {
    const classId = req.params.classId;
   const [classA] = await pool.query('SELECT * FROM classes WHERE id = ?', [classId] );
    res.json({
        success:true,
        classA
    });
});

Regisrouter.post('/instructor/classes/:id', async (req, res) => {
  const classId = req.params.id;
  const {id} = req.body;
console.log(id)
const [rows] = await pool.execute(`
SELECT c.*, COUNT(e.id) student_count
FROM classes c
LEFT JOIN enrollments e ON e.class_id=c.id
WHERE c.id=? AND c.instructor_id=?
GROUP BY c.id
`, [classId, id]);
res.json(rows[0]);

});

Regisrouter.get('/instructor/classes/:id/students', async (req,res)=>{
const [rows] = await pool.execute(`
SELECT u.first_name,u.last_name,u.email,e.progress, e.enrolled_at, e.last_accessed
FROM enrollments e
JOIN users u ON u.id=e.user_id
WHERE e.class_id=?
`, [req.params.id]);

res.json(rows);
});

Regisrouter.get('/instructor/classes/:id/streams', async (req,res)=>{
const [rows] = await pool.execute(`
SELECT * FROM live_sessions
WHERE class_id=? AND session_type='upcoming'
ORDER BY date ASC,time ASC
`, [req.params.id]);

res.json(rows);
});

Regisrouter.delete('/instructor/videos/:id', async (req,res)=>{
    const {id} =req.body;
await pool.execute(
`DELETE FROM live_sessions WHERE id=? AND instructor_id=?`,
[req.params.id, id]
);
res.json({ok:true});
});

Regisrouter.delete('/instructor/streams/:id', async (req,res)=>{
    const {id} =req.body;
await pool.execute(
`DELETE FROM live_sessions WHERE id=? AND instructor_id=?`,
[req.params.id, id]
);
res.json({ok:true});
});

Regisrouter.get('/instructor/classes/:id/videos', async (req, res) => {
  const [videos] = await pool.query(`
    SELECT id,title,duration,url
FROM live_sessions
WHERE class_id=? AND session_type='recorded'
ORDER BY created_at ASC
 `, [req.params.id]);

  res.json(videos);
});

Regisrouter.get('/instructor/classes/:id/sessions', async (req, res) => {
  const [sessions] = await pool.query(
    'SELECT * FROM live_sessions WHERE class_id = ? ORDER BY date DESC',
    [req.params.id]
  );
  res.json(sessions);
});

Regisrouter.get('/instructor/classes/:id/assignments', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM assignments WHERE class_id = ?',
    [req.params.id]
  );
  res.json(rows);
});

Regisrouter.post('/instructor/classes', async (req, res) => {
    const { id } = req.body;
    try {
        const [classes] = await pool.query(`
            SELECT c.*, 
                   COUNT(e.id) as enrolled_students,
                   AVG(e.progress) as avg_progress
            FROM classes c
            LEFT JOIN enrollments e ON c.id = e.class_id
            WHERE c.instructor_id = ?
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [id]);
        
        res.json({
            success: true,
            classes: classes
        });
    } catch (error) {
        console.error('Get instructor classes error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.post('/instructor/enrollments', async (req, res) => {
    const {instructorId} = req.body;
    
    try {
        const [rows] = await pool.query(`
             SELECT 
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                e.progress,
                e.enrolled_at,
                e.last_accessed,
                c.title
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            JOIN classes c ON c.id = e.class_id
            WHERE c.instructor_id = ?
      `, [instructorId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load enrollments" });
    }
    });

Regisrouter.post('/instructor/enrollments/:classId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                e.progress,
                e.enrolled_at,
                e.last_accessed
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            WHERE e.class_id = ?
         `, [classId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load enrollments" });
    }
    });

    Regisrouter.post('/instructor/stats', async (req, res) => {
        const  instructorId  = req.body;
        //console.log(instructorId)
        const insId = instructorId.id;
    try {
        const [[stats]] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM classes WHERE instructor_id = ?) AS totalClasses,
                (SELECT COUNT(*) 
                    FROM enrollments e 
                    JOIN classes c ON e.class_id = c.id
                    WHERE c.instructor_id = ?) AS totalStudents,
                (SELECT COUNT(*) 
                    FROM live_sessions l 
                    JOIN users u ON l.instructor_id = u.id
                    WHERE u.id = ?) AS totalVideos,
                (SELECT COALESCE(AVG(rating),0) 
                    FROM classes WHERE instructor_id = ?) AS avgRating
         `, [insId, insId, insId, insId]);

        res.json(stats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching stats" });
    }
    });

Regisrouter.post('/progress/update', async (req, res) => {
    const { classId, userId, progress } = req.body;
    
    try {
        await pool.query(
            'UPDATE enrollments SET progress = ?, last_accessed = NOW() WHERE user_id = ? AND class_id = ?',
            [progress, userId, classId]
        );
        
        res.json({ 
            success: true, 
            message: 'Progress updated successfully' 
        });
    } catch (error) {
        console.error('Progress update error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

Regisrouter.post('/instructor/scheduled-sessions', async (req, res) => {
    const { instructorId } = req.body;
     try {
        const [streams] = await pool.query(`
            SELECT 
                ls.id,
                ls.title,
                ls.description,
                ls.date,
                ls.time,
                c.title AS class_title
            FROM live_sessions ls
            JOIN classes c ON c.id = ls.id
            WHERE ls.instructor_id = ?
              AND ls.session_type = 'upcoming'
            ORDER BY ls.date ASC, ls.time ASC
    `, [instructorId]);

        // Convert date + time → JS datetime string
        const formatted = streams.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            scheduled_time: `${s.date} ${s.time}`
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load scheduled streams" });
    }
});


Regisrouter.post('/instructor/schedule-stream', async (req, res) => {
    const { payload, id } = req.body;
  //  console.log(req.body)
    if (!payload.scheduledTime) {
        return res.status(400).json({ message: "scheduledTime is required" });
    }

    const [date, time] = payload.scheduledTime.split("T");
    
    try {
        await pool.query(`
            INSERT INTO live_sessions 
            (instructor_id, title, description, date, time, session_type, class_id)
            VALUES (?, ?, ?, ?, ?, 'upcoming', ?)
        `, [id, payload.title, payload.description, date, time, payload.classId]);

        res.json({ message: "Live stream scheduled successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to schedule stream" });
    }
});

Regisrouter.post('/instructor/streams', async (req, res) => {
    const instructoId = req.body;
    const instructorId = instructoId.id;
    try {
        const [rows] = await pool.query(`
          SELECT 
                ls.id,
                ls.title,
                ls.description,
                ls.date,
                ls.time,
                ls.duration,
                ls.participants,
                ls.class_id,
                c.title AS class_title
            FROM live_sessions ls
            JOIN classes c ON c.id = ls.instructor_id
            WHERE ls.instructor_id = ?
              AND ls.session_type = 'recorded'
            ORDER BY ls.date DESC, ls.time DESC
      `, [instructorId]);

        const pastStreams = rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            class_title: r.class_title,
            duration: r.duration,
            participants: r.participants,
            recorded_at: `${r.date} ${r.time}`,
            class_id: r.class_id
        }));


          const [streams] = await pool.query(`
            SELECT 
                ls.id,
                ls.title,
                ls.description,
                ls.date,
                ls.time,
                c.title AS class_title
            FROM live_sessions ls
            JOIN classes c ON c.id = ls.id
            WHERE ls.instructor_id = ?
              AND ls.session_type = 'upcoming'
            ORDER BY ls.date ASC, ls.time ASC
    `, [instructorId]);

        // Convert date + time → JS datetime string
        const scheduledStreams = streams.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            scheduled_time: `${s.date} ${s.time}`
        }));


        res.json({
            past: pastStreams,
            scheduled: scheduledStreams
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load past streams" });
    }
});

Regisrouter.post('/instructor/create-assignment', async (req, res) => {
   const instructorId = req.body;
    const { class_id, title, description, instructions, due_date, max_points } = req.body;

    try {
        // Validate if class belongs to instructor
        const [[cls]] = await pool.query(
            "SELECT id FROM classes WHERE id = ? AND instructor_id = ?",
            [class_id, instructorId]
        );

        if (!cls) {
            return res.status(403).json({ message: "You cannot add assignments to this class" });
        }

        await pool.query(`
            INSERT INTO assignments 
            (class_id, title, description, instructions, due_date, max_points)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [class_id, title, description, instructions, due_date, max_points]);

        res.json({ message: "Assignment created successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to create assignment" });
    }
});

Regisrouter.get('/instructor/classes/:classId/assignment', async (req, res) => {
 const instructorId = req.body;
    const classId = req.params.classId;

    try {
        // Validate instructor owns this class
        const [[cls]] = await pool.query(
            "SELECT id FROM classes WHERE id = ? AND instructor_id = ?",
            [classId, instructorId]
        );

        if (!cls) return res.status(403).json({ message: "Unauthorized" });

        const [rows] = await pool.query(`
            SELECT *
            FROM assignments
            WHERE class_id = ?
            ORDER BY created_at DESC
        `, [classId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not load assignments" });
    }
});


export default Regisrouter;
