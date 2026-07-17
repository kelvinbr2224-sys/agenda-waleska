// ========== CONFIGURAÇÃO FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyCTmSo1Cc_hchf2uZ4kHNtg4uN_Ukd7wgM",
  authDomain: "estetica-3dd35.firebaseapp.com",
  projectId: "estetica-3dd35",
  storageBucket: "estetica-3dd35.appspot.com",
  messagingSenderId: "883952047883",
  appId: "1:883952047883:web:d38e504ec5f77ff9dd340e",
  measurementId: "G-96DVR3DZ5D"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========== SENHA OFUSCADA ==========
const SENHA = String.fromCharCode(119, 97, 108, 101, 115, 107, 97, 50, 48, 50, 54);
const SENHA_DOMINGO = String.fromCharCode(100, 111, 109, 105, 110, 103, 111);

// ========== DADOS DO ESTÚDIO ==========
const CHAVE_PIX = "59591030000162";
const NOME_PIX = "Syanne Waleska Gomes dos Santos";

// ===== URL DA PÁGINA DE PAGAMENTO =====
const URL_PAGAMENTO = "https://kelvinbr2224-sys.github.io/agenda-waleska/pagamento.html";

// ========== FUNÇÃO PARA SABER SE O SERVIÇO COBRA SINAL ==========
function servicoCobraSinal(nomeServico) {
  if (!nomeServico) return false;
  const nomeLower = nomeServico.toLowerCase();
  if (nomeLower.includes('manutenção') || nomeLower.includes('manutencao')) {
    return false;
  }
  return true;
}

// ========== PREÇOS PADRÃO ==========
let precos = JSON.parse(localStorage.getItem('precosStudio')) || {};

if (Object.keys(precos).length === 0) {
  const servicosPadrao = [
    'Cílios', 'Manutenção', 'Volume Brasileiro',
    'Design', 'Micropigmentação Sobrancelha', 'Micropigmentação Labial',
    'Manutenção Fio a Fio', 'Manutenção Híbrido',
    'Manutenção Brasileiro e Egípcio', 'Manutenção Russo e Luxo',
    'Manutenção Fox e Sirena', 'Efeito Molhado'
  ];
  servicosPadrao.forEach(nome => {
    const preco = {
      'Cílios': 120, 'Manutenção': 80, 'Volume Brasileiro': 150,
      'Design': 40, 'Micropigmentação Sobrancelha': 450,
      'Micropigmentação Labial': 550, 'Manutenção Fio a Fio': 85,
      'Manutenção Híbrido': 85, 'Manutenção Brasileiro e Egípcio': 90,
      'Manutenção Russo e Luxo': 95, 'Manutenção Fox e Sirena': 95,
      'Efeito Molhado': 75
    }[nome] || 0;
    precos[nome] = { preco, cobraSinal: servicoCobraSinal(nome) };
  });
} else {
  for (let serv in precos) {
    if (typeof precos[serv] === 'number') {
      const preco = precos[serv];
      precos[serv] = { preco, cobraSinal: servicoCobraSinal(serv) };
    } else if (typeof precos[serv] === 'object' && precos[serv].preco !== undefined) {
      precos[serv].cobraSinal = servicoCobraSinal(serv);
    }
  }
}

// ========== VARIÁVEIS GLOBAIS ==========
let agendamentos = {};
let gastos = [];
let clientes = {};

try {
  const parsed = JSON.parse(localStorage.getItem('gastosStudio'));
  gastos = Array.isArray(parsed) ? parsed : [];
} catch(e) { gastos = []; }

try {
  const parsedClientes = JSON.parse(localStorage.getItem('clientesStudio'));
  if (parsedClientes) {
    const primeiroId = Object.keys(parsedClientes)[0];
    if (primeiroId && typeof parsedClientes[primeiroId] === 'object') {
      clientes = parsedClientes;
      for (let id in clientes) {
        if (clientes[id].visitas === undefined) clientes[id].visitas = 0;
      }
    } else {
      for (let nome in parsedClientes) {
        const telefone = parsedClientes[nome];
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        clientes[id] = { nome, telefone, emoji: '', visitas: 0, observacoes: '' };
      }
      localStorage.setItem('clientesStudio', JSON.stringify(clientes));
    }
  }
} catch(e) { clientes = {}; }

let dataAtual = new Date();
let domingoLiberado = false;

// ========== FORÇAR LIMPEZA DE CACHE ==========
window.addEventListener('pageshow', function(event) {
  if (event.persisted) location.reload();
});

// ========== VERIFICAÇÃO DE SENHA ==========
function verificarSenha() {
  if (sessionStorage.getItem('acessoStudio') === 'ok') return true;

  const body = document.body;
  const tela = document.createElement('div');
  tela.className = 'tela-bloqueio';
  tela.id = 'telaBloqueio';
  tela.innerHTML = `
    <div class="caixa-senha">
      <h1>Studio Waleska</h1>
      <input type="password" id="inputSenha" placeholder="Digite a senha" onkeypress="if(event.key==='Enter') entrar()">
      <button onclick="entrar()">Entrar</button>
    </div>
  `;
  body.innerHTML = '';
  body.appendChild(tela);

  window.entrar = function() {
    const senha = document.getElementById('inputSenha').value;
    if (senha === SENHA) {
      sessionStorage.setItem('acessoStudio', 'ok');
      location.reload();
    } else {
      alert("Senha incorreta!");
    }
  };

  return false;
}

