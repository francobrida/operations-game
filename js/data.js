/* Shared fictional dataset: every track (and the Final Case) reads from here.
   Deliberate problems: August payments duplicated by a double import, NULLs,
   messy artist names (case / extra spaces), an orphan song (artist_id 99),
   and an artist with no songs. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};

  const artists = [
    { id: 1, name: 'Luna Ferreyra',  country: 'Argentina' },
    { id: 2, name: 'Los Cardales',   country: 'Argentina' },
    { id: 3, name: 'Marta Quiroga',  country: 'Uruguay' },
    { id: 4, name: 'DJ Pampa',       country: 'Chile' },
    { id: 5, name: 'Sofía Beltrán',  country: 'Mexico' },
    { id: 6, name: 'Andes Trío',     country: 'Peru' },
    { id: 7, name: 'Camila Roldán',  country: 'Colombia' },
    { id: 8, name: 'Nico Valdés',    country: 'Spain' },
    { id: 9, name: 'Valentina Ríos', country: 'Chile' },
  ];

  const songs = [
    { id: 1,  title: 'Mar de Fondo',         artist_id: 1,  plays: 48200, duration_sec: 215 },
    { id: 2,  title: 'Faro',                 artist_id: 1,  plays: 12900, duration_sec: 190 },
    { id: 3,  title: 'Zamba del Alba',       artist_id: 2,  plays: 35600, duration_sec: 242 },
    { id: 4,  title: 'Candombe Azul',        artist_id: 3,  plays: 20100, duration_sec: 267 },
    { id: 5,  title: 'Pampa Beat',           artist_id: 4,  plays: 91000, duration_sec: 198 },
    { id: 6,  title: 'Luces de Ciudad',      artist_id: 5,  plays: 57300, duration_sec: 223 },
    { id: 7,  title: 'Viento del Sur',       artist_id: 6,  plays: 8700,  duration_sec: 301 },
    { id: 8,  title: 'Cartas sin Enviar',    artist_id: 7,  plays: 23400, duration_sec: 205 },
    { id: 9,  title: 'Costa Brava',          artist_id: 8,  plays: 66500, duration_sec: 234 },
    { id: 10, title: 'Noche de Fogón',       artist_id: 2,  plays: 15200, duration_sec: 256 },
    { id: 11, title: 'Lluvia en Montevideo', artist_id: 3,  plays: 9800,  duration_sec: 281 },
    { id: 12, title: 'Ritmo Austral',        artist_id: 4,  plays: 40300, duration_sec: 187 },
    { id: 13, title: 'Canción sin Dueño',    artist_id: 99, plays: 5100,  duration_sec: 175 },
    { id: 14, title: 'Cielo Abierto',        artist_id: 5,  plays: 28700, duration_sec: 212 },
  ];

  const P = (id, artist, song, amount, payment_date) => ({ id, artist, song, amount, payment_date });
  const payments = [
    // July batch (payments_2026-07.csv) - clean
    P(1,  'Luna Ferreyra', 'Mar de Fondo',      120.50, '2026-07-10'),
    P(2,  'Los Cardales',  'Zamba del Alba',     98.00, '2026-07-10'),
    P(3,  'Marta Quiroga', 'Candombe Azul',      75.25, '2026-07-10'),
    P(4,  'DJ Pampa',      'Pampa Beat',        210.00, '2026-07-10'),
    P(5,  'Sofía Beltrán', 'Luces de Ciudad',   134.80, '2026-07-10'),
    P(6,  'Andes Trío',    'Viento del Sur',     66.40, '2026-07-10'),
    // August batch (payments_2026-08.csv), first import at 10:02
    P(7,  'Luna Ferreyra', 'Mar de Fondo',      125.00, '2026-08-14'),
    P(8,  'Luna Ferreyra', 'Faro',               60.00, '2026-08-14'),
    P(9,  'Los Cardales',  'Zamba del Alba',    101.00, '2026-08-14'),
    P(10, 'Marta Quiroga', 'Candombe Azul',      80.00, '2026-08-14'),
    P(11, 'DJ Pampa',      'Pampa Beat',        220.00, '2026-08-14'),
    P(12, 'Sofía Beltrán', 'Luces de Ciudad',   140.00, '2026-08-14'),
    P(13, 'Andes Trío',    'Viento del Sur',     70.00, '2026-08-14'),
    P(14, 'Camila Roldán', 'Cartas sin Enviar',  95.50, '2026-08-14'),
    P(15, 'Nico Valdés',   'Costa Brava',       115.00, '2026-08-14'),
    // Same August file imported again at 10:47: 6 rows loaded twice (the bug)
    P(16, 'Luna Ferreyra', 'Mar de Fondo',      125.00, '2026-08-14'),
    P(17, 'Luna Ferreyra', 'Faro',               60.00, '2026-08-14'),
    P(18, 'DJ Pampa',      'Pampa Beat',        220.00, '2026-08-14'),
    P(19, 'Sofía Beltrán', 'Luces de Ciudad',   140.00, '2026-08-14'),
    P(20, 'Camila Roldán', 'Cartas sin Enviar',  95.50, '2026-08-14'),
    P(21, 'Nico Valdés',   'Costa Brava',       115.00, '2026-08-14'),
    // September batch (payments_2026-09.csv) - messy names and NULLs
    P(22, 'luna ferreyra',     'Mar de Fondo',      118.00, '2026-09-12'),
    P(23, '  Marta Quiroga ',  'Candombe Azul',      77.00, '2026-09-12'),
    P(24, 'LOS CARDALES',      'Zamba del Alba',     99.50, '2026-09-12'),
    P(25, null,                'Canción sin Dueño',  40.00, '2026-09-12'),
    P(26, 'Andes Trío',        'Viento del Sur',      null, '2026-09-12'),
    P(27, 'Nico Valdés',       'Costa Brava',       175.00, null),
  ];

  const import_log = [
    { id: 1, file: 'payments_2026-07.csv', date: '2026-07-10', rows_loaded: 6 },
    { id: 2, file: 'payments_2026-08.csv', date: '2026-08-14', rows_loaded: 9 },
    { id: 3, file: 'payments_2026-08.csv', date: '2026-08-14', rows_loaded: 6 },
    { id: 4, file: 'payments_2026-09.csv', date: '2026-09-12', rows_loaded: 6 },
  ];

  const schema = {
    artists: ['id', 'name', 'country'],
    songs: ['id', 'title', 'artist_id', 'plays', 'duration_sec'],
    payments: ['id', 'artist', 'song', 'amount', 'payment_date'],
    import_log: ['id', 'file', 'date', 'rows_loaded'],
  };
  const types = {
    artists: ['INTEGER PRIMARY KEY', 'TEXT', 'TEXT'],
    songs: ['INTEGER PRIMARY KEY', 'TEXT', 'INTEGER', 'INTEGER', 'INTEGER'],
    payments: ['INTEGER PRIMARY KEY', 'TEXT', 'TEXT', 'REAL', 'TEXT'],
    import_log: ['INTEGER PRIMARY KEY', 'TEXT', 'TEXT', 'INTEGER'],
  };
  const tables = { artists, songs, payments, import_log };

  function cell(table, col, v) {
    if (v === null || v === undefined) return '';
    if (table === 'payments' && col === 'amount') return Number(v).toFixed(2);
    return String(v);
  }
  function toCSV(name) {
    const cols = schema[name];
    const rows = tables[name].map(r => cols.map(c => cell(name, c, r[c])).join(','));
    return [cols.join(',')].concat(rows).join('\n') + '\n';
  }

  // Import logs for the Bash track; they tell the same story as import_log.
  const logs = {
    'import_2026-07-10.log': [
      '2026-07-10 09:15:02 INFO start import file=payments_2026-07.csv',
      '2026-07-10 09:15:04 INFO rows_loaded=6',
      '2026-07-10 09:15:04 INFO finished OK',
    ],
    'import_2026-08-14.log': [
      '2026-08-14 10:02:11 INFO start import file=payments_2026-08.csv',
      '2026-08-14 10:02:13 INFO rows_loaded=9',
      '2026-08-14 10:02:13 INFO finished OK',
      '2026-08-14 10:47:40 INFO start import file=payments_2026-08.csv',
      '2026-08-14 10:47:41 ERROR duplicate_batch file=payments_2026-08.csv',
      '2026-08-14 10:47:41 WARN dedup_check skipped by retry flag',
      '2026-08-14 10:47:43 INFO rows_loaded=6',
      '2026-08-14 10:47:43 INFO finished WITH_WARNINGS',
      '2026-08-14 11:30:05 INFO start import file=payments_2026-08.csv',
      '2026-08-14 11:30:06 ERROR duplicate_batch file=payments_2026-08.csv',
      '2026-08-14 11:30:06 ERROR import aborted, nothing loaded',
      '2026-08-14 11:30:06 INFO finished ABORTED',
    ],
    'import_2026-09-12.log': [
      '2026-09-12 09:20:01 INFO start import file=payments_2026-09.csv',
      '2026-09-12 09:20:02 WARN null_value column=amount row=5',
      '2026-09-12 09:20:02 ERROR timeout metadata_service retry=1',
      '2026-09-12 09:20:05 ERROR timeout metadata_service retry=2',
      '2026-09-12 09:20:07 INFO rows_loaded=6',
      '2026-09-12 09:20:07 INFO finished WITH_WARNINGS',
    ],
  };
  for (const k of Object.keys(logs)) logs[k] = logs[k].join('\n') + '\n';

  OT.data = {
    company: 'Sonora Royalties',
    storyDate: '2026-09-15',
    artists, songs, payments, import_log,
    schema, types, tables, toCSV, logs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
