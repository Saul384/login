// Tipos compartidos del frontend.

/** Claims del JWT que emite el Authorization Server (solo los que usa la UI). */
export interface JwtClaims {
  sub?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  [claim: string]: unknown;
}

/** Sesión guardada en sessionStorage tras el intercambio del code. */
export interface Session {
  accessToken: string;
  idToken: string | null;
  scope: string;
  expiresAt: number;
  user: JwtClaims | null;
}

/** MS-A · /api/entity-a */
export interface EntityA {
  id: number;
  nombreA: string;
}

/** MS-B · /api/b */
export interface EntityB {
  id: number;
  nombreB: string;
  /** ID de la entidad A relacionada (MS-A); null si no tiene. */
  entityAId?: number | null;
}

/** MS-B · /api/b/con-a (OpenFeign → MS-A) */
export interface EntityBConA {
  id: number;
  nombreB: string;
  nombreA: string | null;
}

/** Operaciones que necesita la pantalla CRUD genérica. */
export interface CrudApi<T extends { id: number }> {
  listar: () => Promise<T[]>;
  buscar: (id: number) => Promise<T>;
  /** relId: ID del registro relacionado (p. ej. la entidad A de un B); solo si la pantalla usa `relation`. */
  crear: (value: string, relId?: number | null) => Promise<T>;
  actualizar: (id: number, value: string, relId?: number | null) => Promise<T>;
  eliminar: (id: number) => Promise<unknown>;
  porIds?: (ids: number[]) => Promise<T[]>;
}

/** Opción del selector de relación (p. ej. una entidad A). */
export interface RelationOption {
  id: number;
  label: string;
}

/** Relación opcional que muestra la pantalla CRUD: columna + selector. */
export interface RelationConfig {
  /** Propiedad del registro que guarda el ID relacionado (p. ej. entityAId). */
  field: string;
  /** Texto de la columna y del selector (p. ej. "Entidad A"). */
  label: string;
  /** Carga las opciones del selector. */
  load: () => Promise<RelationOption[]>;
}

export type LoadStatus ='loading' | 'ready' | 'error';
