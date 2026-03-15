// Baby Tracker Data Schema
// This schema defines the core models for tracking baby activities including sleep, feeding, diapers, and general observations

model Baby {
  id          String   @id @default(uuid())
  firstName   String
  lastName    String
  birthDate   DateTime
  gender      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relationships
  sleepLogs   SleepLog[]
  feedLogs    FeedLog[]
  diaperLogs  DiaperLog[]
  moodLogs    MoodLog[]
  notes       Note[]
}

model SleepLog {
  id        String   @id @default(uuid())
  startTime DateTime
  endTime   DateTime?
  duration  Int?     // Duration in minutes, calculated from start/end
  type      String   // 'nap' or 'nightSleep'
  location  String?  // Where the baby slept
  quality   String?  // 'poor', 'fair', 'good', 'excellent'
  createdAt DateTime @default(now())
  
  // Relationships
  baby      Baby     @relation(fields: [babyId], references: [id])
  babyId    String
}

model FeedLog {
  id        String   @id @default(uuid())
  time      DateTime
  type      String   // 'breast', 'bottle', 'solids'
  amount    Float?   // In ml for bottles, minutes for nursing
  side      String?  // 'left', 'right', null for bottle/solids
  food      String?  // Description of solid foods
  createdAt DateTime @default(now())
  
  // Relationships
  baby      Baby     @relation(fields: [babyId], references: [id])
  babyId    String
}

model DiaperLog {
  id        String   @id @default(uuid())
  time      DateTime
  type      String   // 'wet', 'dirty', 'both'
  condition String?  // Any notable conditions
  color     String?  // Color of contents
  createdAt DateTime @default(now())
  
  // Relationships
  baby      Baby     @relation(fields: [babyId], references: [id])
  babyId    String
}

model MoodLog {
  id        String   @id @default(uuid())
  time      DateTime
  mood      String   // 'happy', 'calm', 'fussy', 'crying'
  intensity Int?     // Scale of 1-5
  duration  Int?     // Duration in minutes
  createdAt DateTime @default(now())
  
  // Relationships
  baby      Baby     @relation(fields: [babyId], references: [id])
  babyId    String
}

model Note {
  id        String   @id @default(uuid())
  time      DateTime
  content   String   // The actual note content
  category  String?  // Optional categorization
  createdAt DateTime @default(now())
  
  // Relationships
  baby      Baby     @relation(fields: [babyId], references: [id])
  babyId    String
}