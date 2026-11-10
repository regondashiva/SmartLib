// ─── Authentication ───────────────────────────────────────────────────────────
export type UserRole = "ADMIN" | "LIBRARIAN" | "STAFF" | "VIEWER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
  message?: string;
}

// ─── Books ───────────────────────────────────────────────────────────────────
export type ItemStatus =
  | "AVAILABLE"
  | "ISSUED"
  | "RESERVED"
  | "LOST"
  | "DAMAGED"
  | "IN_TRANSIT"
  | "REFERENCE_ONLY"
  | "BINDING";

export type ItemCondition = "NEW" | "GOOD" | "FAIR" | "WORN" | "DAMAGED";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  edition?: string;
  language: string;
  pages?: number;
  description?: string;
  coverImageUrl?: string;
  category?: { id: string; name: string };
  categoryId?: string;
  tags?: string[];
  copies?: BookCopy[];
  totalCopies?: number;
  availableCopies?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookCopy {
  id: string;
  bookId: string;
  accessionNumber: string;
  barcode?: string;
  status: ItemStatus;
  condition: ItemCondition;
  shelfLocation?: string;
  isReferenceOnly?: boolean;
  price?: number;
  location?: string;
  rfidTag?: RFIDTag;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookPayload {
  title: string;
  subtitle?: string;
  isbn13?: string;
  isbn10?: string;
  edition?: string;
  publisherName?: string;
  publisherId?: string;
  publicationYear?: number;
  categoryName?: string;
  categoryId?: string;
  classification?: string;
  callNumber?: string;
  description?: string;
  language?: string;
  pageCount?: number;
  authors: string[];
  copiesCount?: number;
  shelfLocation?: string;
  isReferenceOnly?: boolean;
  condition?: ItemCondition;
  price?: number;
  copies?: Array<{
    accessionNumber?: string;
    barcode?: string;
    shelfLocation?: string;
    condition?: ItemCondition;
    status?: ItemStatus;
    isReferenceOnly?: boolean;
    price?: number;
  }>;
}

// ─── Members ─────────────────────────────────────────────────────────────────
export type MemberType = "STUDENT" | "FACULTY" | "RESEARCH_SCHOLAR" | "STAFF" | "GUEST";
export type MemberStatus = "ACTIVE" | "BLOCKED" | "EXPIRED" | "SUSPENDED";

export interface Member {
  id: string;
  membershipNumber: string;
  name: string;
  email?: string;
  phone?: string;
  memberType: MemberType;
  status: MemberStatus;
  department?: string;
  rfidCardUid?: string;
  borrowingLimit: number;
  currentLoans?: number;
  pendingFines?: number;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Circulation ──────────────────────────────────────────────────────────────
export type LoanStatus = "ACTIVE" | "RETURNED" | "OVERDUE" | "LOST_CLAIMED";
export type LoanRenewalStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "MAX_RENEWED";
export type FineStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "WAIVED";
export type FineReason = "OVERDUE" | "DAMAGED_BOOK" | "LOST_BOOK" | "PROCESSING_FEE";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "ONLINE";

/** Matches the backend getCirculations / getCirculationById formatted response */
export interface CirculationItem {
  id: string;
  status: LoanStatus;
  issuedDate: string;
  dueDate: string;
  returnedDate?: string | null;
  renewalCount: number;
  notes?: string | null;
  member: {
    id: string;
    name: string;
    cardNumber: string;
    email: string;
    memberType?: string;
    fineBalance?: number;
  };
  item: {
    id: string;
    accessionNumber: string;
    title: string;
    isbn13?: string | null;
    callNumber?: string | null;
    shelfLocation?: string | null;
    rfidTag?: { epc: string; easArmed: boolean } | null;
  };
  issuedBy: string;
  fines?: Fine[];
}

/** Legacy alias kept for compatibility */
export type Loan = CirculationItem;

export interface Fine {
  id: string;
  circulationId?: string;
  memberId?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: FineStatus;
  reason: FineReason;
  receiptNumber?: string | null;
  createdAt?: string;
  member?: { id: string; name: string; cardNumber: string };
  circulation?: {
    id: string;
    issuedDate: string;
    dueDate: string;
    returnedDate?: string | null;
    bookTitle: string;
    accessionNumber: string;
  } | null;
}

export interface IssueRequest {
  memberId: string;
  bookItemId: string;
  dueDays?: number;
}

export interface ReturnRequest {
  circulationId?: string;
  bookItemId?: string;
  accessionNumber?: string;
  notes?: string;
}

export interface RenewRequest {
  circulationId?: string;
  bookItemId?: string;
  accessionNumber?: string;
}

export interface PayFineRequest {
  fineId: string;
  amount: number;
  paymentMethod?: PaymentMethod;
}

export interface WaiveFineRequest {
  fineId: string;
  reason: string;
}

// ─── RFID ─────────────────────────────────────────────────────────────────────
export type RFIDTagType = "ISO_15693" | "ISO_18000_6C" | "NTAG213" | "NTAG215" | "EM4100";
export type RFIDTagStatus = "ACTIVE" | "INACTIVE" | "DAMAGED" | "LOST";

export interface RFIDTag {
  id: string;
  epc: string;
  tagType: RFIDTagType;
  status: RFIDTagStatus;
  bookCopyId?: string;
  lastSeenAt?: string;
  createdAt: string;
}

export interface RFIDDevice {
  id: string;
  name: string;
  type: "staff_station" | "handheld" | "security_gate";
  status: "online" | "offline" | "error";
  lastSeen?: string;
  location?: string;
}

export interface RFIDEvent {
  id: string;
  eventId: string;
  epc: string;
  deviceId: string;
  deviceType: string;
  accessionNumber?: string;
  eventType: string;
  timestamp: string;
  processingStatus: string;
  metadata?: Record<string, unknown>;
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: { name: string; email: string };
}

// ─── API Pagination ───────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: PaginationMeta;
  meta?: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
  pagination?: PaginationMeta;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export interface HealthStatus {
  success?: boolean;
  message?: string;
  data?: {
    status?: string;
    api?: string;
    service?: string;
    version?: string;
    database?: {
      provider?: string;
      status?: "CONNECTED" | "DISCONNECTED" | string;
      latencyMs?: number;
      error?: string;
    };
    uptimeSeconds?: number;
    mockRfidMode?: boolean;
  };
  status?: string;
  timestamp?: string;
  services?: Record<string, string>;
}

export interface RfidHealthResponse {
  status: string; // "HEALTHY"
  service: string; // "smartlib-rfid-middleware"
  version: string;
  mock_hardware: boolean;
  backend_connected: boolean;
  backend_url: string;
  buffer_path: string;
  pending_events: number;
  devices_online: number;
  uptime_seconds: number;
  timestamp: string;
  [key: string]: unknown;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardSummary {
  kpi: {
    totalBooks: number;
    totalCopies: number;
    activeMembers: number;
    activeLoans: number;
    rfidTagged: number;
    overdueLoans: number;
    pendingFines: number;
    rfidDevices: number;
    gateClearances: number;
  };
  weeklyCirculation: Array<{ day: string; issues: number; returns: number }>;
  categoryData: Array<{ name: string; value: number; color: string }>;
  recentLoans: Array<{
    id: string;
    status: LoanStatus;
    issuedDate: string;
    dueDate: string;
    returnedDate?: string | null;
    member: { id: string; name: string; cardNumber: string };
    item?: { id: string; accessionNumber: string; title: string };
    bookCopy?: { accessionNumber: string; book: { title: string } };
  }>;
  timestamp: string;
}

// ─── RFID Middleware ──────────────────────────────────────────────────────────
export interface RFIDDeviceStatus {
  device_id: string;
  device_type: string;
  status: string;
  last_scan?: string;
  scan_count: number;
  location?: string;
}

export interface StaffStationScanRequest {
  device_id: string;
  epc_codes: string[];
}

export interface HandheldScanRequest {
  device_id: string;
  shelf_location: string;
  epc_codes: string[];
}

export interface SecurityGateEventRequest {
  device_id: string;
  epc_codes: string[];
  direction?: "in" | "out";
}

// ─── Data Migration ───────────────────────────────────────────────────────────
export type MigrationBatchStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "DRY_RUN_COMPLETED"
  | "COMMITTED"
  | "ROLLED_BACK"
  | "FAILED";

export type StagingRecordStatus = "PENDING" | "VALID" | "INVALID" | "COMMITTED";

export interface DryRunSummary {
  simulatedAt: string;
  sourceRecordCount: number;
  validRecordCount: number;
  invalidRecordCount: number;
  estimatedNewBooks: number;
  estimatedNewCopies: number;
  estimatedPublishers: number;
  estimatedCategories: number;
  estimatedAuthors: number;
  reconciliation: {
    sourceTotal: number;
    readyToCommit: number;
    rejected: number;
    successRatePercentage: number;
  };
  canCommit: boolean;
}

export interface MigrationBatch {
  id: string;
  batchName: string;
  sourceFileName: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  migratedRecords: number;
  status: MigrationBatchStatus;
  executedByUserId: string;
  executedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  dryRunSummary?: DryRunSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface StagingPreviewRecord {
  id: string;
  rowNumber: number;
  status: StagingRecordStatus;
  normalized?: {
    title: string;
    isbn13?: string | null;
    authors?: string[];
    publisher?: string | null;
    category?: string | null;
    shelfLocation?: string;
    copiesCount?: number;
    [key: string]: unknown;
  } | null;
  errors?: string[] | null;
  raw: Record<string, unknown>;
}

export interface MigrationPreviewResponse {
  batch: MigrationBatch;
  summary: {
    totalRecords: number;
    validCount: number;
    errorCount: number;
    sampleReturned: number;
  };
  records: StagingPreviewRecord[];
}

export interface MigrationUploadResponse {
  batch: MigrationBatch;
  headers: string[];
  mapping: Record<string, string | null>;
  totalStaged: number;
  sample: Array<Record<string, unknown>>;
}

// ─── Reports & Analytics (Phase 4D) ───────────────────────────────────────────
export type ReportCategoryKey =
  | "DASHBOARD"
  | "CIRCULATION"
  | "OVERDUE"
  | "INVENTORY"
  | "MEMBERS"
  | "FINES"
  | "RFID"
  | "SECURITY_GATES"
  | "OPERATORS"
  | "MIGRATIONS";

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  academicYear?: string;
  department?: string;
  memberCategory?: string;
  bookCategory?: string;
  rfidDevice?: string;
  gateId?: string;
  operator?: string;
  transactionStatus?: string;
  page?: number;
  limit?: number;
}

// ─── System Settings & Institutional Policy Configuration (Phase 4E) ──────────
export interface SystemSettingsPayload {
  circulation: {
    studentLoanDurationDays: number;
    staffLoanDurationDays: number;
    facultyLoanDurationDays: number;
    maxRenewals: number;
    renewalExtensionDays: number;
    facultyRenewalExtensionDays: number;
    maxActiveLoansStudent: number;
    maxActiveLoansStaff: number;
    maxActiveLoansFaculty: number;
    maxActiveLoansResearchScholar: number;
    maxActiveLoansGuest: number;
    finePerOverdueDay: number;
    fineThresholdForBorrowingRestriction: number;
    enforceReferenceOnlyRestriction: boolean;
  };
  rfid: {
    mockMode: boolean;
    eventRetryAttempts: number;
    eventRetryBackoffMs: number;
    duplicateEventWindowSeconds: number;
    deviceHealthCheckIntervalSeconds: number;
    offlineBufferEnabled: boolean;
    offlineBufferMaxRecords: number;
  };
  securityGates: {
    gateEventLoggingEnabled: boolean;
    alertThresholdPerHour: number;
    easBehavior: "STRICT_ALARM" | "SILENT_LOG" | "DISABLED";
    securityEventRetentionDays: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    dueDateReminderEnabled: boolean;
    dueDateReminderDaysBefore: number;
    overdueAlertEnabled: boolean;
    securityGateAlertEnabled: boolean;
  };
  institutional: {
    institutionName: string;
    libraryName: string;
    academicYear: string;
    timeZone: string;
    currency: string;
    contactEmail: string;
    contactPhone: string;
  };
  items?: Array<{
    key: string;
    fieldPath: string;
    category: string;
    dataType: string;
    value: string | number | boolean;
    defaultValue: string | number | boolean;
    description: string;
    isSensitive: boolean;
    updatedAt: string | null;
    updatedBy: string | null;
  }>;
  lastUpdatedAt?: string;
}

export interface SettingsHistoryItem {
  id: string;
  timestamp: string;
  administrator: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  reason: string;
  changedFields: string[];
  changes: Array<{
    key: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
  ipAddress: string;
}




