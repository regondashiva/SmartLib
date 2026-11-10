import { Router } from 'express';
import { booksController } from './books.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  getBooksQuerySchema,
  bookIdParamSchema,
  createBookSchema,
  updateBookSchema,
} from './books.schema.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// GET /api/v1/books/meta/categories
router.get('/meta/categories', (req, res, next) =>
  booksController.getCategories(req, res, next)
);

// GET /api/v1/books/meta/publishers
router.get('/meta/publishers', (req, res, next) =>
  booksController.getPublishers(req, res, next)
);

// GET /api/v1/books/meta/authors
router.get('/meta/authors', (req, res, next) =>
  booksController.getAuthors(req, res, next)
);

// GET /api/v1/books
router.get(
  '/',
  validateRequest({ query: getBooksQuerySchema }),
  (req, res, next) => booksController.getBooks(req, res, next)
);

// POST /api/v1/books (Admin or Librarian)
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ body: createBookSchema }),
  (req, res, next) => booksController.createBook(req, res, next)
);

// GET /api/v1/books/:id
router.get(
  '/:id',
  validateRequest({ params: bookIdParamSchema }),
  (req, res, next) => booksController.getBookById(req, res, next)
);

// PUT /api/v1/books/:id (Admin or Librarian)
router.put(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'LIBRARIAN']),
  validateRequest({ params: bookIdParamSchema, body: updateBookSchema }),
  (req, res, next) => booksController.updateBook(req, res, next)
);

export default router;
