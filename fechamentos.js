let bancoBanca = { config:{}, dias:{} };
const moeda = v => 'R$' + Number(v || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

async function carregarBanco(){
  try{
    const r=await fetch('/api/banca');
    bancoBanca=await r.json();
    const c=bancoBanca.config||{};
    if(document.getElementById('iInicial')) document.getElementById('iInicial').value=c.bancaInicial ?? 50;
    if(document.getElementById('iMeta')) document.getElementById('iMeta').value=c.metaDiaria ?? 50;
    if(document.getElementById('iStop')) document.getElementById('iStop').value=c.stopLoss ?? 60;
    if(document.getElementById('iDia')) document.getElementById('iDia').value=c.diaAtual ?? 1;
    aplicarBancaReal();
  }catch(e){console.error(e)}
}

function criarPainelFechamento(){
  const form=document.querySelector('.form-card');
  if(!form||document.getElementById('fechamentoBox'))return;
  const box=document.createElement('div');box.id='fechamentoBox';
  box.innerHTML=`<div class="divider"></div><div class="card-title"><i data-lucide="circle-check-big" class="icon"></i>Fechar dia</div><div class="input-group"><label class="input-label">Quanto fechou o dia</label><div class="input-row"><span class="input-prefix">R$</span><input type="number" inputmode="decimal" step="0.01" min="0" id="iFechou" placeholder="0,00"></div></div><button class="btn" id="btnFechar" type="button"><i data-lucide="check" class="icon"></i>Fechar dia e avançar</button><div id="fechamentoStatus" style="font:11px 'JetBrains Mono';color:var(--muted);margin-top:10px;text-align:center"></div>`;
  form.appendChild(box);document.getElementById('btnFechar').onclick=salvarFechamento;if(window.lucide)lucide.createIcons();
}

async function salvarConfig(){
  const body={bancaInicial:Number(iInicial.value)||0,metaDiaria:Number(iMeta.value)||0,stopLoss:Number(iStop.value)||0,diaAtual:Number(iDia.value)||1};
  try{await fetch('/api/banca/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}catch(e){}
}

async function salvarFechamento(){
  const dia=Math.min(30,Math.max(1,parseInt(iDia.value)||1));
  const valor=Number(document.getElementById('iFechou').value),status=document.getElementById('fechamentoStatus');
  if(!Number.isFinite(valor)||valor<0){status.textContent='Digite quanto a banca fechou.';status.style.color='var(--red)';return}
  status.textContent='Salvando...';
  try{
    await salvarConfig();
    const r=await fetch('/api/banca/dias/'+dia,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({fechou:valor})});
    const out=await r.json();if(!r.ok)throw new Error(out.erro);
    bancoBanca=out.data;
    const proximo=Math.min(30,dia+1);
    // Ao fechar, o valor real passa a ser a nova banca e o painel avança para o próximo dia.
    bancoBanca.config.bancaInicial=valor;
    bancoBanca.config.diaAtual=proximo;
    iInicial.value=valor;iDia.value=proximo;
    await fetch('/api/banca/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({bancaInicial:valor,metaDiaria:Number(iMeta.value)||0,stopLoss:Number(iStop.value)||0,diaAtual:proximo})});
    bancoBanca.config.diaAtual=proximo;
    document.getElementById('iFechou').value='';
    status.textContent=dia<30?`Dia ${dia} fechado em ${moeda(valor)}. Agora: dia ${proximo}.`:`Dia 30 fechado em ${moeda(valor)}.`;
    status.style.color='var(--green)';
    aplicarBancaReal();
  }catch(e){status.textContent='Não foi possível salvar.';status.style.color='var(--red)'}
}

function aplicarBancaReal(){
  if(typeof window.calcular==='function') window.calcular();
  atualizarTabelaReal();
  const dia=Number(iDia?.value)||1;
  const f=bancoBanca.dias?.[String(dia)];
  const inp=document.getElementById('iFechou');if(inp&&f)inp.value=f.fechou;
}

function atualizarTabelaReal(){
  const table=document.querySelector('table');if(!table)return;
  const head=table.querySelector('thead tr');if(head&&!head.querySelector('.th-fechou')){const th=document.createElement('th');th.className='th-fechou';th.textContent='Fechou real';head.appendChild(th)}
  table.querySelectorAll('tbody tr').forEach((tr,i)=>{let td=tr.querySelector('.td-fechou');if(!td){td=document.createElement('td');td.className='td-fechou';tr.appendChild(td)}const f=bancoBanca.dias?.[String(i+1)];td.innerHTML=f?`<span class="pill pill-green">${moeda(f.fechou)}</span>`:'<span style="color:var(--muted)">—</span>'});
}

window.addEventListener('DOMContentLoaded',async()=>{
  criarPainelFechamento();
  const original=window.calcular;
  if(typeof original==='function')window.calcular=function(){original();setTimeout(atualizarTabelaReal,0)};
  await carregarBanco();
  ['iMeta','iStop'].forEach(id=>document.getElementById(id)?.addEventListener('change',salvarConfig));
});