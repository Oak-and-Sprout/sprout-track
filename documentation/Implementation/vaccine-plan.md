Vaccine Tracking Feature Plan                                            │
     │                                                                          │
     │ Context                                                                  │
     │                                                                          │
     │ Add end-to-end vaccine tracking to the baby tracker app. Two-tab form:   │
     │ (1) record vaccines with searchable top-50 list, file upload with        │
     │ AES-256-GCM encryption, (2) vaccine history with Excel export. Files     │
     │ stored in Files/ directory (not public), encrypted at rest using         │
     │ ENC_HASH from .env. Uses Syringe lucide icon for timeline and            │
     │ /public/vaccine-128.png for tile group. Color scheme: white bg + red     │
     │ outline + red syringe (light), transparent bg + red outline + red        │
     │ syringe (dark).                                                          │
     │                                                                          │
     │ ---                                                                      │
     │ 1. Database Schema                                                       │
     │                                                                          │
     │ File: prisma/schema.prisma                                               │
     │                                                                          │
     │ Add three new models, one junction table, and update four existing       │
     │ models:                                                                  │
     │                                                                          │
     │ model VaccineLog {                                                       │
     │   id            String    @id @default(uuid())                           │
     │   time          DateTime                                                 │
     │   vaccineName   String    // From top-50 list or custom entry            │
     │   doseNumber    Int?      // 1st, 2nd, 3rd, etc.                         │
     │   notes         String?                                                  │
     │   createdAt     DateTime  @default(now())                                │
     │   updatedAt     DateTime  @updatedAt                                     │
     │   deletedAt     DateTime?                                                │
     │                                                                          │
     │   family   Family? @relation(fields: [familyId], references: [id])       │
     │   familyId String?                                                       │
     │   baby        Baby       @relation(fields: [babyId], references: [id],   │
     │ onDelete: Cascade)                                                       │
     │   babyId      String                                                     │
     │   caretaker   Caretaker? @relation(fields: [caretakerId], references:    │
     │ [id])                                                                    │
     │   caretakerId String?                                                    │
     │   documents   VaccineDocument[]                                          │
     │   contacts    ContactVaccine[]  // Linked doctors/providers (like        │
     │ Medicine)                                                                │
     │                                                                          │
     │   @@index([time])                                                        │
     │   @@index([vaccineName])                                                 │
     │   @@index([babyId])                                                      │
     │   @@index([caretakerId])                                                 │
     │   @@index([deletedAt])                                                   │
     │   @@index([familyId])                                                    │
     │ }                                                                        │
     │                                                                          │
     │ model VaccineDocument {                                                  │
     │   id              String    @id @default(uuid())                         │
     │   originalName    String                                                 │
     │   storedName      String    // UUID.enc filename on disk                 │
     │   mimeType        String                                                 │
     │   fileSize        Int       // bytes                                     │
     │   createdAt       DateTime  @default(now())                              │
     │   updatedAt       DateTime  @updatedAt                                   │
     │                                                                          │
     │   vaccineLog   VaccineLog @relation(fields: [vaccineLogId], references:  │
     │ [id], onDelete: Cascade)                                                 │
     │   vaccineLogId String                                                    │
     │                                                                          │
     │   @@index([vaccineLogId])                                                │
     │ }                                                                        │
     │                                                                          │
     │ // Junction table (same pattern as ContactMedicine)                      │
     │ model ContactVaccine {                                                   │
     │   contact      Contact    @relation(fields: [contactId], references:     │
     │ [id], onDelete: Cascade)                                                 │
     │   contactId    String                                                    │
     │   vaccineLog   VaccineLog @relation(fields: [vaccineLogId], references:  │
     │ [id], onDelete: Cascade)                                                 │
     │   vaccineLogId String                                                    │
     │                                                                          │
     │   @@id([contactId, vaccineLogId])                                        │
     │   @@index([contactId])                                                   │
     │   @@index([vaccineLogId])                                                │
     │ }                                                                        │
     │                                                                          │
     │ Relation additions:                                                      │
     │ - Family: add vaccineLogs VaccineLog[]                                   │
     │ - Baby: add vaccineLogs VaccineLog[]                                     │
     │ - Caretaker: add vaccineLogs VaccineLog[]                                │
     │ - Contact: add vaccines ContactVaccine[]                                 │
     │                                                                          │
     │ Run: npx prisma migrate dev --name add-vaccine-tracking                  │
     │                                                                          │
     │ ---                                                                      │
     │ 2. API Types                                                             │
     │                                                                          │
     │ File: app/api/types.ts                                                   │
     │                                                                          │
     │ export type VaccineLogResponse = Omit<VaccineLog, 'time' | 'createdAt' | │
     │  'updatedAt' | 'deletedAt'> & {                                          │
     │   time: string;                                                          │
     │   createdAt: string;                                                     │
     │   updatedAt: string;                                                     │
     │   deletedAt: string | null;                                              │
     │   documents?: VaccineDocumentResponse[];                                 │
     │   contacts?: { contact: { id: string; name: string; role: string } }[];  │
     │ };                                                                       │
     │                                                                          │
     │ export type VaccineDocumentResponse = {                                  │
     │   id: string;                                                            │
     │   originalName: string;                                                  │
     │   mimeType: string;                                                      │
     │   fileSize: number;                                                      │
     │   createdAt: string;                                                     │
     │   updatedAt: string;                                                     │
     │ };                                                                       │
     │                                                                          │
     │ export interface VaccineLogCreate {                                      │
     │   babyId: string;                                                        │
     │   time: string;                                                          │
     │   vaccineName: string;                                                   │
     │   doseNumber?: number;                                                   │
     │   notes?: string;                                                        │
     │   contactIds?: string[];  // Linked contacts (doctors)                   │
     │ }                                                                        │
     │                                                                          │
     │ ---                                                                      │
     │ 3. File Encryption Utility                                               │
     │                                                                          │
     │ File (new): src/lib/file-encryption.ts                                   │
     │                                                                          │
     │ - Uses Node.js crypto module with AES-256-GCM                            │
     │ - Key: Buffer.from(process.env.ENC_HASH, 'hex') (64 hex chars = 32       │
     │ bytes)                                                                   │
     │ - Encrypt: Generate random 16-byte IV → encrypt → store as [IV           │
     │ (16)][AuthTag (16)][CipherText]                                          │
     │ - Decrypt: Read IV (first 16 bytes), AuthTag (next 16), CipherText       │
     │ (rest) → decrypt → return buffer                                         │
     │ - Storage directory: Files/ at project root (create if not exists)       │
     │ - Filenames: {uuid}.enc                                                  │
     │                                                                          │
     │ ---                                                                      │
     │ 4. API Routes                                                            │
     │                                                                          │
     │ 4a. Vaccine Log CRUD — app/api/vaccine-log/route.ts (new)                │
     │                                                                          │
     │ Follow app/api/medicine-log/route.ts pattern:                            │
     │ - POST: Create vaccine log (UTC conversion, family scoping, write        │
     │ protection, notification). Handle contactIds array → create              │
     │ ContactVaccine junction records (same pattern as medicine/contacts).     │
     │ - PUT: Update by ?id=. Update ContactVaccine links.                      │
     │ - GET: Fetch by id, babyId, date range. Include { documents: true,       │
     │ contacts: { include: { contact: true } } }. Support ?vaccines=true to    │
     │ return distinct vaccine names used.                                      │
     │ - DELETE: Delete by id + delete associated VaccineDocuments + delete     │
     │ encrypted files from disk                                                │
     │                                                                          │
     │ 4b. File Upload — app/api/vaccine-log/upload/route.ts (new)              │
     │                                                                          │
     │ - POST: Accept multipart/form-data with vaccineLogId + file              │
     │ - Parse with req.formData(), encrypt file buffer, write to               │
     │ Files/{uuid}.enc                                                         │
     │ - Create VaccineDocument record                                          │
     │ - Max file size: 10MB                                                    │
     │ - Auth required via withAuthContext                                      │
     │                                                                          │
     │ 4c. File Download — app/api/vaccine-log/file/[id]/route.ts (new)         │
     │                                                                          │
     │ - GET: Lookup VaccineDocument by id, verify family access                │
     │ - Decrypt file on-the-fly, return with correct Content-Type and          │
     │ Content-Disposition: attachment                                          │
     │ - Auth required                                                          │
     │                                                                          │
     │ 4d. Excel Export — app/api/vaccine-log/export/route.ts (new)             │
     │                                                                          │
     │ - GET: Accept babyId, startDate, endDate query params                    │
     │ - Install: npm install exceljs (plus @types/exceljs if needed)           │
     │ - Columns: Date, Vaccine Name, Dose #, Doctor/Contact, Notes, Has        │
     │ Documents (Y/N)                                                          │
     │ - Return as .xlsx download                                               │
     │                                                                          │
     │ ---                                                                      │
     │ 5. Constants: Top 50 Childhood Vaccines                                  │
     │                                                                          │
     │ File (new): src/constants/vaccines.ts                                    │
     │                                                                          │
     │ Array of ~50 common childhood vaccines: HepB, RV (Rotavirus), DTaP, Hib, │
     │  PCV13, PCV15, PCV20, IPV, Influenza, MMR, Varicella, HepA, MenACWY,     │
     │ MenB, Tdap, HPV, COVID-19, RSV, plus combination vaccines (Pediarix,     │
     │ Pentacel, Vaxelis, ProQuad, Kinrix, Twinrix, etc.).                      │
     │                                                                          │
     │ ---                                                                      │
     │ 6. Form Component (Two-Tab)                                              │
     │                                                                          │
     │ Directory (new): src/components/forms/VaccineForm/                       │
     │                                                                          │
     │ 6a. index.tsx — Main container (follows MedicineForm pattern)            │
     │                                                                          │
     │ - Tabs: [{ id: 'record', label: t('Record Vaccine'), icon: Syringe }, {  │
     │ id: 'history', label: t('Vaccine History'), icon: ClipboardList }]       │
     │ - State: activeTab, refreshTrigger                                       │
     │ - FormPage with tabs, activeTab, onTabChange props                       │
     │ - Props: isOpen, onClose, babyId, initialTime, activity?, onSuccess?     │
     │                                                                          │
     │ 6b. RecordVaccineTab.tsx — Tab 1                                         │
     │                                                                          │
     │ - DateTime picker (DateTimePicker component)                             │
     │ - Vaccine name combobox: Searchable dropdown filtering                   │
     │ CHILDHOOD_VACCINES constant + allow custom input (same pattern as        │
     │ NoteForm categories with inputRef, dropdownRef, filteredCategories,      │
     │ keyboard nav)                                                            │
     │ - Dose number: Select 1-6                                                │
     │ - Contact selector: Reuse ContactSelector component from MedicineForm    │
     │ (import from @/src/components/forms/MedicineForm/ContactSelector). Links │
     │  doctors/providers to the vaccine record.                                │
     │ - Notes: Optional textarea                                               │
     │ - File upload: Click-to-browse file input, accept images + PDF           │
     │   - On file select: POST to /api/vaccine-log/upload with FormData        │
     │   - Show uploaded docs list with delete option                           │
     │ - Submit: POST/PUT to /api/vaccine-log (includes contactIds array)       │
     │ - Edit mode: populate from activity prop                                 │
     │                                                                          │
     │ 6c. VaccineHistoryTab.tsx — Tab 2                                        │
     │                                                                          │
     │ - Fetch all vaccine logs for baby via /api/vaccine-log?babyId=...        │
     │ - Display chronological list: vaccine name, date, dose #, document       │
     │ indicator icon                                                           │
     │ - Click to expand: show details + document download links                │
     │ - Date range filter: two DateTimePickers for start/end                   │
     │ - Export button: calls                                                   │
     │ /api/vaccine-log/export?babyId=...&startDate=...&endDate=..., triggers   │
     │ download                                                                 │
     │                                                                          │
     │ 6d. vaccine-form.types.ts                                                │
     │                                                                          │
     │ 6e. vaccine-form.css — Dark mode overrides                               │
     │                                                                          │
     │ ---                                                                      │
     │ 7. Activity Tile Integration                                             │
     │                                                                          │
     │ 7a. Types — src/components/ui/activity-tile/activity-tile.types.ts       │
     │                                                                          │
     │ - Add VaccineLogResponse to ActivityType union                           │
     │ - Add 'vaccine' to ActivityTileVariant                                   │
     │                                                                          │
     │ 7b. Styles — src/components/ui/activity-tile/activity-tile.styles.ts     │
     │                                                                          │
     │ - button.variants: add vaccine: ""                                       │
     │ - iconContainer.variants: add vaccine: ""                                │
     │ - icon.variants: add vaccine: "text-red-600"                             │
     │ - icon.defaultIcons: add vaccine: '/vaccine-128.png'                     │
     │                                                                          │
     │ 7c. Utils — src/components/ui/activity-tile/activity-tile-utils.ts       │
     │                                                                          │
     │ - getActivityVariant(): add if ('vaccineName' in activity) return        │
     │ 'vaccine';                                                               │
     │ - useActivityDescription(): add vaccine description (vaccine name, dose  │
     │ #, date)                                                                 │
     │                                                                          │
     │ 7d. Icon — src/components/ui/activity-tile/activity-tile-icon.tsx        │
     │                                                                          │
     │ - Import Syringe from lucide-react                                       │
     │ - Add: if ('vaccineName' in activity) return <Syringe className="h-4     │
     │ w-4" style={{ color: '#EF4444' }} />;                                    │
     │                                                                          │
     │ 7e. Tile Group — src/components/ActivityTileGroup/index.tsx              │
     │                                                                          │
     │ - Add 'vaccine' to ActivityType union and all allActivityTypes arrays    │
     │ - Add vaccine: t('Vaccine') to activityDisplayNames                      │
     │ - Add case 'vaccine': in renderActivityTile() with stub activity         │
     │ containing vaccineName                                                   │
     │ - Add onVaccineClick?: () => void prop                                   │
     │                                                                          │
     │ 7f. Activity Settings — app/api/activity-settings/route.ts               │
     │                                                                          │
     │ - Add 'vaccine' to defaultSettings.order, defaultSettings.visible, and   │
     │ defaultActivities                                                        │
     │                                                                          │
     │ ---                                                                      │
     │ 8. Timeline Display Layer                                                │
     │                                                                          │
     │ 8a. Timeline Types — src/components/Timeline/types.ts                    │
     │                                                                          │
     │ - Add 'vaccine' to FilterType and onEdit type                            │
     │                                                                          │
     │ 8b. Timeline Utils — src/components/Timeline/utils.tsx                   │
     │                                                                          │
     │ Add before existing checks (use 'vaccineName' in activity as             │
     │ discriminator):                                                          │
     │ - getActivityIcon(): <Syringe className="h-4 w-4" style={{ color:        │
     │ '#EF4444' }} />                                                          │
     │ - getActivityStyle(): { bg: 'bg-white', textColor: 'text-red-600' }      │
     │ - getActivityDescription(): vaccine name + dose # + time                 │
     │ - getActivityDetails(): full detail panel (name, dose, site, provider,   │
     │ lot, notes, documents)                                                   │
     │ - getActivityEndpoint(): 'vaccine-log'                                   │
     │                                                                          │
     │ 8c. Timeline CSS — src/components/Timeline/timeline-activity-list.css    │
     │                                                                          │
     │ /* Light mode */                                                         │
     │ .event-icon.vaccine {                                                    │
     │   background: #ffffff;                                                   │
     │   border: 2px solid #EF4444;                                             │
     │ }                                                                        │
     │ .event-icon.vaccine svg, .event-icon.vaccine svg path {                  │
     │   color: #EF4444 !important;                                             │
     │   stroke: #EF4444 !important;                                            │
     │ }                                                                        │
     │ .timeline-event.vaccine::before {                                        │
     │   background: #EF4444 !important;                                        │
     │ }                                                                        │
     │ /* Dark mode */                                                          │
     │ html.dark .event-icon.vaccine {                                          │
     │   background: transparent !important;                                    │
     │   border: 2px solid #EF4444 !important;                                  │
     │ }                                                                        │
     │ html.dark .event-icon.vaccine svg, html.dark .event-icon.vaccine svg     │
     │ path {                                                                   │
     │   color: #EF4444 !important;                                             │
     │   stroke: #EF4444 !important;                                            │
     │ }                                                                        │
     │                                                                          │
     │ 8d. TimelineV2 Activity List —                                           │
     │ src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx            │
     │                                                                          │
     │ - Add vaccine activityTypeClass detection: if ('vaccineName' in          │
     │ activity) activityTypeClass = 'vaccine';                                 │
     │ - Add inline detail rendering for vaccine                                │
     │ - Add 'vaccine' to getActivityColor(): return '#EF4444'                  │
     │                                                                          │
     │ 8e. TimelineV2 Daily Stats —                                             │
     │ src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx              │
     │                                                                          │
     │ - Add vaccineCount counter                                               │
     │ - Add stat tile: Syringe icon, red #EF4444 color, count label            │
     │                                                                          │
     │ 8f. TimelineV2 Daily Stats CSS —                                         │
     │ src/components/Timeline/TimelineV2/TimelineV2DailyStats.css              │
     │                                                                          │
     │ html.dark .timeline-v2-daily-stats [class*="text-[#EF4444"] {            │
     │   color: #EF4444 !important;                                             │
     │ }                                                                        │
     │                                                                          │
     │ 8g. TimelineV2 Container — src/components/Timeline/TimelineV2/index.tsx  │
     │                                                                          │
     │ - Add 'vaccine' to editModalType and handleEdit types                    │
     │ - Add vaccine filter case                                                │
     │ - Add VaccineForm edit modal                                             │
     │                                                                          │
     │ 8h. Timeline Container (old) — src/components/Timeline/index.tsx         │
     │                                                                          │
     │ - Same changes as 8g                                                     │
     │                                                                          │
     │ 8i. Timeline Activity Details —                                          │
     │ src/components/Timeline/TimelineActivityDetails.tsx                      │
     │                                                                          │
     │ - Add vaccine edit handler check                                         │
     │                                                                          │
     │ 8j. FullLog Types —                                                      │
     │ src/components/FullLogTimeline/full-log-timeline.types.ts                │
     │                                                                          │
     │ - Add 'vaccine' to FilterType and onEdit type                            │
     │                                                                          │
     │ 8k. FullLog Filter — src/components/FullLogTimeline/FullLogFilter.tsx    │
     │                                                                          │
     │ - Add Syringe import, add vaccine filter option                          │
     │                                                                          │
     │ 8l. FullLog Activity Details —                                           │
     │ src/components/FullLogTimeline/FullLogActivityDetails.tsx                │
     │                                                                          │
     │ - Add vaccine edit handler                                               │
     │                                                                          │
     │ 8m. FullLog Container — src/components/FullLogTimeline/index.tsx         │
     │                                                                          │
     │ - Add 'vaccine' to editModalType, filter, search, form modal             │
     │                                                                          │
     │ ---                                                                      │
     │ 9. Timeline API                                                          │
     │                                                                          │
     │ File: app/api/timeline/route.ts                                          │
     │ - Add VaccineLogResponse to imports and ActivityTypeWithCaretaker union  │
     │ - Add prisma.vaccineLog.findMany() to Promise.all (with include: {       │
     │ documents: true })                                                       │
     │ - Format and spread into allActivities                                   │
     │                                                                          │
     │ ---                                                                      │
     │ 10. Log Entry Page                                                       │
     │                                                                          │
     │ File: app/(app)/[slug]/log-entry/page.tsx                                │
     │ - Import VaccineForm                                                     │
     │ - Add showVaccineModal state                                             │
     │ - Add onVaccineClick={() => setShowVaccineModal(true)} to                │
     │ ActivityTileGroup                                                        │
     │ - Render <VaccineForm> with standard props                               │
     │                                                                          │
     │ ---                                                                      │
     │ 11. Localization                                                         │
     │                                                                          │
     │ Files: en.json, es.json, fr.json                                         │
     │                                                                          │
     │ Key translations to add:                                                 │
     │                                                                          │
     │ ┌────────────────┬────────────────┬───────────────────┬───────────────── │
     │ ───┐                                                                     │
     │ │      Key       │       en       │        es         │         fr       │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Vaccine"      │ "Vaccine"      │ "Vacuna"          │ "Vaccin"         │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Record        │ "Record        │ "Registrar        │ "Enregistrer le  │
     │    │                                                                     │
     │ │ Vaccine"       │ Vaccine"       │ Vacuna"           │ Vaccin"          │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Vaccine       │ "Vaccine       │ "Historial de     │ "Historique des  │
     │    │                                                                     │
     │ │ History"       │ History"       │ Vacunas"          │ Vaccins"         │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Vaccine Name" │ "Vaccine Name" │ "Nombre de la     │ "Nom du Vaccin"  │
     │    │                                                                     │
     │ │                │                │ Vacuna"           │                  │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Dose Number"  │ "Dose Number"  │ "Número de Dosis" │ "Numéro de Dose" │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Injection     │ "Injection     │ "Sitio de         │ "Site            │
     │ d'Injection" │                                                           │
     │ │ Site"          │ Site"          │ Inyección"        │                  │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Provider"     │ "Provider"     │ "Proveedor"       │ "Fournisseur"    │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Lot Number"   │ "Lot Number"   │ "Número de Lote"  │ "Numéro de Lot"  │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Upload        │ "Upload        │ "Subir Documento" │ "Télécharger le  │
     │    │                                                                     │
     │ │ Document"      │ Document"      │                   │ Document"        │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Export to     │ "Export to     │ "Exportar a       │ "Exporter vers   │
     │    │                                                                     │
     │ │ Excel"         │ Excel"         │ Excel"            │ Excel"           │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Vaccine       │ "Vaccine       │ "Registro de      │ "Enregistrement  │
     │ de │                                                                     │
     │ │ Record"        │ Record"        │ Vacuna"           │  Vaccin"         │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Edit Vaccine" │ "Edit Vaccine" │ "Editar Vacuna"   │ "Modifier le     │
     │    │                                                                     │
     │ │                │                │                   │ Vaccin"          │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "New Vaccine"  │ "New Vaccine"  │ "Nueva Vacuna"    │ "Nouveau Vaccin" │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "No vaccines   │ "No vaccines   │ "No hay vacunas   │ "Aucun vaccin    │
     │    │                                                                     │
     │ │ recorded"      │ recorded"      │ registradas"      │ enregistré"      │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Download"     │ "Download"     │ "Descargar"       │ "Télécharger"    │
     │    │                                                                     │
     │ ├────────────────┼────────────────┼───────────────────┼───────────────── │
     │ ───┤                                                                     │
     │ │ "Select a      │ "Select a      │ "Seleccionar una  │ "Sélectionner un │
     │    │                                                                     │
     │ │ vaccine"       │ vaccine"       │ vacuna"           │ vaccin"          │
     │    │                                                                     │
     │ └────────────────┴────────────────┴───────────────────┴───────────────── │
     │ ───┘                                                                     │
     │                                                                          │
     │ Plus all 50 vaccine names (these stay in English across all locales as   │
     │ they are medical terms).                                                 │
     │                                                                          │
     │ Run: node scripts/check-missing-translations.js                          │
     │                                                                          │
     │ ---                                                                      │
     │ 12. Infrastructure                                                       │
     │                                                                          │
     │ - Add Files/ to .gitignore                                               │
     │ - Install: npm install exceljs                                           │
     │ - Create Files/ directory (or create on first upload)                    │
     │                                                                          │
     │ ---                                                                      │
     │ Files Summary                                                            │
     │                                                                          │
     │ New files (9):                                                           │
     │ 1. src/lib/file-encryption.ts                                            │
     │ 2. src/constants/vaccines.ts                                             │
     │ 3. app/api/vaccine-log/route.ts                                          │
     │ 4. app/api/vaccine-log/upload/route.ts                                   │
     │ 5. app/api/vaccine-log/file/[id]/route.ts                                │
     │ 6. app/api/vaccine-log/export/route.ts                                   │
     │ 7. src/components/forms/VaccineForm/index.tsx                            │
     │ 8. src/components/forms/VaccineForm/RecordVaccineTab.tsx                 │
     │ 9. src/components/forms/VaccineForm/VaccineHistoryTab.tsx                │
     │ 10. src/components/forms/VaccineForm/vaccine-form.types.ts               │
     │ 11. src/components/forms/VaccineForm/vaccine-form.css                    │
     │                                                                          │
     │ Modified files (~27):                                                    │
     │ 1. prisma/schema.prisma                                                  │
     │ 2. app/api/types.ts                                                      │
     │ 3. app/api/timeline/route.ts                                             │
     │ 4. app/api/activity-settings/route.ts                                    │
     │ 5. src/components/ui/activity-tile/activity-tile.types.ts                │
     │ 6. src/components/ui/activity-tile/activity-tile.styles.ts               │
     │ 7. src/components/ui/activity-tile/activity-tile-utils.ts                │
     │ 8. src/components/ui/activity-tile/activity-tile-icon.tsx                │
     │ 9. src/components/ActivityTileGroup/index.tsx                            │
     │ 10. src/components/Timeline/types.ts                                     │
     │ 11. src/components/Timeline/utils.tsx                                    │
     │ 12. src/components/Timeline/timeline-activity-list.css                   │
     │ 13. src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx        │
     │ 14. src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx          │
     │ 15. src/components/Timeline/TimelineV2/TimelineV2DailyStats.css          │
     │ 16. src/components/Timeline/TimelineV2/index.tsx                         │
     │ 17. src/components/Timeline/index.tsx                                    │
     │ 18. src/components/Timeline/TimelineActivityDetails.tsx                  │
     │ 19. src/components/FullLogTimeline/full-log-timeline.types.ts            │
     │ 20. src/components/FullLogTimeline/FullLogFilter.tsx                     │
     │ 21. src/components/FullLogTimeline/FullLogActivityDetails.tsx            │
     │ 22. src/components/FullLogTimeline/index.tsx                             │
     │ 23. app/(app)/[slug]/log-entry/page.tsx                                  │
     │ 24. src/localization/translations/en.json                                │
     │ 25. src/localization/translations/es.json                                │
     │ 26. src/localization/translations/fr.json                                │
     │ 27. .gitignore                                                           │
     │ 28. package.json (add exceljs)                                           │
     │                                                                          │
     │ ---                                                                      │
     │ Implementation Order                                                     │
     │                                                                          │
     │ 1. Schema + Migration: Prisma models, migrate                            │
     │ 2. Infrastructure: file-encryption.ts, vaccines.ts, install exceljs,     │
     │ .gitignore                                                               │
     │ 3. API Types: VaccineLogResponse, VaccineDocumentResponse,               │
     │ VaccineLogCreate                                                         │
     │ 4. API Routes: CRUD, upload, download, export                            │
     │ 5. Form Components: VaccineForm (tabs, record, history)                  │
     │ 6. Activity Tile: types, styles, utils, icon, tile group, settings       │
     │ 7. Timeline API: Add to timeline aggregation                             │
     │ 8. Timeline Display: types, utils, CSS, TimelineV2, FullLog              │
     │ 9. Log Entry Page: Wire up form                                          │
     │ 10. Localization: All translation keys, run check script                 │
     │                                                                          │
     │ ---                                                                      │
     │ Verification                                                             │
     │                                                                          │
     │ 1. Run npx prisma migrate dev — verify VaccineLog + VaccineDocument      │
     │ created                                                                  │
     │ 2. Test CRUD via /api/vaccine-log                                        │
     │ 3. Upload a file → verify encrypted in Files/, download → verify         │
     │ decrypted correctly                                                      │
     │ 4. Test Excel export with date range filter                              │
     │ 5. Verify vaccine tile appears in tile group with vaccine-128.png        │
     │ 6. Open form, test searchable vaccine list, file upload, history tab     │
     │ 7. Create vaccine logs, verify they appear in TimelineV2 with Syringe    │
     │ icon (white bg, red outline, red icon)                                   │
     │ 8. Toggle dark mode → verify transparent bg, red outline, red icon       │
     │ 9. Verify FullLog filtering and search works for vaccines                │
     │ 10. Run node scripts/check-missing-translations.js                       │
     │ 11. Run TypeScript check: npx tsc --noEmit                               │
     │                                                                          │
     │ ---                                                                      │
     │ Type Discrimination Note                                                 │
     │                                                                          │
     │ Use 'vaccineName' in activity as the unique discriminator for            │
     │ VaccineLog. This field doesn't exist on any other activity type. Place   │
     │ vaccine checks before milestone checks (which use 'title' in activity)   │
     │ since both are point-in-time activities with different shapes.    