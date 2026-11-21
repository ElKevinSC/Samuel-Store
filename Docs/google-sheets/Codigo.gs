/**
 * Samuel Store · Panel en Google Sheets
 * ------------------------------------------------------------------
 * Pega este archivo completo en Extensiones → Apps Script (Código.gs),
 * guarda, recarga la hoja y usa el menú "Samuel Store → Conectar con la tienda".
 *
 * - Se actualiza sola cada 15 minutos (y con "Actualizar ahora").
 * - Productos, Inventario y Suscripciones se pueden editar: cada cambio
 *   se manda a la tienda al momento y la columna "Sincronización" dice
 *   ✅ si se guardó o ❌ con el motivo.
 * - Ventas generales, Pedidos y Revendedores son solo de lectura.
 */

const TZ = 'America/Guatemala';
const AUTO_MINUTES = 15;
const STATUS_TITLE = 'Sincronización';
const EXTRA_ROWS = 100; // filas vacías preparadas para agregar cosas nuevas

const COLORS = { header: '#0b1320', headerText: '#ffffff', editable: '#fff8e1', readonly: '#f3f4f6', title: '#00a3ff' };
const MONEY = '"Q"#,##0.00';
const DATE = 'dd/mm/yyyy';

// Pestañas. key = nombre interno, name = nombre visible.
const TABS = [
  { key: 'ventas', name: 'Ventas generales' },
  { key: 'pedidos', name: 'Pedidos' },
  { key: 'suscripciones', name: 'Suscripciones', editable: true },
  { key: 'inventario', name: 'Inventario', editable: true },
  { key: 'productos', name: 'Productos', editable: true },
  { key: 'revendedores', name: 'Revendedores' },
];

// Columnas de cada pestaña: k = dato, t = título, y opciones:
// edit (se puede editar), id (columna oculta), text (texto exacto, ej. PIN 0012),
// money, date, list (lista desplegable), check (casilla).
const COLS = {
  pedidos: [
    { k: 'fecha', t: 'Fecha' },
    { k: 'cliente', t: 'Cliente' },
    { k: 'rol', t: 'Tipo de cliente' },
    { k: 'estado', t: 'Estado' },
    { k: 'seccion', t: 'Sección' },
    { k: 'juego', t: 'Juego / plataforma' },
    { k: 'paquete', t: 'Paquete' },
    { k: 'cantidad', t: 'Cantidad' },
    { k: 'precio', t: 'Precio', money: true },
    { k: 'total_linea', t: 'Total línea', money: true },
    { k: 'total_pedido', t: 'Total pedido', money: true },
    { k: 'contacto', t: 'ID / WhatsApp', text: true },
    { k: 'referencia', t: 'Referencia NC', text: true },
    { k: 'fecha_deposito', t: 'Fecha depósito', date: true },
    { k: 'renovacion', t: 'Renovación' },
  ],
  suscripciones: [
    { k: 'id', t: 'ID', id: true },
    { k: 'plataforma', t: 'Plataforma' },
    { k: 'perfil', t: 'Perfil', edit: true, text: true },
    { k: 'correo', t: 'Correo', edit: true, text: true },
    { k: 'contrasena', t: 'Contraseña', edit: true, text: true },
    { k: 'pin', t: 'PIN', edit: true, text: true },
    { k: 'vence', t: 'Vence', edit: true, date: true },
    { k: 'dias', t: 'Días restantes' },
    { k: 'estado', t: 'Estado' },
    { k: 'comprador', t: 'Comprador' },
    { k: 'whatsapp_comprador', t: 'WhatsApp comprador', text: true },
    { k: 'para', t: 'Para (cliente final)', edit: true },
    { k: 'whatsapp_para', t: 'WhatsApp cliente final', edit: true, text: true },
    { k: 'origen', t: 'Origen' },
  ],
  inventario: [
    { k: 'id', t: 'ID', id: true },
    { k: 'plataforma', t: 'Plataforma', edit: true },
    { k: 'tipo', t: 'Tipo', edit: true, list: ['Perfil', 'Cuenta completa'] },
    { k: 'correo', t: 'Correo', edit: true, text: true },
    { k: 'contrasena', t: 'Contraseña', edit: true, text: true },
    { k: 'perfil', t: 'Perfil', edit: true, text: true },
    { k: 'pin', t: 'PIN', edit: true, text: true },
    { k: 'estado', t: 'Estado', edit: true, list: ['Disponible', 'Desactivada', 'Vendida'] },
    { k: 'vendida_a', t: 'Vendida a' },
    { k: 'vence', t: 'Vence', date: true },
  ],
  productos: [
    { k: 'id', t: 'ID', id: true },
    { k: 'seccion', t: 'Sección', edit: true, list: ['Videojuegos', 'Streaming'] },
    { k: 'juego', t: 'Juego / plataforma', edit: true },
    { k: 'nombre', t: 'Nombre del paquete', edit: true },
    { k: 'precio', t: 'Precio cliente', edit: true, money: true },
    { k: 'precio_revendedor', t: 'Precio revendedor', edit: true, money: true },
    { k: 'dias', t: 'Días (streaming)', edit: true },
    { k: 'tipo', t: 'Entrega (streaming)', edit: true, list: ['Perfil', 'Cuenta completa'] },
    { k: 'visible', t: 'Visible', edit: true, check: true },
    { k: 'pide', t: 'El cliente da', edit: true, list: ['ID de jugador', 'WhatsApp'] },
  ],
  revendedores: [
    { k: 'nombre', t: 'Revendedor' },
    { k: 'whatsapp', t: 'WhatsApp', text: true },
    { k: 'compras_mes', t: 'Compras este mes', money: true },
    { k: 'pedidos_mes', t: 'Pedidos este mes' },
    { k: 'meta', t: 'Meta Q200' },
    { k: 'compras_mes_anterior', t: 'Mes anterior', money: true },
    { k: 'cuentas_activas', t: 'Cuentas activas' },
    { k: 'por_vencer', t: 'Por vencer (5 días)' },
  ],
};

