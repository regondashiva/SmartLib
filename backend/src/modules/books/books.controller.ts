import { Request, Response, NextFunction } from 'express';
import { booksService } from './books.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { GetBooksQuery } from './books.schema.js';

export class BooksController {
  async getBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetBooksQuery;
      const result = await booksService.getBooks(query);
      sendSuccess(res, result.items, 'Books catalog retrieved', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getBookById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const book = await booksService.getBookById(id);
      sendSuccess(res, book, 'Book record retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async createBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email }
        : undefined;
      const result = await booksService.createBook(req.body, actor);
      sendSuccess(res, result, 'Book and physical copies created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params['id'] as string;
      const actor = req.user
        ? { userId: req.user.userId, email: req.user.email }
        : undefined;
      const result = await booksService.updateBook(id, req.body, actor);
      sendSuccess(res, result, 'Book record updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await booksService.getCategories();
      sendSuccess(res, categories, 'Categories retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getPublishers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publishers = await booksService.getPublishers();
      sendSuccess(res, publishers, 'Publishers retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async getAuthors(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authors = await booksService.getAuthors();
      sendSuccess(res, authors, 'Authors retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const booksController = new BooksController();
