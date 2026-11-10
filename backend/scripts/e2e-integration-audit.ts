import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:5000/api/v1';
const RFID_URL = 'http://localhost:8000';

interface AuditResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT TESTED';
  durationMs: number;
  details: string;
}

async function runE2EAudit() {
  const results: AuditResult[] = [];
  console.log('====================================================');
  console.log('🔍 SMARTLIB PHASE 3: END-TO-END SYSTEM INTEGRATION AUDIT');
  console.log('====================================================\n');

  // 1. Health Endpoints & Connectivity
  try {
    const t0 = performance.now();
    const res = await axios.get(`${BACKEND_URL}/health`);
    const duration = performance.now() - t0;
    results.push({
      step: '1.1 Backend Core Health (Express + Neon)',
      status: res.status === 200 && res.data.data.database === 'connected' ? 'PASS' : 'FAIL',
      durationMs: Math.round(duration),
      details: `HTTP ${res.status} - Database: ${res.data.data.database}, Environment: ${res.data.data.environment}`,
    });
  } catch (err: any) {
    results.push({
      step: '1.1 Backend Core Health (Express + Neon)',
      status: 'FAIL',
      durationMs: 0,
      details: err.message,
    });
  }

  try {
    const t0 = performance.now();
    const res = await axios.get(`${RFID_URL}/health`);
    const duration = performance.now() - t0;
    results.push({
      step: '1.2 RFID Middleware Health (FastAPI + SQLite)',
      status: res.status === 200 && res.data.status === 'healthy' ? 'PASS' : 'FAIL',
      durationMs: Math.round(duration),
      details: `HTTP ${res.status} - Status: ${res.data.status}, Service: ${res.data.service}`,
    });
  } catch (err: any) {
    results.push({
      step: '1.2 RFID Middleware Health (FastAPI + SQLite)',
      status: 'BLOCKED',
      durationMs: 0,
      details: `FastAPI service not responding on port 8000: ${err.message}`,
    });
  }

  // 2. Authentication & JWT Validation
  let adminToken = '';
  let librarianToken = '';

  try {
    const t0 = performance.now();
    const res = await axios.post(`${BACKEND_URL}/auth/login`, {
      email: 'admin@smartlib.ac.in',
      password: 'Admin@SmartLib2026!',
    });
    const duration = performance.now() - t0;
    adminToken = res.data.data.tokens.accessToken;
    results.push({
      step: '2.1 Admin Authentication (admin@smartlib.ac.in)',
      status: 'PASS',
      durationMs: Math.round(duration),
      details: `JWT generated for role: ${res.data.data.user.role}`,
    });
  } catch (err: any) {
    results.push({
      step: '2.1 Admin Authentication',
      status: 'FAIL',
      durationMs: 0,
      details: err.response?.data?.message || err.message,
    });
  }

  try {
    const t0 = performance.now();
    const res = await axios.post(`${BACKEND_URL}/auth/login`, {
      email: 'librarian@smartlib.ac.in',
      password: 'Lib@SmartLib2026!',
    });
    const duration = performance.now() - t0;
    librarianToken = res.data.data.tokens.accessToken;
    results.push({
      step: '2.2 Librarian Authentication (librarian@smartlib.ac.in)',
      status: 'PASS',
      durationMs: Math.round(duration),
      details: `JWT generated for role: ${res.data.data.user.role}`,
    });
  } catch (err: any) {
    results.push({
      step: '2.2 Librarian Authentication',
      status: 'FAIL',
      durationMs: 0,
      details: err.response?.data?.message || err.message,
    });
  }

  // 3. RBAC Enforcement Test
  if (librarianToken) {
    try {
      const t0 = performance.now();
      await axios.get(`${BACKEND_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${librarianToken}` },
      });
      results.push({
        step: '3.1 RBAC Enforcement (Librarian accessing Audit Logs)',
        status: 'FAIL',
        durationMs: 0,
        details: 'Security breach: Librarian was allowed to access admin-only audit logs!',
      });
    } catch (err: any) {
      const duration = performance.now();
      results.push({
        step: '3.1 RBAC Enforcement (Librarian accessing Audit Logs)',
        status: err.response?.status === 403 ? 'PASS' : 'FAIL',
        durationMs: Math.round(duration),
        details: `Correctly rejected with HTTP ${err.response?.status} (${err.response?.data?.message})`,
      });
    }
  }

  if (adminToken) {
    try {
      const t0 = performance.now();
      const res = await axios.get(`${BACKEND_URL}/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const duration = performance.now() - t0;
      results.push({
        step: '3.2 RBAC Authorization (Admin accessing Audit Logs)',
        status: res.status === 200 ? 'PASS' : 'FAIL',
        durationMs: Math.round(duration),
        details: `HTTP 200 - Retrieved ${res.data.data?.length || 0} audit log entries`,
      });
    } catch (err: any) {
      results.push({
        step: '3.2 RBAC Authorization (Admin accessing Audit Logs)',
        status: 'FAIL',
        durationMs: 0,
        details: err.response?.data?.message || err.message,
      });
    }
  }

  // 4. Catalog & Member Exploration
  try {
    const t0 = performance.now();
    const booksRes = await axios.get(`${BACKEND_URL}/books?page=1&limit=5`);
    const duration = performance.now() - t0;
    results.push({
      step: '4.1 Catalog Query & Pagination',
      status: booksRes.status === 200 && booksRes.data.data.length > 0 ? 'PASS' : 'FAIL',
      durationMs: Math.round(duration),
      details: `Retrieved ${booksRes.data.data.length} books (Total in DB: ${booksRes.data.pagination.total})`,
    });
  } catch (err: any) {
    results.push({
      step: '4.1 Catalog Query & Pagination',
      status: 'FAIL',
      durationMs: 0,
      details: err.message,
    });
  }

  try {
    const t0 = performance.now();
    const memRes = await axios.get(`${BACKEND_URL}/members?page=1&limit=5`);
    const duration = performance.now() - t0;
    results.push({
      step: '4.2 Member Roster Query',
      status: memRes.status === 200 && memRes.data.data.length > 0 ? 'PASS' : 'FAIL',
      durationMs: Math.round(duration),
      details: `Retrieved ${memRes.data.data.length} members (Total in DB: ${memRes.data.pagination.total})`,
    });
  } catch (err: any) {
    results.push({
      step: '4.2 Member Roster Query',
      status: 'FAIL',
      durationMs: 0,
      details: err.message,
    });
  }

  // 5. Circulation Domain Business Rules
  let circulatingCopyId = '';
  let referenceCopyId = '';
  let testMemberId = '';

  try {
    const circCopy = await prisma.bookItem.findUnique({
      where: { accessionNumber: 'ACC-2026-00001' },
    });
    circulatingCopyId = circCopy?.id || '';

    const refCopy = await prisma.bookItem.findUnique({
      where: { accessionNumber: 'ACC-2026-00002' },
    });
    referenceCopyId = refCopy?.id || '';

    const member = await prisma.member.findUnique({
      where: { cardNumber: 'STD-2026-1001' },
    });
    testMemberId = member?.id || '';
  } catch (err: any) {
    console.error('Failed to query seed IDs:', err.message);
  }

  // 5.1 Test Reference Copy Restriction (AC04)
  if (referenceCopyId && testMemberId && librarianToken) {
    try {
      const t0 = performance.now();
      await axios.post(
        `${BACKEND_URL}/circulation/issue`,
        { memberId: testMemberId, bookItemId: referenceCopyId },
        { headers: { Authorization: `Bearer ${librarianToken}` } }
      );
      results.push({
        step: '5.1 Reference-Only Restriction Enforcement (AC04)',
        status: 'FAIL',
        durationMs: 0,
        details: 'Security violation: Reference material was issued!',
      });
    } catch (err: any) {
      const duration = performance.now();
      results.push({
        step: '5.1 Reference-Only Restriction Enforcement (AC04)',
        status: err.response?.status === 400 ? 'PASS' : 'FAIL',
        durationMs: Math.round(duration),
        details: `Rejected with HTTP ${err.response?.status} (${err.response?.data?.message})`,
      });
    }
  }

  // 5.2 Test Normal Issue (AC03)
  if (circulatingCopyId && testMemberId && librarianToken) {
    try {
      // Clean up previous test loans if any
      await prisma.circulation.deleteMany({ where: { bookItemId: circulatingCopyId } });
      await prisma.bookItem.update({ where: { id: circulatingCopyId }, data: { status: 'AVAILABLE' } });

      const t0 = performance.now();
      const issueRes = await axios.post(
        `${BACKEND_URL}/circulation/issue`,
        { memberId: testMemberId, bookItemId: circulatingCopyId },
        { headers: { Authorization: `Bearer ${librarianToken}` } }
      );
      const duration = performance.now() - t0;

      // Verify item status became ISSUED and EAS was disarmed
      const updatedCopy = await prisma.bookItem.findUnique({
        where: { id: circulatingCopyId },
        include: { rfidTag: true },
      });

      results.push({
        step: '5.2 Circulating Copy Checkout & EAS Disarm (AC03)',
        status: issueRes.status === 201 && updatedCopy?.status === 'ISSUED' && !updatedCopy.rfidTag?.easArmed ? 'PASS' : 'FAIL',
        durationMs: Math.round(duration),
        details: `HTTP ${issueRes.status} - Copy Status: ${updatedCopy?.status}, EAS Armed: ${updatedCopy?.rfidTag?.easArmed}`,
      });
    } catch (err: any) {
      results.push({
        step: '5.2 Circulating Copy Checkout & EAS Disarm (AC03)',
        status: 'FAIL',
        durationMs: 0,
        details: err.response?.data?.message || err.message,
      });
    }
  }

  console.log('\n--- AUDIT RESULTS TABLE ---');
  console.table(results);

  await prisma.$disconnect();
}

runE2EAudit();

