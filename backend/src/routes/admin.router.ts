import { Router } from 'express';
import { getAdminOverview, getAdminProject, getAdminUser, listAdminJobs, listAdminProjects, listAdminUsers } from '../controllers/admin.controller';
import { adminIdParamsSchema, adminListQuerySchema } from '../domain/schemas';
import { validate } from '../lib/validation';
import { requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);
router.get('/overview', getAdminOverview);
router.get('/users', validate({ query: adminListQuerySchema }), listAdminUsers);
router.get('/users/:id', validate({ params: adminIdParamsSchema }), getAdminUser);
router.get('/projects', validate({ query: adminListQuerySchema }), listAdminProjects);
router.get('/projects/:id', validate({ params: adminIdParamsSchema }), getAdminProject);
router.get('/jobs', validate({ query: adminListQuerySchema }), listAdminJobs);
export default router;
