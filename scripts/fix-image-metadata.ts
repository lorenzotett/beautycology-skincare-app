#!/usr/bin/env tsx
// Script per riparare tutti i metadati delle immagini nei messaggi esistenti

import fs from 'fs';
import path from 'path';
import { db } from '../server/db';
import { chatMessages } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function fixImageMetadata() {
  console.log('🔧 Fixing image metadata for all messages...');
  
  // Get all user messages with images
  const messagesWithImages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.role, 'user'));
  
  let fixedCount = 0;
  let totalImagesFound = 0;
  
  for (const message of messagesWithImages) {
    const metadata = message.metadata as any;
    
    if (metadata?.hasImage && metadata?.imagePath && !metadata?.image) {
      totalImagesFound++;
      const fileName = path.basename(metadata.imagePath);
      const imageUrl = `/api/images/${fileName}`;
      
      // Check if file actually exists
      const primaryPath = path.join(process.cwd(), 'uploads', fileName);
      const backupPath = path.join(process.cwd(), 'uploads', 'backup', fileName);
      
      if (fs.existsSync(primaryPath) || fs.existsSync(backupPath)) {
        // Update the metadata to include the image URL
        const updatedMetadata = {
          ...metadata,
          image: imageUrl
        };
        
        await db
          .update(chatMessages)
          .set({ metadata: updatedMetadata })
          .where(eq(chatMessages.id, message.id));
        
        console.log(`✅ Fixed: ${fileName} (Message ID: ${message.id})`);
        fixedCount++;
      } else {
        console.log(`❌ Missing file: ${fileName} (Message ID: ${message.id})`);
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`- Total images found: ${totalImagesFound}`);
  console.log(`- Successfully fixed: ${fixedCount}`);
  console.log(`- Missing files: ${totalImagesFound - fixedCount}`);
}

// Run the fix immediately
fixImageMetadata()
  .then(() => {
    console.log('✅ Image metadata fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fixing image metadata:', error);
    process.exit(1);
  });