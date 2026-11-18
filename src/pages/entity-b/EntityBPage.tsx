import CrudScreen from '../../components/crud/CrudScreen';
import { msbApi } from '../../api/msbApi';
import { msaApi } from '../../api/msaApi';
import type { CrudApi, EntityB, RelationConfig } from '../../types';

// MS-B · /api/b → { id, nombreB }. Sin /by-ids: la búsqueda múltiple
// consulta GET /api/b/{id} por cada ID (ver useCrudResource).
// Se pasa sin `conA`/`porIds` para que el hook use buscar() por ID.
const api: CrudApi<EntityB> = {
  listar: msbApi.listar,
  buscar: msbApi.buscar,
  crear: msbApi.crear,
  actualizar: msbApi.actualizar,
  eliminar: msbApi.eliminar,
};

// Cada B puede ligarse a una entidad A (MS-A). MS-B guarda el ID en
// entity_b_entity_a y /api/b/con-a lo usa para traer el nombre por Feign.
const entityA: RelationConfig = {
  field: 'entityAId',
  label: 'Entidad A',
  load: async () => (await msaApi.listar()).map((a) => ({ id: a.id, label: `#${a.id} · ${a.nombreA}` })),
};

export default function EntityBPage() {
  return (
    <CrudScreen
      api={api}
      field="nombreB"
      prefix="msb"
      title="Entidad B"
      serviceName="Entidad B"
      placeholder="Ej. Elemento B1"
      relation={entityA}
    />
  );
}
