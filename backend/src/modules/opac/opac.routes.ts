import { Router, Request, Response, NextFunction } from 'express';
import { opacService } from './opac.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

// ------------------------------------------------------------------------------
// 3.1 & 3.2 Public OPAC Search & Book Detail (Accessible without login)
// ------------------------------------------------------------------------------

// GET /api/v1/opac/search
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await opacService.searchPublicCatalog({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      title: typeof req.query.title === 'string' ? req.query.title : undefined,
      author: typeof req.query.author === 'string' ? req.query.author : undefined,
      isbn: typeof req.query.isbn === 'string' ? req.query.isbn : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      publisher: typeof req.query.publisher === 'string' ? req.query.publisher : undefined,
      accessionNumber:
        typeof req.query.accessionNumber === 'string' ? req.query.accessionNumber : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      availability:
        req.query.availability === 'AVAILABLE_ONLY' ? 'AVAILABLE_ONLY' : 'ALL',
      sort:
        typeof req.query.sort === 'string'
          ? (req.query.sort as 'RELEVANCE' | 'TITLE_ASC' | 'YEAR_DESC' | 'RECENT')
          : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    sendSuccess(res, result.items, 'Public OPAC search results retrieved', 200, result.pagination);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/opac/books/:id
router.get('/books/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await opacService.getPublicBookDetail(req.params.id as string);
    sendSuccess(res, detail, 'Public OPAC book detail retrieved', 200);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 3.3 Provider-Neutral Net Cataloguing (Admin / Librarian)
// ------------------------------------------------------------------------------

// GET /api/v1/opac/net-cataloguing/lookup?isbn=...
router.get(
  '/net-cataloguing/lookup',
  authenticate,
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isbn = typeof req.query.isbn === 'string' ? req.query.isbn : '';
      const result = await opacService.previewNetCatalogMetadata(isbn);
      sendSuccess(res, result, 'Net cataloguing metadata preview retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/opac/net-cataloguing/import
router.post(
  '/net-cataloguing/import',
  authenticate,
  requireRole(['ADMIN', 'LIBRARIAN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await opacService.importNetCatalogMetadata(req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
      });
      sendSuccess(res, result, 'Net cataloguing bibliographic metadata imported', 201);
    } catch (err) {
      next(err);
    }
  }
);

// ------------------------------------------------------------------------------
// 3.4 Virtual Bookshelf — Personal Reading List (Authenticated & User-Isolated)
// ------------------------------------------------------------------------------

// GET /api/v1/opac/bookshelf/personal
router.get(
  '/bookshelf/personal',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId =
        typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const shelf = await opacService.getPersonalBookshelf(req.user!.userId, targetUserId);
      sendSuccess(res, shelf, 'Personal virtual bookshelf retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/opac/bookshelf/personal
router.post(
  '/bookshelf/personal',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shelf = await opacService.addToPersonalBookshelf(req.user!.userId, req.body);
      sendSuccess(res, shelf, 'Book added to personal virtual bookshelf', 201);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/opac/bookshelf/personal/:bookId
router.delete(
  '/bookshelf/personal/:bookId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shelf = await opacService.removeFromPersonalBookshelf(
        req.user!.userId,
        req.params.bookId as string
      );
      sendSuccess(res, shelf, 'Book removed from personal virtual bookshelf', 200);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

