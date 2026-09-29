const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'banca.json');

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ fechamentos: {} }, null, 2));
}
function readData() {
  ensureData();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { fechamentos: {} }; }
}
function writeData(data) { ensureData(); fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

app.get('/api/fechamentos', (_req, res) => res.json(readData()));
app.post('/api/fechamentos', (req, res) => {
  const dia = Number(req.body.dia), valor = Number(req.body.valor);
  if (!Number.isInteger(dia) || dia < 1 || dia > 30 || !Number.isFinite(valor) || valor < 0) return res.status(400).json({ ok:false, erro:'Dia ou valor inválido.' });
  const data = readData(); data.fechamentos ||= {};
  data.fechamentos[String(dia)] = { valor: Math.round(valor * 100) / 100, atualizadoEm: new Date().toISOString() };
  writeData(data);
  res.json({ ok:true, dia, fechamento:data.fechamentos[String(dia)] });
});
app.delete('/api/fechamentos/:dia', (req, res) => {
  const data = readData(); if (data.fechamentos) delete data.fechamentos[String(Number(req.params.dia))]; writeData(data); res.json({ok:true});
});

app.use(express.static(__dirname, { index: false }));
app.get('/health', (_req, res) => res.status(200).json({ status:'ok', app:'BancaPro' }));
app.get('*', (_req, res) => {
  const file = path.join(__dirname, 'index.html');
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) return res.status(500).send('Erro ao abrir o painel.');
    const tag = '<script src="/fechamentos.js"></script>';
    res.type('html').send(html.includes(tag) ? html : html.replace('</body>', `${tag}</body>`));
  });
});

ensureData();
app.listen(PORT, '0.0.0.0', () => console.log(`BancaPro rodando na porta ${PORT}`));
