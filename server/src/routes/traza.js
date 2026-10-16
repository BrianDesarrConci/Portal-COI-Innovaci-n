import { Router } from 'express';

// TODO: TRAZA (solicitudes, bitácora y avance de estados). Se completa en el módulo TRAZA.
const router = Router();
router.get('/', (_req, res) => res.json([]));
export default router;
