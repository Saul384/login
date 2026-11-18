import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Icon from '../Icon';
import { useCrudResource } from '../../hooks/useCrudResource';
import { errorText } from '../../api/httpClient';
import type { CrudApi, RelationConfig, RelationOption } from '../../types';

import '../../styles/crud.css';

const MAX_LEN = 120;

/** Registro { id, <field> } de MS-A (nombreA) o MS-B (nombreB). */
type Row<F extends string> = { id: number } & Record<F, string>;

interface Toast {
  kind: 'ok' | 'error';
  text: string;
  key: number;
}

function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Escribe un nombre.';
  if (v.length > MAX_LEN) return `Máximo ${MAX_LEN} caracteres.`;
  return null;
}

type ParsedIds = { ids: number[]; error: null } | { ids: null; error: string };

function parseIds(text: string): ParsedIds {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return { ids: null, error: 'Escribe al menos un ID.' };
  const ids = parts.map(Number);
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    return { ids: null, error: 'Usa números enteros separados por comas. Ej. 1, 3' };
  }
  return { ids: [...new Set(ids)], error: null };
}

interface CrudScreenProps<F extends string> {
  api: CrudApi<Row<F>>;
  /** nombreA | nombreB */
  field: F;
  /** prefijo para los ids de HTML */
  prefix: string;
  title: string;
  /** nombre del servicio para los mensajes */
  serviceName: string;
  placeholder: string;
  /** Relación opcional con otro recurso (p. ej. B → Entidad A): agrega columna y selector. */
  relation?: RelationConfig;
}

/** "" en el <select> = sin relación. */
const toRelId = (value: string): number | null => (value === '' ? null : Number(value));

