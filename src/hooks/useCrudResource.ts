import { useCallback, useEffect, useState } from 'react';
import { errorText } from '../api/httpClient';
import type { CrudApi, LoadStatus } from '../types';

/**
 * Estado y operaciones CRUD para un recurso { id, <field> }.
 * `api` debe tener listar, crear, actualizar, eliminar y buscar; porIds es opcional.
 * Reutilizable por MS-A (nombreA) y MS-B (nombreB).
 */
export function useCrudResource<T extends { id: number }>(api: CrudApi<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<number[] | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setFilter(null);
    try {
      setItems(await api.listar());
      setStatus('ready');
    } catch (e) {
      setError(errorText(e));
      setStatus('error');
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (value: string, relId?: number | null) => {
    const created = await api.crear(value, relId);
    setItems((list) => [...list, created]);
    return created;
  };

  const update = async (id: number, value: string, relId?: number | null) => {
    const updated = await api.actualizar(id, value, relId);
    setItems((list) => list.map((it) => (it.id === id ? updated : it)));
    return updated;
  };

  const remove = async (id: number) => {
    await api.eliminar(id);
    setItems((list) => list.filter((it) => it.id !== id));
  };

  /** Busca por uno o varios IDs. Devuelve los IDs que no existen. */
  const search = async (ids: number[]): Promise<number[]> => {
    setStatus('loading');
    setError(null);
    try {
      let found: T[];
      if (api.porIds) {
        found = await api.porIds(ids);
      } else {
        const results = await Promise.allSettled(ids.map((id) => api.buscar(id)));
        found = results
          .filter((r): r is PromiseFulfilledResult<Awaited<T>> => r.status === 'fulfilled')
          .map((r) => r.value);
      }
      setItems(found);
      setFilter(ids);
      setStatus('ready');
      const foundIds = new Set(found.map((f) => f.id));
      return ids.filter((id) => !foundIds.has(id));
    } catch (e) {
      setError(errorText(e));
      setStatus('error');
      return [];
    }
  };

  return { items, status, error, filter, load, create, update, remove, search };
}
