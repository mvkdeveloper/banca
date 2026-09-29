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

const defaults = () => ({
  config: { bancaInicial: 50, metaDiaria: 50, stopLoss: 60, diaAtual: 1 },
  dias: {},
  atualizadoEm: null
});

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaults(), null, 2));
}
function readData() {
  ensureData();
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // migra o formato antigo automaticamente
    if (!raw.config) raw.config = defaults().config;
    if (!raw.dias) raw.dias = {};
    if (raw.fechamentos) {
      for (const [dia, f] of Object.entries(raw.fechamentos)) {
        raw.dias[dia] = { ...(raw.dias[dia] || {}), fechou: Number(f.valor), atualizadoEm: f.atualizadoEm || null };
      }
      delete raw.fechamentos;
      writeData(raw);
    }
    return raw;
  } catch { return defaults(); }
}
function writeData(data) {
  ensureData();
  data.atualizadoEm = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }

app.get('/api/banca', (_req, res) => res.json(readData()));

app.put('/api/banca/config', (req, res) => {
  const data = readData();
  data.config = {
    bancaInicial: Math.max(0, n(req.body.bancaInicial, data.config.bancaInicial)),
    metaDiaria: n(req.body.metaDiaria, data.config.metaDiaria),
    stopLoss: Math.max(0, n(req.body.stopLoss, data.config.stopLoss)),
    diaAtual: Math.min(30, Math.max(1, Math.trunc(n(req.body.diaAtual, data.config.diaAtual))))
  };
  writeData(data);
  res.json({ ok: true, data });
});

app.put('/api/banca/dias/:dia', (req, res) => {
  const dia = Number(req.params.dia);
  const fechou = Number(req.body.fechou);
  if (!Number.isInteger(dia) || dia < 1 || dia > 30 || !Number.isFinite(fechou) || fechou < 0) {
    return res.status(400).json({ ok:false, erro:'Dia ou valor de fechamento inválido.' });
  }
  const data = readData();
  const bancaInicialDia = dia === 1 ? data.config.bancaInicial : (data.dias[String(dia - 1)]?.fechou ?? null);
  const lucroReal = bancaInicialDia == null ? null : fechou - bancaInicialDia;
  data.dias[String(dia)] = {
    ...(data.dias[String(dia)] || {}),
    fechou: Math.round(fechou * 100) / 100,
    bancaInicialReal: bancaInicialDia,
    lucroReal: lucroReal == null ? null : Math.round(lucroReal * 100) / 100,
    atualizadoEm: new Date().toISOString()
  };
  data.config.diaAtual = dia;
  writeData(data);
  res.json({ ok:true, data });
});

app.delete('/api/banca/dias/:dia', (req, res) => {
  const dia = Number(req.params.dia), data = readData();
  if (Number.isInteger(dia) && dia >= 1 && dia <= 30) delete data.dias[String(dia)];
  writeData(data); res.json({ ok:true, data });
});

// compatibilidade com a versão anterior
app.get('/api/fechamentos', (_req, res) => res.json(readData()));
app.post('/api/fechamentos', (req, res) => {
  req.params.dia = String(req.body.dia);
  const dia = Number(req.body.dia), fechou = Number(req.body.valor);
  if (!Number.isInteger(dia) || dia < 1 || dia > 30 || !Number.isFinite(fechou) || fechou < 0) return res.status(400).json({ok:false});
  const data = readData();
  const inicio = dia === 1 ? data.config.bancaInicial : (data.dias[String(dia-1)]?.fechou ?? null);
  data.dias[String(dia)] = { fechou, bancaInicialReal: inicio, lucroReal: inicio == null ? null : fechou-inicio, atualizadoEm:new Date().toISOString() };
  data.config.diaAtual = dia; writeData(data); res.json({ok:true,data});
});

app.use(express.static(__dirname, { index:false }));
app.get('/health', (_req,res) => res.json({status:'ok',app:'BancaPro'}));
app.get('*', (_req,res) => {
  fs.readFile(path.join(__dirname,'index.html'),'utf8',(err,html) => {
    if (err) return res.status(500).send('Erro ao abrir o painel.');
    const tag='<script src="/fechamentos.js"></script>';
    res.type('html').send(html.includes(tag)?html:html.replace('</body>',`${tag}</body>`));
  });
});

ensureData();
app.listen(PORT,'0.0.0.0',()=>console.log(`BancaPro rodando na porta ${PORT}`));