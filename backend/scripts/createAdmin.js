import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import connectDB from '../config/db.js';

dotenv.config();

async function createAdmin() {
  try {
    await connectDB();
    console.log('📦 Connected to database');

    const adminEmail = process.env.ADMIN_EMAIL || '@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Mamatwins@73';

    // Check if user already exists
    let user = await User.findOne({ email: adminEmail });
    
    if (user) {
      console.log('⚠️ User already exists:', adminEmail);
      
      // Check if admin record exists
      const admin = await Admin.findOne({ userId: user._id });
      if (admin) {
        console.log('✅ Admin user already exists');
        process.exit(0);
      }
      
      // Create admin record for existing user
      const newAdmin = new Admin({
        userId: user._id,
        role: 'super_admin',
        isActive: true
      });
      await newAdmin.save();
      console.log('✅ Admin record created for existing user');
      process.exit(0);
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    user = new User({
      firstName: 'Admin',
      lastName: 'FISSK',
      email: adminEmail,
      password: hashedPassword,
      userType: 'admin',
      isVerified: true,
      isActive: true
    });
    await user.save();

    // Create admin record
    const admin = new Admin({
      userId: user._id,
      role: 'super_admin',
      isActive: true,
      createdBy: user._id
    });
    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️ Please change the password after first login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();