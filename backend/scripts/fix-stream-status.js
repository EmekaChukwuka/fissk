// scripts/fix-stream-status.js
// Run this once to clean up existing data

import mongoose from 'mongoose';
import LiveSession from '../models/LiveSession.js';
import connectDB from '../config/db.js';

export async function fixStreamStatus() {
  await connectDB();
  console.log('🔍 Fixing stream statuses...');

  try {
    // 1. Find all streams
    const allStreams = await LiveSession.find({});
    console.log(`📊 Found ${allStreams.length} total streams`);

    let updatedCount = 0;

    for (const session of allStreams) {
      let needsUpdate = false;

      // ===== FIX: Determine the correct status based on available data =====
      
      // If streamStatus is 'live' but sessionType is not 'live'
      if (session.streamStatus === 'live' && session.sessionType !== 'live') {
        session.sessionType = 'live';
        needsUpdate = true;
      }

      // If streamStatus is 'scheduled' but sessionType is not 'upcoming'
      if (session.streamStatus === 'scheduled' && session.sessionType !== 'upcoming') {
        session.sessionType = 'upcoming';
        needsUpdate = true;
      }

      // If streamStatus is 'ended' but sessionType is not 'recorded'
      if (session.streamStatus === 'ended' && session.sessionType !== 'recorded') {
        session.sessionType = 'recorded';
        needsUpdate = true;
      }

      // ===== FIX: If sessionType is 'recorded' but streamStatus is not 'ended' =====
      if (session.sessionType === 'recorded' && session.streamStatus !== 'ended') {
        session.streamStatus = 'ended';
        needsUpdate = true;
      }

      // ===== FIX: If sessionType is 'upcoming' but streamStatus is not 'scheduled' =====
      if (session.sessionType === 'upcoming' && session.streamStatus !== 'scheduled') {
        session.streamStatus = 'scheduled';
        needsUpdate = true;
      }

      // ===== FIX: If sessionType is 'live' but streamStatus is not 'live' =====
      if (session.sessionType === 'live' && session.streamStatus !== 'live') {
        session.streamStatus = 'live';
        needsUpdate = true;
      }

      // ===== FIX: If both are missing, infer from date =====
      if (!session.streamStatus && !session.sessionType) {
        if (session.date && new Date(session.date) > new Date()) {
          session.streamStatus = 'scheduled';
          session.sessionType = 'upcoming';
        } else if (session.date && new Date(session.date) < new Date()) {
          session.streamStatus = 'ended';
          session.sessionType = 'recorded';
        } else {
          session.streamStatus = 'scheduled';
          session.sessionType = 'upcoming';
        }
        needsUpdate = true;
      }

      // ===== FIX: If only streamStatus exists =====
      if (session.streamStatus && !session.sessionType) {
        if (session.streamStatus === 'scheduled') {
          session.sessionType = 'upcoming';
        } else if (session.streamStatus === 'live') {
          session.sessionType = 'live';
        } else if (session.streamStatus === 'ended') {
          session.sessionType = 'recorded';
        }
        needsUpdate = true;
      }

      // ===== FIX: If only sessionType exists =====
      if (!session.streamStatus && session.sessionType) {
        if (session.sessionType === 'upcoming') {
          session.streamStatus = 'scheduled';
        } else if (session.sessionType === 'live') {
          session.streamStatus = 'live';
        } else if (session.sessionType === 'recorded') {
          session.streamStatus = 'ended';
        }
        needsUpdate = true;
      }

      // Save if updated
      if (needsUpdate) {
        await session.save();
        updatedCount++;
        console.log(`✅ Updated: ${session.title} -> status: ${session.streamStatus}, type: ${session.sessionType}`);
      }
    }

    console.log(`\n✅ Fixed ${updatedCount} streams`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}
