import { apiFetch } from './httpClient';
import { env } from '../config/env';
import type { EntityB, EntityBConA } from '../types';

// MS-B · localhost:8082 · /api/b   →  { id, nombreB, entityAId }
// /api/b/con-a (OpenFeign → MS-A)  →  { id, nombreB, nombreA }
const base = env.msbBase;

export const msbApi = {
  listar: () => apiFetch<EntityB[]>(base),
  buscar: (id: number) => apiFetch<EntityB>(`${base}/${id}`),
  crear: (nombreB: string, entityAId: number | null = null) =>
    apiFetch<EntityB>(base, { method: 'POST', body: { nombreB, entityAId } }),
  actualizar: (id: number, nombreB: string, entityAId: number | null = null) =>
    apiFetch<EntityB>(`${base}/${id}`, { method: 'PUT', body: { nombreB, entityAId } }),
  eliminar: (id: number) => apiFetch(`${base}/${id}`, { method: 'DELETE' }),
  conA: () => apiFetch<EntityBConA[]>(`${base}/con-a`),
};