// ------------------------------------------------------------------
// Menú
// ------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Samuel Store')
    .addItem('Conectar con la tienda', 'conectar')
    .addItem('Actualizar ahora', 'actualizarAhora')
    .addSeparator()
    .addItem('Desconectar', 'desconectar')
    .addToUi();
}

function conectar() {
  const ui = SpreadsheetApp.getUi();
  const ask = (title, text) => {
    const r = ui.prompt(title, text, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) throw new Error('Cancelado');
    return r.getResponseText().trim();
  };
  try {
    const url = ask('Paso 1 de 3', 'Project URL de Supabase (Settings → API). Ejemplo: https://xxxx.supabase.co').replace(/\/+$/, '');
    const key = ask('Paso 2 de 3', 'Clave "anon public" de Supabase (Settings → API).');
    const secret = ask('Paso 3 de 3', 'Clave de la hoja (resultado de: select secret from public.sheet_sync_config;)');
    const props = PropertiesService.getScriptProperties();
    props.setProperties({ SUPABASE_URL: url, SUPABASE_KEY: key, SHEET_SECRET: secret });
    rpc_('sheet_export', { p_secret: secret }); // prueba la conexión
    instalarTriggers_();
    actualizarTodo();
    ui.alert('¡Conectado! La hoja se actualiza sola cada ' + AUTO_MINUTES + ' minutos.');
  } catch (err) {
    if (String(err.message) !== 'Cancelado') ui.alert('No se pudo conectar: ' + err.message);
  }
}

function desconectar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  PropertiesService.getScriptProperties().deleteAllProperties();
  SpreadsheetApp.getUi().alert('Desconectado. La hoja ya no se comunica con la tienda.');
}

function actualizarAhora() {
  actualizarTodo();
  SpreadsheetApp.getActive().toast('Datos actualizados', 'Samuel Store', 4);
}

function instalarTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('actualizarTodo').timeBased().everyMinutes(AUTO_MINUTES).create();
  ScriptApp.newTrigger('alEditar').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}

// ------------------------------------------------------------------
// Comunicación con Supabase
// ------------------------------------------------------------------
function config_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!p.SUPABASE_URL || !p.SUPABASE_KEY || !p.SHEET_SECRET) throw new Error('Primero usa Samuel Store → Conectar con la tienda.');
  return p;
}

function rpc_(name, body) {
  const c = config_();
  const res = UrlFetchApp.fetch(c.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: c.SUPABASE_KEY, Authorization: 'Bearer ' + c.SUPABASE_KEY },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const text = res.getContentText();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (res.getResponseCode() >= 300) throw new Error((data && data.message) || text || ('Error ' + res.getResponseCode()));
  return data;
}

