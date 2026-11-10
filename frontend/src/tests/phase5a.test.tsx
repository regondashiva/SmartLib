import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublicOpacPage from '../pages/opac/PublicOpac';
import LabelsManagementPage from '../pages/labels/LabelsManagement';
import AcquisitionsAndSerialsPage from '../pages/acquisitions/Acquisitions';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import { AppSidebar } from '../components/layout/AppSidebar';
import { api as apiClient } from '@/lib/api';

(window as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    user: { id: 'u1', name: 'Chief Librarian', email: 'librarian@smartlib.ac.in', role: 'ADMIN' },
    hasRole: () => true,
  }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiGet: vi.fn().mockResolvedValue({
    success: true,
    data: {
      kpi: {
        totalBooks: 23,
        activeMembers: 5,
        activeLoans: 2,
        rfidTagged: 12,
        overdueLoans: 0,
        pendingFines: 0,
        rfidDevices: 4,
        gateClearances: 0,
      },
      weeklyCirculation: [{ day: 'Mon', issues: 4, returns: 3 }],
      categoryData: [{ name: 'Computer Science', value: 12, color: '#2563EB' }],
      recentLoans: [],
    },
  }),
  checkBackendHealth: vi.fn().mockResolvedValue({
    success: true,
    data: { api: 'ONLINE', status: 'HEALTHY', database: { status: 'CONNECTED' } },
  }),
  checkRfidHealth: vi.fn().mockResolvedValue({
    status: 'HEALTHY',
    service: 'smartlib-rfid-middleware',
    devices_online: 4,
  }),
}));

describe('Phase 5A — Frontend OPAC, Labels, Acquisitions & Serials Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders Public OPAC discovery portal without requiring staff login', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'book-opac-1',
            title: 'Effective Java (3rd Edition)',
            isbn13: '9780134685991',
            callNumber: '005.133 BLO',
            language: 'English',
            category: 'Computer Science',
            subject: 'Computer Science',
            publisher: 'Addison-Wesley',
            publicationYear: 2018,
            authors: ['Joshua Bloch'],
            availabilityStatus: 'AVAILABLE',
            copiesSummary: {
              totalCopies: 3,
              availableForLoan: 2,
              referenceOnlyCopies: 1,
              shelfLocations: ['STACK-CS-01'],
            },
            relevanceScore: 95,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <PublicOpacPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/SmartLib Institutional Discovery Portal/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/Effective Java/i)).toBeTruthy();
      expect(screen.getByText(/2 Available/i)).toBeTruthy();
    });
  });

  it('2. Renders Barcode & Spine-Label Studio with Code-128B SVG preview', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        data: {
          totalLabels: 1,
          labels: [
            {
              bookItemId: 'item-1',
              accessionNumber: 'ACC-2026-00001',
              barcode: 'BC-ACC-2026-00001',
              title: 'Clean Architecture',
              author: 'Robert C. Martin',
              callNumber: '005.1 MAR',
              shelfLocation: 'STACK-A1',
              spineLines: ['005.1', 'ROB', '2026', 'ACC-2026-00001'],
              barcodeSvg: '<svg><text>BC-ACC-2026-00001</text></svg>',
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter>
        <LabelsManagementPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Physical Copy Barcode & Spine-Label Generator/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/Clean Architecture/i)).toBeTruthy();
      expect(screen.getByText(/BC-ACC-2026-00001/i)).toBeTruthy();
    });
  });

  it('3. Renders Acquisitions & Serials Management Console', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'po-1',
              orderNumber: 'PO-2026-100101',
              supplierName: 'Oxford Academic Distributors',
              status: 'ORDERED',
              totalOrderedQuantity: 5,
              totalReceivedQuantity: 2,
              totalPendingQuantity: 3,
              totalAmount: 4250,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'ser-1',
              issn: '0018-9162',
              title: 'IEEE Computer Magazine',
              publisher: 'IEEE',
              frequency: 'MONTHLY',
              subscriptionStatus: 'ACTIVE',
              subscriptionEndDate: '2026-12-31',
            },
          ],
        },
      });

    render(
      <MemoryRouter>
        <AcquisitionsAndSerialsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Acquisition & Serials Management Console/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/PO-2026-100101/i)).toBeTruthy();
      expect(screen.getByText(/Oxford Academic Distributors/i)).toBeTruthy();
    });
  });

  it('4. Renders redesigned split-screen LoginPage with branding, feature cards, Welcome Back card, and Browse Public OPAC link', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/The Future of/i)).toBeTruthy();
    expect(screen.getByText(/Starts Here\./i)).toBeTruthy();
    expect(screen.getByText(/Welcome Back!/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Username or Email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Password/i)).toBeTruthy();
    expect(screen.getByText(/Remember me/i)).toBeTruthy();
    expect(screen.getByText(/Forgot Password\?/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeTruthy();
    expect(screen.getByText(/Browse Public OPAC/i)).toBeTruthy();
  });

  it('5. Renders redesigned Enterprise Sidebar navigation groups and Dashboard welcome banner, KPIs, charts, and Quick Actions', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppSidebar />
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Sidebar groups & links
    expect(screen.getByText('LIBRARY OPERATIONS')).toBeTruthy();
    expect(screen.getByText('RFID & INVENTORY')).toBeTruthy();
    expect(screen.getByText('Acquisition Management')).toBeTruthy();
    expect(screen.getByText('Serials Management')).toBeTruthy();
    expect(screen.getByText('Barcode & Spine Labels')).toBeTruthy();
    expect(screen.getByText('System Health')).toBeTruthy();

    // Dashboard Welcome Banner & Quick Actions
    expect(screen.getByText(/Welcome Back, Chief Librarian!/i)).toBeTruthy();
    expect(screen.getByText('Weekly Circulation')).toBeTruthy();
    expect(screen.getByText('RFID Event Activity')).toBeTruthy();
    expect(screen.getByText('By Category')).toBeTruthy();
    expect(screen.getByText('Quick Actions')).toBeTruthy();
    expect(screen.getByText('Issue Book')).toBeTruthy();
    expect(screen.getByText('Return Book')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Total Books')).toBeTruthy();
      expect(screen.getByText('Gate Clearances')).toBeTruthy();
    });
  });
});

