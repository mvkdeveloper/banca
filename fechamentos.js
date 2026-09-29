let fechamentosBanca = {};

const moeda = v => 'R$' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function carregarFechamentos() {
  try {
    const r = await fetch('/api/fechamentos');
    const data = await r.json();
    fechamentosBanca = data.fechamentos || {};
    atualizarFechamentosNaTabela();
  } catch (e) { console.error('Erro ao carregar fechamentos:', e); }
}

function criarPainelFechamento() {
  const form = document.querySelector('.form-card');
  if (!form || document.getElementById('fechamentoBox')) return;
  const box = document.createElement('div');
  box.id = 'fechamentoBox';
  box.innerHTML = `
    <div class="divider"></div>
    <div class="card-title"><i data-lucide="circle-check-big" class="icon"></i>Fechar dia</div>
    <div class="input-group">
      <label class="input-label">Quanto fechou o dia</label>
      <div class="input-row"><span class="input-prefix">R$</span><input type="number" inputmode="decimal" step="0.01" min="0" id="iFechou" placeholder="0,00"></div>
    </div>
    <button class="btn" id="btnFechar" type="button"><i data-lucide="save" class="icon"></i>Salvar fechamento</button>
    <div id="fechamentoStatus" style="font:11px 'JetBrains Mono';color:var(--muted);margin-top:10px;text-align:center"></div>`;
  form.appendChild(box);
  document.getElementById('btnFechar').addEventListener('click', salvarFechamento);
  if (window.lucide) lucide.createIcons();
}

async function salvarFechamento() {
  const dia = Math.min(30, Math.max(1, parseInt(document.getElementById('iDia').value) || 1));
  const valor = Number(document.getElementById('iFechou').value);
  const status = document.getElementById('fechamentoStatus');
  if (!Number.isFinite(valor) || valor < 0) { status.textContent = 'Digite um valor válido.'; status.style.color = 'var(--red)'; return; }
  status.textContent = 'Salvando...'; status.style.color = 'var(--muted)';
  try {
    const r = await fetch('/api/fechamentos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ dia, valor }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'Erro');
    fechamentosBanca[String(dia)] = data.fechamento;
    status.textContent = `Dia ${dia} salvo: ${moeda(valor)}`;
    status.style.color = 'var(--green)';
    atualizarFechamentosNaTabela();
  } catch (e) { status.textContent = 'Não foi possível salvar.'; status.style.color = 'var(--red)'; }
}

function atualizarFechamentosNaTabela() {
  const table = document.querySelector('table');
  if (!table) return;
  const head = table.querySelector('thead tr');
  if (head && !head.querySelector('.th-fechou')) {
    const th = document.createElement('th'); th.className = 'th-fechou'; th.textContent = 'Fechou'; head.appendChild(th);
  }
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    let td = tr.querySelector('.td-fechou');
    if (!td) { td = document.createElement('td'); td.className = 'td-fechou'; tr.appendChild(td); }
    const f = fechamentosBanca[String(i + 1)];
    td.innerHTML = f ? `<span class="pill pill-green">${moeda(f.valor)}</span>` : '<span style="color:var(--muted)">—</span>';
  });
  const dia = Math.min(30, Math.max(1, parseInt(document.getElementById('iDia')?.value) || 1));
  const atual = fechamentosBanca[String(dia)];
  const inp = document.getElementById('iFechou');
  if (inp && document.activeElement !== inp) inp.value = atual ? atual.valor : '';
}

window.addEventListener('DOMContentLoaded', () => {
  criarPainelFechamento();
  carregarFechamentos();
  document.getElementById('iDia')?.addEventListener('input', () => setTimeout(atualizarFechamentosNaTabela, 0));
  const original = window.calcular;
  if (typeof original === 'function') window.calcular = function(){ original(); setTimeout(atualizarFechamentosNaTabela, 0); };
});