if (!verificarSenha()) {
  if (sessionStorage.getItem('acessoStudio') !== 'ok') {
    throw new Error("Acesso negado");
  }
}

// ========== ELEMENTOS DOM ==========
const calendar = document.getElementById("calendar");
const modal = document.getElementById("modal");
const inputNome = document.getElementById("nome");
const inputTelefone = document.getElementById("telefone");
const inputEmoji = document.getElementById("clienteEmoji");
const inputData = document.getElementById("data");
const inputHora = document.getElementById("hora");
const selectServico = document.getElementById("servico");
const mesAtualEl = document.getElementById("mesAtual");
const datalistClientes = document.getElementById("sugestoesClientes");

// ========== PREENCHER SERVIÇOS ==========
function atualizarSelectServicos() {
  selectServico.innerHTML = '<option value="">Selecione o serviço</option>';
  Object.keys(precos).sort().forEach(s => {
    let preco = 0;
    let cobraSinal = false;
    if (typeof precos[s] === 'number') {
      preco = precos[s];
      cobraSinal = servicoCobraSinal(s);
    } else if (typeof precos[s] === 'object' && precos[s].preco !== undefined) {
      preco = precos[s].preco;
      cobraSinal = precos[s].cobraSinal || false;
    }
    const sinalTexto = cobraSinal ? ' 🔐' : '';
    selectServico.innerHTML += `<option value="${s}">${s} - R$ ${preco.toFixed(2)}${sinalTexto}</option>`;
  });
}
atualizarSelectServicos();

// ========== SISTEMA DE CLIENTES COM VISITAS ==========
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function salvarClientes() {
  localStorage.setItem('clientesStudio', JSON.stringify(clientes));
}

function atualizarDatalistClientes() {
  datalistClientes.innerHTML = '';
  for (let id in clientes) {
    const c = clientes[id];
    const option = document.createElement('option');
    const emojiDisplay = c.emoji ? c.emoji + ' ' : '';
    option.value = c.nome;
    option.dataset.id = id;
    option.dataset.telefone = c.telefone;
    option.dataset.emoji = c.emoji || '';
    option.dataset.visitas = c.visitas || 0;
    option.textContent = `${emojiDisplay}${c.nome} (${c.telefone}) - ${c.visitas || 0} visitas`;
    datalistClientes.appendChild(option);
  }
}
atualizarDatalistClientes();

function buscarClientePorNome(nome) {
  for (let id in clientes) {
    if (clientes[id].nome === nome) return id;
  }
  return null;
}

function adicionarOuAtualizarCliente(nome, telefone, emoji = '') {
  if (!nome || !telefone) return null;

  for (let id in clientes) {
    if (clientes[id].telefone === telefone) {
      let atualizado = false;
      if (clientes[id].nome !== nome) { clientes[id].nome = nome; atualizado = true; }
      if (clientes[id].emoji !== emoji) { clientes[id].emoji = emoji; atualizado = true; }
      if (atualizado) { salvarClientes(); atualizarDatalistClientes(); }
      return id;
    }
  }

  const idExistente = buscarClientePorNome(nome);
  if (idExistente) {
    const clienteAtual = clientes[idExistente];
    if (clienteAtual.telefone !== telefone) {
      const resposta = confirm(
        `A cliente "${nome}" já existe com o telefone ${clienteAtual.telefone}.\nDeseja atualizar para o novo número (${telefone})?`
      );
      if (resposta) {
        clienteAtual.telefone = telefone;
        if (emoji) clienteAtual.emoji = emoji;
        salvarClientes();
        atualizarDatalistClientes();
        return idExistente;
      } else {
        alert('Para criar um novo cadastro, use um nome diferente (ex: adicione sobrenome ou iniciais).');
        return null;
      }
    }
    if (emoji && clienteAtual.emoji !== emoji) {
      clienteAtual.emoji = emoji;
      salvarClientes();
      atualizarDatalistClientes();
    }
    return idExistente;
  }

  const novoId = gerarId();
  clientes[novoId] = { nome, telefone, emoji: emoji || '', visitas: 0, observacoes: '' };
  salvarClientes();
  atualizarDatalistClientes();
  return novoId;
}

function incrementarVisitas(clienteId) {
  if (clienteId && clientes[clienteId]) {
    clientes[clienteId].visitas = (clientes[clienteId].visitas || 0) + 1;
    salvarClientes();
    atualizarDatalistClientes();
  }
}

inputNome.addEventListener('input', function() {
  const nome = this.value.trim();
  const id = buscarClientePorNome(nome);
  if (id) {
    inputTelefone.value = clientes[id].telefone;
    inputEmoji.value = clientes[id].emoji || '';
  }
});

inputTelefone.addEventListener('input', function() {
  const telefone = this.value.trim();
  if (telefone) {
    for (let id in clientes) {
      if (clientes[id].telefone === telefone) {
        inputNome.value = clientes[id].nome;
        inputEmoji.value = clientes[id].emoji || '';
        break;
      }
    }
  }
});

// ========== HORÁRIO MANUAL ==========
document.addEventListener('DOMContentLoaded', function() {
  const selectHora = document.getElementById('hora');
  selectHora.addEventListener('change', function() {
    if (this.value === 'manual') {
      const horaManual = prompt('Digite o horário (formato HH:MM):', '14:30');
      if (horaManual && /^\d{2}:\d{2}$/.test(horaManual)) {
        let existente = this.querySelector(`option[value="${horaManual}"]`);
        if (existente) { existente.selected = true; return; }
        const option = document.createElement('option');
        option.value = horaManual;
        option.textContent = `🕐 ${horaManual} (manual)`;
        option.selected = true;
        option.style.background = '#d4af37';
        option.style.color = '#fff';
        this.appendChild(option);
      } else {
        this.value = '';
        if (horaManual !== null) alert('⚠️ Formato inválido! Use HH:MM (ex: 14:30)');
      }
    }
  });
});