/** Pantalla CRUD genérica para un recurso { id, <field> } (MS-A, MS-B). */
export default function CrudScreen<F extends string>({ api, field, prefix, title, serviceName, placeholder, relation }: CrudScreenProps<F>) {
  const crud = useCrudResource(api);
  const { items, status, error, filter } = crud;

  // ---------- Relación (opcional) ----------
  const [relOptions, setRelOptions] = useState<RelationOption[]>([]);
  const [relError, setRelError] = useState<string | null>(null);
  const [newRel, setNewRel] = useState('');
  const [editRel, setEditRel] = useState('');

  const loadRelOptions = async () => {
    if (!relation) return;
    setRelError(null);
    try {
      setRelOptions(await relation.load());
    } catch (ex) {
      setRelOptions([]);
      setRelError(`No se pudo cargar ${relation.label}: ${errorText(ex)}`);
    }
  };

  useEffect(() => {
    loadRelOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relation]);

  const relIdOf = (item: Row<F>): number | null => {
    if (!relation) return null;
    const v = (item as Record<string, unknown>)[relation.field];
    return typeof v === 'number' ? v : null;
  };

  const relText = (relId: number | null) => {
    if (relId === null) return null;
    const opt = relOptions.find((o) => o.id === relId);
    return opt ? opt.label : `#${relId}`;
  };

  const relSelect = (id: string, value: string, onChange: (v: string) => void, ariaLabel?: string) => (
    <select
      id={id}
      className="input crud__select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <option value="">Sin {relation?.label}</option>
      {relOptions.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );

  const createRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [idQuery, setIdQuery] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<number[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (kind: Toast['kind'], text: string) => setToast({ kind, text, key: Date.now() });

  // ---------- Crear ----------
  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateName(newName);
    setCreateError(err);
    if (err) {
      createRef.current?.focus();
      return;
    }
    setCreating(true);
    try {
      const created = await crud.create(newName.trim(), relation ? toRelId(newRel) : undefined);
      setNewName('');
      setNewRel('');
      notify('ok', `Registro #${created.id} agregado.`);
    } catch (ex) {
      notify('error', errorText(ex));
    } finally {
      setCreating(false);
    }
  };

  // ---------- Buscar por ID(s) ----------
  const onSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseIds(idQuery);
    setIdError(parsed.error);
    if (parsed.error !== null) return;
    cancelRowActions();
    setMissingIds(await crud.search(parsed.ids));
  };

  const clearFilter = () => {
    setIdQuery('');
    setMissingIds([]);
    crud.load();
    loadRelOptions();
  };

  // ---------- Editar ----------
  const startEdit = (item: Row<F>) => {
    setConfirmId(null);
    setEditingId(item.id);
    setEditValue(item[field] ?? '');
    const relId = relIdOf(item);
    setEditRel(relId === null ? '' : String(relId));
    setEditError(null);
  };

  const cancelRowActions = () => {
    setEditingId(null);
    setConfirmId(null);
    setEditError(null);
  };

  const saveEdit = async (id: number) => {
    const err = validateName(editValue);
    setEditError(err);
    if (err) return;
    setBusyId(id);
    try {
      await crud.update(id, editValue.trim(), relation ? toRelId(editRel) : undefined);
      setEditingId(null);
      notify('ok', `Registro #${id} guardado.`);
    } catch (ex) {
      notify('error', errorText(ex));
    } finally {
      setBusyId(null);
    }
  };

  // ---------- Eliminar ----------
  const confirmDelete = async (id: number) => {
    setBusyId(id);
    try {
      await crud.remove(id);
      setConfirmId(null);
      notify('ok', `Registro #${id} eliminado.`);
    } catch (ex) {
      notify('error', errorText(ex));
    } finally {
      setBusyId(null);
    }
  };

  const rowKeys = (id: number) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Escape') cancelRowActions();
    if (e.key === 'Enter' && editingId === id) {
      e.preventDefault();
      saveEdit(id);
    }
  };

  return (
    <section className="crud" aria-labelledby={`${prefix}-title`}>
      <header className="crud__head">
        <div className="crud__heading">
          <div className="crud__title">
            <h1 id={`${prefix}-title`}>{title}</h1>
            {status === 'ready' && (
              <span className="crud__count">
                {items.length} {items.length === 1 ? 'registro' : 'registros'}
              </span>
            )}
          </div>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter} disabled={status === 'loading'}>
          <Icon name="refresh" size={16} />
          Recargar
        </button>
      </header>

      <div className="crud__panel">
        <div className="crud__toolbar">
          <form className="crud__form" onSubmit={onCreate} noValidate>
            <label htmlFor={`${prefix}-new`}>Nuevo registro</label>
            <div className={relation ? 'crud__row crud__row--wrap' : 'crud__row'}>
              <input
                id={`${prefix}-new`}
                ref={createRef}
                className="input"
                placeholder={placeholder}
                value={newName}
                maxLength={MAX_LEN + 1}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                aria-invalid={!!createError}
                aria-describedby={createError ? `${prefix}-new-error` : undefined}
                autoComplete="off"
              />
              {relation && relSelect(`${prefix}-new-rel`, newRel, setNewRel, relation.label)}
              <button type="submit" className="btn btn--primary btn--sm" disabled={creating}>
                {creating ? <span className="spinner" aria-hidden="true" /> : <Icon name="plus" size={16} />}
                Agregar
              </button>
            </div>
            {createError && <span id={`${prefix}-new-error`} className="field-error">{createError}</span>}
            {relError && <span className="field-error">{relError}</span>}
          </form>

          <form className="crud__form" onSubmit={onSearch} noValidate role="search">
            <label htmlFor={`${prefix}-ids`}>Buscar por ID</label>
            <div className="crud__row">
              <input
                id={`${prefix}-ids`}
                className="input mono"
                placeholder="1, 3, 7"
                inputMode="numeric"
                value={idQuery}
                onChange={(e) => {
                  setIdQuery(e.target.value);
                  if (idError) setIdError(null);
                }}
                aria-invalid={!!idError}
                aria-describedby={idError ? `${prefix}-ids-error` : undefined}
                autoComplete="off"
              />
              <button type="submit" className="btn btn--ghost btn--sm" aria-label="Buscar">
                <Icon name="search" size={16} />
              </button>
            </div>
            {idError && <span id={`${prefix}-ids-error`} className="field-error">{idError}</span>}
          </form>
        </div>

        {filter && status === 'ready' && (
          <div className="crud__filter" role="status">
            <span>
              Mostrando ID{filter.length > 1 ? 's' : ''} <span className="mono">{filter.join(', ')}</span>
            </span>
            {missingIds.length > 0 && (
              <span className="crud__filter-missing">
                No existe{missingIds.length > 1 ? 'n' : ''}: <span className="mono">{missingIds.join(', ')}</span>
              </span>
            )}
            <button type="button" className="btn btn--link" onClick={clearFilter}>Ver todos</button>
          </div>
        )}

        {status === 'error' && (
          <div className="crud__state" role="alert">
            <p className="crud__state-title">No se pudieron cargar los registros</p>
            <p>{error}</p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter}>
              <Icon name="refresh" size={16} /> Reintentar
            </button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="crud__state">
            {filter ? (
              <>
                <p className="crud__state-title">Ningún registro con esos IDs</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilter}>Ver todos</button>
              </>
            ) : (
              <>
                <p className="crud__state-title">Aún no hay registros en {serviceName}</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => createRef.current?.focus()}>
                  <Icon name="plus" size={16} /> Agregar registro
                </button>
              </>
            )}
          </div>
        )}

        {(status === 'loading' || (status === 'ready' && items.length > 0)) && (
          <table className="crud__table" aria-busy={status === 'loading'}>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Nombre</th>
                {relation && <th scope="col">{relation.label}</th>}
                <th scope="col" className="crud__actions"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading'
                ? [0, 1, 2, 3].map((i) => (
                    <tr key={i} aria-hidden="true">
                      <td className="crud__id"><div className="skel" style={{ width: 28 }} /></td>
                      <td><div className="skel" style={{ width: `${40 + i * 12}%` }} /></td>
                      {relation && <td><div className="skel" style={{ width: 96 }} /></td>}
                      <td className="crud__actions"><div className="skel" style={{ width: 64 }} /></td>
                    </tr>
                  ))
                : items.map((item) => {
                    const editing = editingId === item.id;
                    const confirming = confirmId === item.id;
                    const busy = busyId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={editing ? 'is-editing' : confirming ? 'is-danger' : undefined}
                        onKeyDown={rowKeys(item.id)}
                      >
                        <td className="crud__id">#{item.id}</td>

                        <td className="crud__name">
                          {editing ? (
                            <div className="crud__edit">
                              <input
                                className="input"
                                value={editValue}
                                autoFocus
                                maxLength={MAX_LEN + 1}
                                aria-label={`Nuevo nombre para el registro ${item.id}`}
                                aria-invalid={!!editError}
                                onChange={(e) => {
                                  setEditValue(e.target.value);
                                  if (editError) setEditError(null);
                                }}
                              />
                              {editError && <span className="field-error">{editError}</span>}
                            </div>
                          ) : confirming ? (
                            <span className="crud__confirm">
                              ¿Eliminar <strong>{item[field]}</strong>? No se puede deshacer.
                            </span>
                          ) : (
                            item[field]
                          )}
                        </td>

                        {relation && (
                          <td className="crud__rel">
                            {editing ? (
                              relSelect(`${prefix}-edit-rel-${item.id}`, editRel, setEditRel, `${relation.label} del registro ${item.id}`)
                            ) : relText(relIdOf(item)) ?? (
                              <span className="crud__rel-none">Sin {relation.label}</span>
                            )}
                          </td>
                        )}

                        <td className="crud__actions">
                          <div className="crud__actions-inner">
                            {editing ? (
                              <>
                                <button type="button" className="btn btn--primary btn--sm" onClick={() => saveEdit(item.id)} disabled={busy}>
                                  {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={16} />}
                                  Guardar
                                </button>
                                <button type="button" className="icon-btn" onClick={cancelRowActions} aria-label="Cancelar edición" title="Cancelar">
                                  <Icon name="close" />
                                </button>
                              </>
                            ) : confirming ? (
                              <>
                                <button type="button" className="btn btn--danger btn--sm" onClick={() => confirmDelete(item.id)} disabled={busy} autoFocus>
                                  {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="trash" size={16} />}
                                  Eliminar
                                </button>
                                <button type="button" className="icon-btn" onClick={cancelRowActions} aria-label="Cancelar eliminación" title="Cancelar">
                                  <Icon name="close" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => startEdit(item)}
                                  disabled={busyId !== null}
                                  aria-label={`Editar registro ${item.id}`}
                                  title="Editar"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn icon-btn--danger"
                                  onClick={() => { setEditingId(null); setConfirmId(item.id); }}
                                  disabled={busyId !== null}
                                  aria-label={`Eliminar registro ${item.id}`}
                                  title="Eliminar"
                                >
                                  <Icon name="trash" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div key={toast.key} className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={toast.kind === 'error' ? 'close' : 'check'} size={16} />
            {toast.text}
          </div>
        )}
      </div>
    </section>
  );
}
