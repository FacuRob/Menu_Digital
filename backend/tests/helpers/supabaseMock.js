// Mock mínimo del query-builder de Supabase para tests unitarios.
// Soporta las cadenas usadas por los controllers/middleware:
//   from(t).select(...).eq(...).in(...).order(...).limit(n).maybeSingle()/single()
//   from(t).insert(p).select().single()   / update(p).eq(...)  / upsert(p, o)
// El comportamiento lo define un `handler(query)` que recibe el estado
// acumulado de la consulta y devuelve { data, error, count }.
function createSupabaseMock() {
  let handler = () => ({ data: null, error: null });

  const api = {
    // Reemplaza la lógica de respuesta (por test).
    setHandler(fn) {
      handler = fn;
    },
    from(table) {
      const q = {
        table,
        op: "select",
        filters: {},
        inList: null,
        payload: null,
        ordered: false,
        limited: null,
      };
      const b = {
        select(sel, opts) {
          q.select = sel;
          q.selectOpts = opts;
          return b;
        },
        insert(p) {
          q.op = "insert";
          q.payload = p;
          return b;
        },
        update(p) {
          q.op = "update";
          q.payload = p;
          return b;
        },
        upsert(p, o) {
          q.op = "upsert";
          q.payload = p;
          q.upsertOpts = o;
          return b;
        },
        delete() {
          q.op = "delete";
          return b;
        },
        eq(col, val) {
          q.filters[col] = val;
          return b;
        },
        in(col, vals) {
          q.inList = { col, vals };
          return b;
        },
        order() {
          q.ordered = true;
          return b;
        },
        limit(n) {
          q.limited = n;
          return b;
        },
        single() {
          return Promise.resolve(handler(q));
        },
        maybeSingle() {
          return Promise.resolve(handler(q));
        },
        // Los query-builders de supabase son "thenables" (await-ables).
        then(res, rej) {
          return Promise.resolve(handler(q)).then(res, rej);
        },
      };
      return b;
    },
  };
  return api;
}

// Inyecta un módulo en la caché de require para que quien lo requiera reciba
// el mock (sin ejecutar el módulo real). Debe llamarse ANTES de requerir el
// módulo bajo prueba.
function injectModule(absPath, exportsObj) {
  require.cache[absPath] = {
    id: absPath,
    filename: absPath,
    loaded: true,
    exports: exportsObj,
    children: [],
    paths: [],
  };
}

module.exports = { createSupabaseMock, injectModule };