criarModalVisualizacao();
carregarNuvem();

document.addEventListener('click', function() {
  document.querySelectorAll('[id^="menuZap_"]').forEach(menu => menu.style.display = 'none');
});

// ========== FIREBASE ==========
async function carregarNuvem() {
  try {
    const doc = await db.collection('agenda').doc('waleska').get();
    if (doc.exists) {
      const data = doc.data();
      agendamentos = data.dados || {};
      if (data.precos) {
        precos = data.precos;
        for (let serv in precos) {
          if (typeof precos[serv] === 'number') {
            const preco = precos[serv];
            precos[serv] = { preco, cobraSinal: servicoCobraSinal(serv) };
          } else if (typeof precos[serv] === 'object' && precos[serv].preco !== undefined) {
            precos[serv].cobraSinal = servicoCobraSinal(serv);
          }
        }
        atualizarSelectServicos();
      }
      if (data.gastos) gastos = Array.isArray(data.gastos) ? data.gastos : [];
      if (data.clientes) {
        const primeiroId = Object.keys(data.clientes)[0];
        if (primeiroId && typeof data.clientes[primeiroId] === 'object') {
          clientes = data.clientes;
          for (let id in clientes) {
            if (clientes[id].visitas === undefined) clientes[id].visitas = 0;
          }
        } else {
          for (let nome in data.clientes) {
            const telefone = data.clientes[nome];
            const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            clientes[id] = { nome, telefone, emoji: '', visitas: 0, observacoes: '' };
          }
        }
        salvarClientes();
        atualizarDatalistClientes();
      }
    }
    gerarCalendario();
  } catch(e) {
    agendamentos = JSON.parse(localStorage.getItem('agendamentosStudio')) || {};
    gerarCalendario();
  }
}

async function salvarNuvem() {
  try {
    await db.collection('agenda').doc('waleska').set({
      dados: agendamentos,
      precos: precos,
      gastos: gastos,
      clientes: clientes,
      atualizado: new Date()
    });
    localStorage.setItem('agendamentosStudio', JSON.stringify(agendamentos));
    localStorage.setItem('precosStudio', JSON.stringify(precos));
    localStorage.setItem('gastosStudio', JSON.stringify(gastos));
    salvarClientes();
  } catch(e) {
    localStorage.setItem('agendamentosStudio', JSON.stringify(agendamentos));
    localStorage.setItem('precosStudio', JSON.stringify(precos));
    localStorage.setItem('gastosStudio', JSON.stringify(gastos));
    salvarClientes();
  }
}

