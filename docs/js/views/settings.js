import { api, session } from '../api.js';
import { esc, icon, localDate, openModal, pageHead, toast, confirmBox } from '../ui.js';

export async function render() {
  const [{ name }, { hasPin }] = await Promise.all([api.profile(), api.authStatus()]);
  return `
    ${pageHead({
      eyebrow: 'Sistema • <b>Preferências</b>', title: 'Configurações & Dados',
      sub: 'Perfil da família, segurança de acesso, importação e backup do seu banco de dados.',
    })}
    <div class="grid cols-2">
      <div class="card">
        <div class="card-head"><div class="card-title">Perfil</div></div>
        <form id="profile-form">
          <div class="field"><label>Nome da família / titular</label><input name="name" required maxlength="40" value="${esc(name)}"></div>
          <button class="btn primary" type="submit">Salvar perfil</button>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">Bloqueio de Tela</div>
          <span class="badge ${hasPin ? 'green' : 'amber'}">${hasPin ? 'PIN ativo' : 'Sem PIN'}</span></div>
        <div class="setting-row">
          <small>${hasPin ? 'O app pede o PIN ao abrir e quando você clica no cadeado.' : 'Proteja seus dados financeiros com um PIN de 4 a 8 dígitos.'}</small>
          <div class="row-btns">
            <button class="btn" data-pin>${hasPin ? 'Alterar PIN' : 'Definir PIN'}</button>
            ${hasPin ? '<button class="btn danger" data-pin-remove>Remover PIN</button>' : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="section-head"><h2>Dados</h2></div>
    <div class="card">
      <div class="setting-row">
        <div><strong>Importar extrato bancário (CSV)</strong><small>Formato: data;descrição;valor — valores negativos viram despesas e positivos viram receitas.</small></div>
        <div class="row-btns"><button class="btn" data-import>${icon('upload')}Importar extrato</button></div>
      </div>
      <div class="setting-row">
        <div><strong>Exportar todos os lançamentos</strong><small>Planilha CSV compatível com Excel e Google Sheets.</small></div>
        <div class="row-btns"><button class="btn" data-csv>${icon('download')}Exportar CSV</button></div>
      </div>
      <div class="setting-row">
        <div><strong>Backup do banco de dados</strong><small>Baixe uma cópia completa (categorias, lançamentos e metas) ou restaure a partir de um backup. A restauração substitui os dados atuais.</small></div>
        <div class="row-btns">
          <button class="btn" data-backup>${icon('download')}Baixar backup</button>
          <button class="btn danger" data-restore>${icon('upload')}Restaurar backup</button>
          <input type="file" id="restore-file" accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="setting-row">
        <div><strong>Começar do zero</strong><small>Apaga todos os lançamentos e metas, inclusive os dados de exemplo. Categorias, perfil e PIN são mantidos.</small></div>
        <div class="row-btns"><button class="btn danger" data-clear>Apagar lançamentos e metas</button></div>
      </div>
    </div>
    <div class="card" style="margin-top:var(--gap)">
      <div class="callout">
        <span class="icon-tile tone-indigo">${icon('lock')}</span>
        <div><strong>Seus dados ficam só neste navegador</strong>
          <p>O FinHub não envia nada para servidores: tudo é guardado no armazenamento local deste aparelho. Limpar os dados do navegador apaga as finanças, então baixe um backup com frequência. O PIN é um bloqueio de tela e não criptografa os dados.</p></div>
      </div>
    </div>`;
}

const pinField = (id, label) => `<div class="field"><label>${label}</label><input type="password" name="${id}" inputmode="numeric" maxlength="8" autocomplete="off" required></div>`;

export function bind(root, state, refresh) {
  root.querySelector('#profile-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.saveProfile(new FormData(e.target).get('name'));
      toast('Perfil atualizado');
      await state.reloadShell();
    } catch (ex) { toast(ex.message, 'err'); }
  };

  const hasPin = !!root.querySelector('[data-pin-remove]');
  root.querySelector('[data-pin]').onclick = () => openModal({
    title: hasPin ? 'Alterar PIN' : 'Definir PIN',
    body: `${hasPin ? pinField('current', 'PIN atual') : ''}${pinField('pin', 'Novo PIN (4 a 8 dígitos)')}${pinField('confirm', 'Confirmar novo PIN')}`,
    onSubmit: async (f) => {
      if (f.pin !== f.confirm) throw new Error('A confirmação não confere');
      const { token } = await api.setPin(f.pin, f.current);
      session.set(token);
      toast('PIN salvo');
      await state.reloadShell();
      refresh();
    },
  });
  root.querySelector('[data-pin-remove]')?.addEventListener('click', () => openModal({
    title: 'Remover PIN', submitLabel: 'Remover', body: pinField('current', 'Digite o PIN atual para confirmar'),
    onSubmit: async (f) => { await api.removePin(f.current); session.set(null); toast('PIN removido'); await state.reloadShell(); refresh(); },
  }));

  root.querySelector('[data-csv]').onclick = () => api.downloadCsv('').catch((e) => toast(e.message, 'err'));

  root.querySelector('[data-import]').onclick = async () => {
    const cats = (await api.categories(state.month)).filter((c) => c.type === 'expense');
    const form = openModal({
      title: 'Importar extrato', wide: true, submitLabel: 'Importar',
      body: `
        <div class="field"><label>Arquivo CSV</label><input type="file" name="file" accept=".csv,text/csv,text/plain"><small>Ou cole o conteúdo abaixo.</small></div>
        <div class="field"><label>Conteúdo</label><textarea name="csv" placeholder="data;descrição;valor&#10;05/${localDate().slice(5, 7)}/${localDate().slice(0, 4)};Mercado Bom Preço;-152,90&#10;..."></textarea></div>
        <div class="field"><label>Categoria padrão das despesas (opcional)</label>
          <select name="categoryId"><option value="">Sem categoria</option>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>`,
      onSubmit: async (f) => {
        const res = await api.importStatement(f.csv, f.categoryId || null);
        toast(`${res.imported} lançamento(s) importado(s)${res.skipped ? `, ${res.skipped} ignorado(s)` : ''}`);
      },
    });
    form.file.onchange = async () => { if (form.file.files[0]) form.csv.value = await form.file.files[0].text(); };
  };

  root.querySelector('[data-backup]').onclick = async () => {
    try {
      const data = await api.backup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `finhub-backup-${localDate()}.json` });
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast('Backup gerado');
    } catch (e) { toast(e.message, 'err'); }
  };

  root.querySelector('[data-clear]').onclick = async () => {
    if (await confirmBox('Apagar todos os lançamentos e metas? Essa ação não pode ser desfeita (baixe um backup antes).', { confirmLabel: 'Apagar tudo' })) {
      await api.clearData();
      toast('Dados apagados');
    }
  };

  const fileInput = root.querySelector('#restore-file');
  root.querySelector('[data-restore]').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!(await confirmBox('Restaurar este backup? Todos os dados atuais serão substituídos.', { confirmLabel: 'Restaurar' }))) return;
      const res = await api.restore(data);
      toast(`Backup restaurado (${res.transactions} lançamentos)`);
      await state.reloadShell();
      refresh();
    } catch (e) { toast(e instanceof SyntaxError ? 'Arquivo inválido' : e.message, 'err'); }
    fileInput.value = '';
  };
}