// ------------------------------------------------------------------
// Actualizar la hoja con los datos de la tienda
// ------------------------------------------------------------------
function actualizarTodo() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const c = config_();
    const data = rpc_('sheet_export', { p_secret: c.SHEET_SECRET });
    const ss = SpreadsheetApp.getActive();
    escribirVentas_(hoja_(ss, 'ventas'), data);
    escribirTabla_(hoja_(ss, 'pedidos'), 'pedidos', data.pedidos || []);
    escribirTabla_(hoja_(ss, 'suscripciones'), 'suscripciones', data.suscripciones || []);
    escribirTabla_(hoja_(ss, 'inventario'), 'inventario', data.inventario || []);
    escribirTabla_(hoja_(ss, 'productos'), 'productos', data.productos || []);
    const resellers = (data.revendedores || []).map(r => Object.assign({}, r, {
      meta: Number(r.compras_mes) >= 200 ? '✅ Cumple' : 'Faltan Q' + (200 - Number(r.compras_mes)).toFixed(2),
    }));
    escribirTabla_(hoja_(ss, 'revendedores'), 'revendedores', resellers);
    const extra = ss.getSheetByName('Hoja 1');
    if (extra && extra.getLastRow() === 0 && ss.getSheets().length > TABS.length) ss.deleteSheet(extra);
  } finally {
    lock.releaseLock();
  }
}

function hoja_(ss, key) {
  const tab = TABS.find(x => x.key === key);
  let sh = ss.getSheetByName(tab.name);
  if (!sh) sh = ss.insertSheet(tab.name, TABS.indexOf(tab));
  return sh;
}

function aCelda_(v, col) {
  if (v === null || v === undefined) return '';
  if (col.check) return v === true || v === 'true';
  if (col.date && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 12); // mediodía: evita que cambie el día por zona horaria
  }
  if (col.text) return String(v);
  return v;
}

function escribirTabla_(sh, key, rows) {
  const cols = COLS[key];
  const tab = TABS.find(x => x.key === key);
  const width = cols.length + (tab.editable ? 1 : 0);
  const titles = cols.map(c => c.t).concat(tab.editable ? [STATUS_TITLE] : []);

  // Filas nuevas que el usuario está llenando (sin ID): se conservan.
  let pending = [];
  if (tab.editable && sh.getLastRow() > 1) {
    pending = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues()
      .filter(r => !r[0] && cols.some((c, i) => c.edit && !c.check && r[i] !== '' && r[i] !== null));
  }

  const values = rows.map(r => cols.map(c => aCelda_(r[c.k], c)).concat(tab.editable ? [''] : []));
  const all = values.concat(pending);
  const total = Math.max(all.length + (tab.editable ? EXTRA_ROWS : 0), 1);

  if (sh.getMaxRows() < total + 1) sh.insertRowsAfter(sh.getMaxRows(), total + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearContent().clearDataValidations();

  // Encabezado
  sh.getRange(1, 1, 1, width).setValues([titles])
    .setBackground(COLORS.header).setFontColor(COLORS.headerText).setFontWeight('bold');
  sh.setFrozenRows(1);

  // Formatos por columna (antes de escribir, para que "0012" no pierda el cero)
  cols.forEach((c, i) => {
    const range = sh.getRange(2, i + 1, total, 1);
    if (c.text) range.setNumberFormat('@');
    else if (c.money) range.setNumberFormat(MONEY);
    else if (c.date) range.setNumberFormat(DATE);
    range.setBackground(tab.editable && c.edit ? COLORS.editable : (tab.editable ? COLORS.readonly : null));
    if (c.list) range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(c.list, true).setAllowInvalid(false).build());
    if (c.check) range.insertCheckboxes();
  });

  if (all.length) sh.getRange(2, 1, all.length, width).setValues(all);
  if (cols[0].id) sh.hideColumns(1);
  if (tab.editable) sh.getRange(2, width, total, 1).setBackground(null).setFontColor('#555555');
}

