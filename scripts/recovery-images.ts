#!/usr/bin/env tsx
// Script per recuperare le immagini perse e ricostruire i metadati

import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { chatMessages } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function recoverLostImages() {
  console.log('🔍 Scanning for lost images...');
  
  // Get all messages with images
  const messagesWithImages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.role, 'user'));
  
  let missingCount = 0;
  let recoveredCount = 0;
  
  for (const message of messagesWithImages) {
    const metadata = message.metadata as any;
    
    if (metadata?.hasImage && metadata?.imagePath) {
      const fileName = path.basename(metadata.imagePath);
      const primaryPath = path.join(process.cwd(), 'uploads', fileName);
      const backupPath = path.join(process.cwd(), 'uploads', 'backup', fileName);
      
      // Check if image exists
      const existsInPrimary = fs.existsSync(primaryPath);
      const existsInBackup = fs.existsSync(backupPath);
      
      if (!existsInPrimary && !existsInBackup) {
        missingCount++;
        console.log(`❌ Missing: ${fileName} (Session: ${message.sessionId})`);
        
        // Try to find similar files
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const files = fs.readdirSync(uploadsDir);
        const similarFiles = files.filter(f => 
          f.includes(fileName.split('-')[1]) || // Same timestamp
          f.includes(metadata.imageOriginalName?.split('.')[0]) // Same original name
        );
        
        if (similarFiles.length > 0) {
          console.log(`  → Found similar files: ${similarFiles.join(', ')}`);
          recoveredCount++;
        }
      } else if (!existsInPrimary && existsInBackup) {
        // Copy from backup to primary
        console.log(`📋 Restoring from backup: ${fileName}`);
        fs.copyFileSync(backupPath, primaryPath);
        recoveredCount++;
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total missing images: ${missingCount}`);
  console.log(`   Images recovered: ${recoveredCount}`);
  console.log(`   Still missing: ${missingCount - recoveredCount}`);
}

// Run recovery
recoverLostImages()
  .then(() => {
    console.log('✅ Recovery process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Recovery failed:', error);
    process.exit(1);
  });