// ========== CALENDÁRIO ==========
function gerarCalendario() {
  calendar.innerHTML = '';
  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  mesAtualEl.innerText = `${meses[mes]} ${ano}`;
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => {
    const div = document.createElement("div");
    div.className = "dia-semana";
    div.innerText = d;
    calendar.appendChild(div);
  });
  const hoje = new Date();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  for (let i = 0; i < primeiroDia; i++) {
    const v = document.createElement("div");
    v.className = "day vazio";
    calendar.appendChild(v);
  }
  for (let i = 1; i <= ultimoDia; i++) {
    const divDia = document.createElement("div");
    divDia.className = "day";
    const dataCompleta = `${ano}-${String(mes+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
    const diaSemana = new Date(ano, mes, i).getDay();
    if (hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === i) divDia.classList.add("hoje");
    if (diaSemana === 0) divDia.style.background = '#ffe6e6';
    divDia.innerHTML = `<strong>${i}</strong>`;
    if (agendamentos[dataCompleta]) {
      agendamentos[dataCompleta].forEach(ag => {
        const agDiv = document.createElement("div");
        agDiv.className = "agendamento-item";
        if (ag.sinalPago) agDiv.style.background = '#4caf50';
        const emojiDisplay = ag.emoji ? ag.emoji + ' ' : '';
        agDiv.innerText = `${emojiDisplay}${ag.hora} ${ag.nome.substring(0,8)}`;
        divDia.appendChild(agDiv);
      });
    }
    divDia.onclick = () => abrirListaDia(dataCompleta, i, mes + 1, ano, diaSemana);
    calendar.appendChild(divDia);
  }
}

function mesAnterior(){ dataAtual.setMonth(dataAtual.getMonth()-1); gerarCalendario(); }
function mesProximo(){ dataAtual.setMonth(dataAtual.getMonth()+1); gerarCalendario(); }

// ========== LISTA DO DIA ==========
function abrirListaDia(data, dia, mes, ano, diaSemana) {
  if (diaSemana === 0 && !domingoLiberado) {
    const senha = prompt("Domingo bloqueado! Senha:");
    if (senha === SENHA_DOMINGO) {
      domingoLiberado = true;
    } else {
      alert("Senha incorreta!");
      return;
    }
  }
  const modalLista = document.getElementById("modalLista");
  document.getElementById("tituloLista").innerText = `📅 ${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;
  const conteudo = document.getElementById("conteudoLista");
  conteudo.innerHTML = '';
  if (agendamentos[data]) {
    agendamentos[data].forEach((ag, idx) => {
      let preco = 0;
      let sinal = 0;
      if (typeof precos[ag.servico] === 'number') {
        preco = precos[ag.servico];
        sinal = servicoCobraSinal(ag.servico) ? (preco * 0.3) : 0;
      } else if (typeof precos[ag.servico] === 'object' && precos[ag.servico].preco !== undefined) {
        preco = precos[ag.servico].preco;
        sinal = (precos[ag.servico].cobraSinal && servicoCobraSinal(ag.servico)) ? (preco * 0.3) : 0;
      }
      const emojiDisplay = ag.emoji ? ag.emoji + ' ' : '';
      conteudo.innerHTML += `
        <div style="padding:12px;background:#f9f9f9;margin:8px 0;border-radius:8px;border-left:4px solid ${ag.sinalPago ? '#4caf50' : '#d4af37'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;">
              <strong style="font-size:16px;">⏰ ${ag.hora}</strong> - <strong>${emojiDisplay}${ag.nome}</strong>
              <br><small style="color:#666;">💇‍♀️ ${ag.servico} - R$ ${preco.toFixed(2)}</small>
              ${sinal > 0 ? `<br><small style="color:${ag.sinalPago ? '#4caf50' : '#ff9800'};font-weight:bold;">💰 Sinal: R$ ${sinal.toFixed(2)} ${ag.sinalPago ? '✅ Pago' : '⏳ Pendente'}</small>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="position:relative;">
                <button onclick="toggleMenuWhatsapp(event, '${data}', ${idx})" style="background:#25d366;color:white;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;" title="Opções WhatsApp">
                  📱
                </button>
                <div id="menuZap_${data}_${idx}" style="display:none;position:absolute;right:0;top:45px;background:white;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.2);z-index:10;min-width:200px;overflow:hidden;">
                  <button onclick="enviarWhatsAppIndividual('${data}',${idx}); fecharMenuZap('${data}',${idx})" style="width:100%;padding:12px 15px;border:none;background:white;cursor:pointer;text-align:left;font-size:14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #eee;">
                    📱 Enviar WhatsApp
                  </button>
                  <button onclick="copiarMensagemWhatsApp('${data}',${idx}); fecharMenuZap('${data}',${idx})" style="width:100%;padding:12px 15px;border:none;background:white;cursor:pointer;text-align:left;font-size:14px;display:flex;align-items:center;gap:8px;">
                    📋 Copiar mensagem
                  </button>
                </div>
              </div>
              ${sinal > 0 ? `<button onclick="toggleSinal('${data}',${idx})" style="background:${ag.sinalPago ? '#4caf50' : '#ff9800'};color:white;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:18px;" title="${ag.sinalPago ? 'Sinal Pago' : 'Marcar como Pago'}">${ag.sinalPago ? '✅' : '💰'}</button>` : ''}
              <button onclick="deletarAgendamento('${data}',${idx})" style="background:#c0392b;color:white;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:18px;" title="Excluir">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    conteudo.innerHTML += '<p style="text-align:center;padding:30px;color:#999;">📭 Nenhum agendamento para este dia</p>';
  }
  conteudo.innerHTML += `<button onclick="abrirModalAgendamento('${data}')" style="width:100%;padding:14px;background:#d4af37;color:#fff;border:none;border-radius:8px;margin-top:10px;font-size:16px;font-weight:bold;cursor:pointer;">+ Novo Agendamento</button>`;
  modalLista.style.display = "flex";
}

function abrirModalAgendamento(data){
  fecharLista();
  modal.style.display = "flex";
  inputData.value = data;
}
function fechar(){ modal.style.display = "none"; }
function fecharLista(){ document.getElementById("modalLista").style.display = "none"; }

// ========== WHATSAPP ==========
function enviarWhatsApp(nome, tel, data, hora, servico) {
  const [a, m, d] = data.split('-');
  const telLimpo = tel.replace(/\D/g, '');
  let preco = 0;
  let sinal = 0;
  
  if (typeof precos[servico] === 'number') {
    preco = precos[servico];
    sinal = servicoCobraSinal(servico) ? (preco * 0.3) : 0;
  } else if (typeof precos[servico] === 'object' && precos[servico].preco !== undefined) {
    preco = precos[servico].preco;
    sinal = (precos[servico].cobraSinal && servicoCobraSinal(servico)) ? (preco * 0.3) : 0;
  }

  const valorFormatado = sinal.toFixed(2);
  const linkPagamento = `${URL_PAGAMENTO}?valor=${valorFormatado}&cliente=${encodeURIComponent(nome)}`;

  let msg = `⭐ *Studio Waleska* ⭐\n\n`;
  msg += `Olá *${nome}*!\n\n`;
  msg += `Seu agendamento foi confirmado:\n\n`;
  msg += `📅 *Data:* ${d}/${m}/${a}\n`;
  msg += `⏰ *Horário:* ${hora}\n`;
  msg += `💇‍♀️ *Serviço:* ${servico}\n`;

  if (preco > 0) msg += `💰 *Valor total:* R$ ${preco.toFixed(2)}\n`;

  if (sinal > 0) {
    msg += `\n🔒 *Sinal de 30%:* R$ ${sinal.toFixed(2)}\n`;
    // ENDEREÇO REMOVIDO
    msg += `\n💳 *Pagamento do sinal (clique no link abaixo):*\n`;
    msg += ` ${linkPagamento}\n`;
    msg += `\n*Copie o link acima ou clique nele para acessar a página de pagamento.*\n`;
  }

  msg += `\n📍 *Studio Waleska - Joinville*\n`;
  msg += `\nQualquer dúvida, estou à disposição! ❤️`;

  window.open(`https://wa.me/55${telLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
}

function enviarWhatsAppIndividual(data, idx) {
  const ag = agendamentos[data][idx];
  enviarWhatsApp(ag.nome, ag.telefone, data, ag.hora, ag.servico);
}

// ========== COPIAR MENSAGEM ==========
function copiarMensagemWhatsApp(data, idx) {
  const ag = agendamentos[data][idx];
  const [a, m, d] = data.split('-');
  let preco = 0;
  let sinal = 0;
  
  if (typeof precos[ag.servico] === 'number') {
    preco = precos[ag.servico];
    sinal = servicoCobraSinal(ag.servico) ? (preco * 0.3) : 0;
  } else if (typeof precos[ag.servico] === 'object' && precos[ag.servico].preco !== undefined) {
    preco = precos[ag.servico].preco;
    sinal = (precos[ag.servico].cobraSinal && servicoCobraSinal(ag.servico)) ? (preco * 0.3) : 0;
  }

  const valorFormatado = sinal.toFixed(2);
  const linkPagamento = `${URL_PAGAMENTO}?valor=${valorFormatado}&cliente=${encodeURIComponent(ag.nome)}`;

  let msg = `⭐ *Studio Waleska* ⭐\n\n`;
  msg += `Olá *${ag.nome}*!\n\n`;
  msg += `Seu agendamento foi confirmado:\n\n`;
  msg += `📅 *Data:* ${d}/${m}/${a}\n`;
  msg += `⏰ *Horário:* ${ag.hora}\n`;
  msg += `💇‍♀️ *Serviço:* ${ag.servico}\n`;

  if (preco > 0) msg += `💰 *Valor total:* R$ ${preco.toFixed(2)}\n`;

  if (sinal > 0) {
    msg += `\n🔒 *Sinal de 30%:* R$ ${sinal.toFixed(2)}\n`;
    msg += `\n💳 *Pagamento do sinal (clique no link abaixo):*\n`;
    msg += ` ${linkPagamento}\n`;
    msg += `\n*Copie o link acima ou clique nele para acessar a página de pagamento.*\n`;
  }

  msg += `\n📍 *Studio Waleska - Joinville*\n`;
  msg += `\nQualquer dúvida, estou à disposição! ❤️`;

  navigator.clipboard.writeText(msg).then(() => {
    alert('✅ Mensagem copiada! Cole no WhatsApp da cliente.');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = msg;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('✅ Mensagem copiada! Cole no WhatsApp da cliente.');
  });
}

// ========== SALVAR AGENDAMENTO ==========
async function salvar(){
  const nome = inputNome.value.trim();
  const tel = inputTelefone.value.trim();
  const emoji = inputEmoji.value.trim();
  const data = inputData.value;
  const hora = inputHora.value;
  const serv = selectServico.value;
  if (!nome || !tel || !data || !hora || !serv) return alert("⚠️ Preencha todos os campos!");

  const clienteId = adicionarOuAtualizarCliente(nome, tel, emoji);
  if (!clienteId) {
    const idExistente = buscarClientePorNome(nome);
    if (idExistente && clientes[idExistente].telefone !== tel) {
      return;
    }
  }

  if (clienteId) {
    incrementarVisitas(clienteId);
  } else {
    const id = buscarClientePorNome(nome);
    if (id) incrementarVisitas(id);
  }

  const agora = new Date();
  const dataHoraAgendamento = new Date(data + 'T' + hora + ':00');
  if (dataHoraAgendamento < agora) {
    alert("⚠️ Não é possível agendar em um horário que já passou!");
    return;
  }

  if (agendamentos[data]) {
    const duplicado = agendamentos[data].some(ag => ag.hora === hora);
    if (duplicado) {
      alert("⚠️ Já existe um agendamento neste horário!");
      return;
    }
  }

  if (!agendamentos[data]) agendamentos[data] = [];
  agendamentos[data].push({
    nome,
    telefone: tel,
    emoji: emoji,
    clienteId: clienteId || null,
    hora,
    servico: serv,
    id: Date.now(),
    sinalPago: false,
    dataCriacao: new Date().toISOString()
  });
  agendamentos[data].sort((a, b) => a.hora.localeCompare(b.hora));
  await salvarNuvem();

  if (document.getElementById('enviarZap').checked) {
    enviarWhatsApp(nome, tel, data, hora, serv);
  }
  gerarCalendario();
  fechar();
  alert("✅ Agendamento salvo com sucesso!");
}

async function deletarAgendamento(data, idx){
  if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;
  agendamentos[data].splice(idx,1);
  if (agendamentos[data].length === 0) delete agendamentos[data];
  await salvarNuvem();
  gerarCalendario();
  fecharLista();
}

function criarModalVisualizacao(){
  const m = document.createElement("div");
  m.id = "modalLista";
  m.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;width:90%;max-width:500px;max-height:80vh;overflow-y:auto;">
      <h3 id="tituloLista" style="color:#d4af37;text-align:center;font-family:'Dancing Script',cursive;font-size:24px;"></h3>
      <div id="conteudoLista"></div>
      <button onclick="fecharLista()" style="width:100%;padding:12px;background:#999;color:#fff;border:none;border-radius:6px;margin-top:15px;cursor:pointer;">Fechar</button>
    </div>
  `;
  m.style.cssText = "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);justify-content:center;align-items:center;z-index:1001;";
  document.body.appendChild(m);
}

// ========== MENU WHATSAPP ==========
function toggleMenuWhatsapp(event, data, idx) {
  event.stopPropagation();
  document.querySelectorAll('[id^="menuZap_"]').forEach(menu => menu.style.display = 'none');
  const menu = document.getElementById(`menuZap_${data}_${idx}`);
  if (menu.style.display === 'none') menu.style.display = 'block';
  else menu.style.display = 'none';
}

function fecharMenuZap(data, idx) {
  const menu = document.getElementById(`menuZap_${data}_${idx}`);
  if (menu) menu.style.display = 'none';
}

function toggleSinal(data, idx) {
  const agendamento = agendamentos[data][idx];
  agendamento.sinalPago = !agendamento.sinalPago;
  salvarNuvem();
  gerarCalendario();
  const [ano, mes, dia] = data.split('-').map(Number);
  abrirListaDia(data, dia, mes, ano, new Date(ano, mes - 1, dia).getDay());
}

// ========== ADICIONAR SERVIÇO MANUAL ==========
window.adicionarServicoManual = function() {
  const nome = document.getElementById('novoServicoNome').value.trim();
  const preco = parseFloat(document.getElementById('novoServicoPreco').value);
  const cobraSinal = servicoCobraSinal(nome);

  if (!nome || isNaN(preco) || preco <= 0) {
    alert('⚠️ Preencha nome e preço válidos.');
    return;
  }
  if (precos[nome]) {
    alert('⚠️ Este serviço já existe. Edite o valor diretamente na lista.');
    return;
  }
  precos[nome] = { preco, cobraSinal };
  salvarNuvem();
  atualizarSelectServicos();
  document.getElementById('novoServicoNome').value = '';
  document.getElementById('novoServicoPreco').value = '';
  document.getElementById('novoServicoSinal').checked = cobraSinal;
  alert('✅ Serviço adicionado com sucesso!');
  abrirFinanceiro();
};

// ========== EDITAR SERVIÇO ==========
window.editarServico = function(nomeAntigo) {
  const info = precos[nomeAntigo];
  if (!info) return;
  let precoAtual = typeof info === 'number' ? info : info.preco;
  const cobraSinalAtual = typeof info === 'number' ? servicoCobraSinal(nomeAntigo) : info.cobraSinal;

  const novoNome = prompt('Novo nome para o serviço:', nomeAntigo);
  if (novoNome === null || novoNome.trim() === '') return;
  const nomeLimpo = novoNome.trim();

  if (nomeLimpo !== nomeAntigo && precos[nomeLimpo]) {
    alert('⚠️ Já existe um serviço com este nome.');
    return;
  }

  const novoPreco = parseFloat(prompt('Novo preço (R$):', precoAtual));
  if (isNaN(novoPreco) || novoPreco <= 0) {
    alert('Preço inválido.');
    return;
  }

  const sugestaoSinal = servicoCobraSinal(nomeLimpo) ? 'sim' : 'não';
  const cobraSinalStr = prompt(`Cobrar sinal de 30%? (Digite "sim" ou "não")`, sugestaoSinal);
  if (cobraSinalStr === null) return;
  const cobraSinal = cobraSinalStr.toLowerCase() === 'sim';

  if (nomeLimpo !== nomeAntigo) {
    delete precos[nomeAntigo];
  }
  precos[nomeLimpo] = { preco: novoPreco, cobraSinal };

  Object.keys(agendamentos).forEach(data => {
    agendamentos[data].forEach(ag => {
      if (ag.servico === nomeAntigo) {
        ag.servico = nomeLimpo;
      }
    });
  });

  salvarNuvem();
  atualizarSelectServicos();
  abrirFinanceiro();
  gerarCalendario();
  alert('✅ Serviço atualizado com sucesso!');
};

// ========== ALTERNAR SINAL ==========
window.toggleSinalServico = function(servico) {
  if (!precos[servico]) return;
  if (typeof precos[servico] === 'number') {
    const preco = precos[servico];
    precos[servico] = { preco, cobraSinal: !servicoCobraSinal(servico) };
  } else if (typeof precos[servico] === 'object') {
    precos[servico].cobraSinal = !precos[servico].cobraSinal;
  }
  salvarNuvem();
  atualizarSelectServicos();
  abrirFinanceiro();
  const status = precos[servico].cobraSinal ? 'ativado' : 'desativado';
  alert(`✅ Sinal para "${servico}" ${status}!`);
};

// ========== EXCLUIR SERVIÇO ==========
window.excluirServico = function(nome) {
  let emUso = false;
  Object.keys(agendamentos).forEach(data => {
    agendamentos[data].forEach(ag => {
      if (ag.servico === nome) emUso = true;
    });
  });

  if (emUso) {
    if (!confirm(`⚠️ Este serviço está sendo usado em agendamentos. Excluir mesmo assim? Os agendamentos serão mantidos mas o serviço ficará sem nome.`)) return;
  } else {
    if (!confirm(`Tem certeza que deseja excluir o serviço "${nome}"?`)) return;
  }

  delete precos[nome];

  Object.keys(agendamentos).forEach(data => {
    agendamentos[data].forEach(ag => {
      if (ag.servico === nome) {
        ag.servico = '(excluído)';
      }
    });
  });

  salvarNuvem();
  atualizarSelectServicos();
  abrirFinanceiro();
  gerarCalendario();
  alert('🗑️ Serviço excluído.');
};

// ========== RECALCULAR VISITAS ==========
function recalcularVisitas() {
  for (let data in agendamentos) {
    agendamentos[data].forEach(ag => {
      if (!buscarClientePorNome(ag.nome)) {
        const id = gerarId();
        clientes[id] = {
          nome: ag.nome,
          telefone: ag.telefone || '',
          emoji: ag.emoji || '',
          visitas: 0,
          observacoes: ''
        };
      }
    });
  }

  for (let id in clientes) {
    clientes[id].visitas = 0;
  }

  for (let data in agendamentos) {
    agendamentos[data].forEach(ag => {
      const id = buscarClientePorNome(ag.nome);
      if (id) {
        clientes[id].visitas = (clientes[id].visitas || 0) + 1;
      }
    });
  }

  salvarClientes();
  atualizarDatalistClientes();
}

// ========== EDITAR VISITAS ==========
window.editarVisitas = function(clienteId) {
  if (!clientes[clienteId]) return;
  const novoValor = prompt(`Quantas visitas para "${clientes[clienteId].nome}"?`, clientes[clienteId].visitas || 0);
  if (novoValor === null) return;
  const numero = parseInt(novoValor);
  if (isNaN(numero) || numero < 0) {
    alert('Digite um número válido (0 ou mais).');
    return;
  }
  clientes[clienteId].visitas = numero;
  salvarClientes();
  atualizarDatalistClientes();
  abrirFidelidade();
};

// ========== ABRIR FIDELIDADE ==========
window.abrirFidelidade = function() {
  recalcularVisitas();

  const modalFidelidade = document.getElementById("modalFidelidade");
  const listaClientes = document.getElementById("listaClientesFidelidade");
  
  if (!modalFidelidade) {
    console.error("Modal de fidelidade não encontrado!");
    return;
  }

  let html = '';
  const listaArray = Object.keys(clientes).map(id => ({ id, ...clientes[id] }));
  listaArray.sort((a, b) => (b.visitas || 0) - (a.visitas || 0));

  if (listaArray.length === 0) {
    html = '<p style="color:#999;text-align:center;padding:20px;">Nenhuma cliente cadastrada ainda.</p>';
  } else {
    listaArray.forEach(c => {
      const emojiDisplay = c.emoji ? c.emoji + ' ' : '';
      const estrelas = c.visitas >= 10 ? '⭐' : (c.visitas >= 5 ? '🌟' : '');
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f9f9f9;margin:6px 0;border-radius:8px;flex-wrap:wrap;border-left:4px solid ${c.visitas >= 10 ? '#d4af37' : (c.visitas >= 5 ? '#2196F3' : '#ddd')};">
          <span style="flex:2;font-size:15px;font-weight:500;">${emojiDisplay}${c.nome}</span>
          <span style="flex:1;font-size:14px;color:#666;">${c.telefone}</span>
          <span style="flex:1;font-size:15px;font-weight:bold;color:#d4af37;text-align:right;">${estrelas} ${c.visitas || 0} visitas</span>
          <button onclick="window.editarVisitas('${c.id}')" style="background:#2196F3;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">✏️ Editar</button>
        </div>
      `;
    });
  }
  listaClientes.innerHTML = html;
  modalFidelidade.style.display = "flex";
};

window.fecharFidelidade = function() {
  document.getElementById("modalFidelidade").style.display = "none";
};

// ========== PAINEL FINANCEIRO ==========
window.abrirFinanceiro = function() {
  if (!Array.isArray(gastos)) gastos = [];
  const modalFinanceiro = document.getElementById("modalFinanceiro");
  const resumoFinanceiro = document.getElementById("resumoFinanceiro");
  const tabelaPrecos = document.getElementById("tabelaPrecos");
  const listaGastos = document.getElementById("listaGastos");
  const mes = dataAtual.getMonth();
  const ano = dataAtual.getFullYear();
  let faturamentoMes = 0, totalSinais = 0;
  Object.keys(agendamentos).forEach(data => {
    const [a, m] = data.split('-').map(Number);
    if (m - 1 === mes && a === ano) {
      agendamentos[data].forEach(ag => {
        let preco = 0;
        let cobraSinal = false;
        if (typeof precos[ag.servico] === 'number') {
          preco = precos[ag.servico];
          cobraSinal = servicoCobraSinal(ag.servico);
        } else if (typeof precos[ag.servico] === 'object' && precos[ag.servico].preco !== undefined) {
          preco = precos[ag.servico].preco;
          cobraSinal = precos[ag.servico].cobraSinal && servicoCobraSinal(ag.servico);
        }
        faturamentoMes += preco;
        if (ag.sinalPago && cobraSinal) {
          totalSinais += preco * 0.3;
        }
      });
    }
  });
  const totalSaidas = gastos.filter(g => g && g.tipo === 'saida').reduce((s, g) => s + (g.valor || 0), 0);
  const saldo = totalSinais - totalSaidas;
  resumoFinanceiro.innerHTML = `
    <div style="background:#e3f2fd;padding:12px;border-radius:8px;text-align:center;"><strong style="color:#1976d2;">Faturamento</strong><p style="font-size:18px;font-weight:bold;margin-top:5px;">R$ ${faturamentoMes.toFixed(2)}</p></div>
    <div style="background:#e8f5e9;padding:12px;border-radius:8px;text-align:center;"><strong style="color:#388e3c;">Sinais</strong><p style="font-size:18px;font-weight:bold;margin-top:5px;">R$ ${totalSinais.toFixed(2)}</p></div>
    <div style="background:#fbe9e7;padding:12px;border-radius:8px;text-align:center;"><strong style="color:#d32f2f;">Saídas</strong><p style="font-size:18px;font-weight:bold;margin-top:5px;">R$ ${totalSaidas.toFixed(2)}</p></div>
    <div style="background:${saldo >= 0 ? '#e8f5e9' : '#fbe9e7'};padding:12px;border-radius:8px;text-align:center;"><strong style="color:${saldo >= 0 ? '#388e3c' : '#d32f2f'};">Saldo</strong><p style="font-size:18px;font-weight:bold;margin-top:5px;">R$ ${saldo.toFixed(2)}</p></div>
  `;

  let htmlPrecos = '';
  Object.keys(precos).sort().forEach(function(serv) {
    let preco = 0;
    let cobraSinal = false;
    if (typeof precos[serv] === 'number') {
      preco = precos[serv];
      cobraSinal = servicoCobraSinal(serv);
    } else if (typeof precos[serv] === 'object' && precos[serv].preco !== undefined) {
      preco = precos[serv].preco;
      cobraSinal = precos[serv].cobraSinal && servicoCobraSinal(serv);
    }
    const sinalIcon = cobraSinal ? ' 🔐' : '';
    htmlPrecos += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #eee;gap:6px;flex-wrap:wrap;background:#fafafa;margin-bottom:4px;border-radius:4px;">
      <span style="flex:2;font-size:14px;font-weight:500;min-width:120px;">${serv}${sinalIcon}</span>
      <input type="number" id="preco_${serv.replace(/\s+/g,'_')}" value="${preco}" step="0.01" style="width:80px;padding:6px;border:1px solid #ddd;border-radius:6px;text-align:right;">
      <button onclick="window.atualizarPreco('${serv}')" style="background:#d4af37;color:white;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">💾 Salvar</button>
      <button onclick="window.editarServico('${serv}')" style="background:#2196F3;color:white;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">✏️ Editar</button>
      <button onclick="window.toggleSinalServico('${serv}')" style="background:#9C27B0;color:white;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">${cobraSinal ? '🔐 Desativar' : '🔓 Ativar'}</button>
      <button onclick="window.excluirServico('${serv}')" style="background:#c0392b;color:white;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">🗑️ Excluir</button>
    </div>`;
  });
  tabelaPrecos.innerHTML = htmlPrecos;

  if (gastos.length > 0) {
    let gastosHTML = '';
    gastos.slice().reverse().forEach(function(g, index) {
      const realIndex = gastos.length - 1 - index;
      gastosHTML += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f5f5f5;margin:5px 0;border-radius:6px;flex-wrap:wrap;">
        <span style="flex:1;font-size:14px;">${g.descricao || ''} - R$ ${(g.valor || 0).toFixed(2)}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="window.editarGasto(${realIndex})" style="background:#d4af37;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">✏️ Editar</button>
          <button onclick="window.excluirGasto(${realIndex})" style="background:#c0392b;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">🗑️</button>
        </div>
      </div>`;
    });
    listaGastos.innerHTML = gastosHTML;
  } else {
    listaGastos.innerHTML = '<p style="color:#999;text-align:center;">Nenhum gasto registrado</p>';
  }
  modalFinanceiro.style.display = "flex";
};

// ========== EDITAR GASTO ==========
window.editarGasto = function(index) {
  const g = gastos[index];
  if (!g) return;
  const novaDesc = prompt('Nova descrição:', g.descricao);
  if (novaDesc === null) return;
  const novoValor = parseFloat(prompt('Novo valor:', g.valor));
  if (isNaN(novoValor) || novoValor <= 0) {
    alert('Valor inválido.');
    return;
  }
  gastos[index].descricao = novaDesc.trim();
  gastos[index].valor = novoValor;
  salvarNuvem();
  abrirFinanceiro();
};

window.excluirGasto = function(index) {
  if (!confirm('Excluir este gasto?')) return;
  gastos.splice(index, 1);
  salvarNuvem();
  abrirFinanceiro();
};

window.fecharFinanceiro = function() {
  document.getElementById("modalFinanceiro").style.display = "none";
};

window.atualizarPreco = function(servico) {
  const input = document.getElementById('preco_' + servico.replace(/\s+/g,'_'));
  const novoPreco = parseFloat(input.value);
  if (novoPreco && novoPreco > 0) {
    if (typeof precos[servico] === 'number') {
      const preco = precos[servico];
      precos[servico] = { preco, cobraSinal: servicoCobraSinal(servico) };
    }
    precos[servico].preco = novoPreco;
    salvarNuvem();
    atualizarSelectServicos();
    abrirFinanceiro();
    alert('✅ Preço atualizado!');
  }
};

window.adicionarGasto = function() {
  const desc = document.getElementById("gastoDesc").value.trim();
  const valor = parseFloat(document.getElementById("gastoValor").value);
  if (desc && valor > 0) {
    gastos.push({ tipo: 'saida', descricao: desc, valor: valor, data: new Date().toISOString() });
    salvarNuvem();
    document.getElementById("gastoDesc").value = '';
    document.getElementById("gastoValor").value = '';
    abrirFinanceiro();
  } else {
    alert("⚠️ Preencha descrição e valor!");
  }
};