function escribirVentas_(sh, data) {
  sh.clear();
  const meses = data.resumen_mensual || [];
  const actual = meses.find(m => m.mes === data.mes) || {};
  let row = 1;
  sh.getRange(row, 1).setValue('Samuel Store · Ventas generales').setFontSize(16).setFontWeight('bold').setFontColor(COLORS.title);
  sh.getRange(row + 1, 1).setValue('Actualizado: ' + data.generado + ' · solo cuentan pedidos completados').setFontColor('#666666');
  row = 4;

  // Indicadores del mes
  const kpis = [
    ['Ventas este mes', Number(actual.ventas || 0), MONEY],
    ['Pedidos completados', Number(actual.pedidos || 0), '0'],
    ['Videojuegos', Number(actual.videojuegos || 0), MONEY],
    ['Streaming', Number(actual.streaming || 0), MONEY],
    ['Por aprobar', Number(actual.pendiente || 0), MONEY],
  ];
  kpis.forEach((k, i) => {
    sh.getRange(row, i + 1).setValue(k[0]).setFontColor('#666666');
    sh.getRange(row + 1, i + 1).setValue(k[1]).setNumberFormat(k[2]).setFontSize(14).setFontWeight('bold');
  });
  row += 3;

  row = bloque_(sh, row, 'Resumen por mes',
    ['Mes', 'Ventas', 'Pedidos', 'Videojuegos', 'Streaming', 'Clientes', 'Revendedores', 'Por aprobar', 'Rechazados'],
    meses.map(m => [m.mes, m.ventas, m.pedidos, m.videojuegos, m.streaming, m.clientes, m.revendedores, m.pendiente, m.rechazados]),
    [null, MONEY, '0', MONEY, MONEY, MONEY, MONEY, MONEY, '0']);

  row = bloque_(sh, row, 'Este mes por juego / plataforma',
    ['Sección', 'Juego / plataforma', 'Unidades', 'Ventas'],
    (data.resumen_productos || []).map(p => [p.seccion, p.juego, p.unidades, p.ventas]),
    [null, null, '0', MONEY]);

  bloque_(sh, row, 'Ventas por día (últimos 31 días)',
    ['Día', 'Ventas', 'Pedidos'],
    (data.resumen_diario || []).map(d => [aCelda_(d.dia, { date: true }), d.ventas, d.pedidos]),
    [DATE, MONEY, '0']);

  sh.setColumnWidth(1, 160);
}

function bloque_(sh, row, title, headers, rows, formats) {
  sh.getRange(row, 1).setValue(title).setFontWeight('bold').setFontSize(12);
  sh.getRange(row + 1, 1, 1, headers.length).setValues([headers])
    .setBackground(COLORS.header).setFontColor(COLORS.headerText).setFontWeight('bold');
  if (rows.length) {
    sh.getRange(row + 2, 1, rows.length, headers.length).setValues(rows);
    formats.forEach((f, i) => { if (f) sh.getRange(row + 2, i + 1, rows.length, 1).setNumberFormat(f); });
  } else {
    sh.getRange(row + 2, 1).setValue('Sin datos todavía').setFontColor('#999999');
  }
  return row + 3 + Math.max(rows.length, 1);
}

// ------------------------------------------------------------------
// Mandar a la tienda lo que se edita en la hoja
// ------------------------------------------------------------------
function alEditar(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const tab = TABS.find(x => x.name === sh.getName());
  if (!tab || !tab.editable) return;
  const cols = COLS[tab.key];
  const statusCol = cols.length + 1;
  const first = Math.max(e.range.getRow(), 2);
  const last = e.range.getRow() + e.range.getNumRows() - 1;
  if (last < 2) return;
  if (e.range.getColumn() === statusCol && e.range.getNumColumns() === 1) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const c = config_();
    for (let r = first; r <= last; r++) {
      const vals = sh.getRange(r, 1, 1, cols.length).getValues()[0];
      const status = sh.getRange(r, statusCol);
      const row = {};
      cols.forEach((col, i) => { row[col.k] = desdeCelda_(vals[i], col); });
      const hasData = cols.some(col => col.edit && !col.check && row[col.k] !== '');
      if (!row.id && !hasData) { status.setValue(''); continue; }
      const missing = !row.id ? faltante_(tab.key, row) : '';
      if (missing) { status.setValue('✏️ Falta: ' + missing); continue; }
      try {
        const res = rpc_('sheet_apply', { p_secret: c.SHEET_SECRET, p_tab: tab.key, p_row: row });
        if (!row.id && res && res.id) sh.getRange(r, 1).setValue(res.id);
        status.setValue('✅ ' + ((res && res.mensaje) || 'Guardado') + ' · ' + Utilities.formatDate(new Date(), TZ, 'HH:mm'));
      } catch (err) {
        status.setValue('❌ ' + err.message);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function desdeCelda_(v, col) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (col.check) return v === true;
  if (typeof v === 'number') return v;
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Para filas nuevas: no se manda nada hasta que tenga lo mínimo. */
function faltante_(key, row) {
  const need = {
    inventario: ['plataforma', 'correo', 'contrasena'].concat(String(row.tipo).indexOf('complet') >= 0 ? [] : ['perfil']),
    productos: ['seccion', 'juego', 'nombre', 'precio'].concat(row.seccion === 'Streaming' ? ['dias'] : []),
    suscripciones: [],
  }[key] || [];
  const names = { plataforma: 'plataforma', correo: 'correo', contrasena: 'contraseña', perfil: 'perfil', seccion: 'sección', juego: 'juego', nombre: 'nombre', precio: 'precio', dias: 'días' };
  return need.filter(k => row[k] === '' || row[k] === null || row[k] === undefined).map(k => names[k]).join(', ');
}
