(async () => {
  const $ = (id) => document.getElementById(id), el = GK.el;
  const me = await GK.api('GET', '/api/me');
  if (!me.ok || me.data.role !== 'owner') { location.replace(me.ok ? '/account' : '/signin'); return; }

  const problem = (res) => GK.say($('problem'), res && !res.ok ? (res.data.message || 'That did not work. Try again.') : '');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const link = (label, onclick, danger) => el('button', { class: 'linkish' + (danger ? ' danger' : ''), type: 'button', onclick }, label);

  async function refresh() {
    const [summary, players] = await Promise.all([GK.api('GET', '/api/owner/summary'), GK.api('GET', '/api/owner/players')]);
    if (!summary.ok || !players.ok) { problem(!summary.ok ? summary : players); return; }
    $('summary').textContent = plural(summary.data.players, 'player', 'players') + ' · Last backup ' + (summary.data.lastBackup ? GK.when(summary.data.lastBackup, true).toLowerCase() : 'has not run yet');

    $('players').replaceChildren(...players.data.players.map((p) => {
      const actions = el('td', { class: 'end' });
      const normal = () => actions.replaceChildren(
        link('Reset password', async () => {
          const res = await GK.api('POST', '/api/owner/players/' + p.id + '/reset', {});
          problem(res); if (!res.ok) return;
          $('one-time-title').textContent = 'One-time password for ' + res.data.username;
          $('one-time-password').textContent = res.data.oneTimePassword;
          $('one-time').hidden = false; $('one-time').scrollIntoView({ block: 'nearest' }); refresh();
        }),
        // Removing asks first: it deletes the account, its sessions and its creature.
        p.you ? null : link('Remove', () => actions.replaceChildren(
          el('span', { class: 'small' }, 'Remove ' + p.username + (p.creature ? ' and ' + p.creature : '') + ' for good? '),
          link('Yes, remove', async () => { problem(await GK.api('DELETE', '/api/owner/players/' + p.id)); refresh(); }, true),
          link('Keep', normal),
        ), true),
      );
      normal();
      return el('tr', {},
        el('td', { class: 'strong' }, p.username + (p.you ? ' (you)' : '')),
        el('td', {}, p.creature ? p.creature + ', ' + p.form : 'Not hatched yet'),
        el('td', {}, p.waitingForNewPassword ? 'Waiting to choose a password' : GK.when(p.lastPlayed)),
        actions);
    }));
  }

  $('one-time-copy').addEventListener('click', async (e) => { e.target.textContent = (await GK.copy($('one-time-password').textContent)) ? 'Copied' : 'Select and copy it'; });
  $('one-time-done').addEventListener('click', () => { $('one-time').hidden = true; $('one-time-password').textContent = ''; $('one-time-copy').textContent = 'Copy'; });
  $('signout').addEventListener('click', async () => { const p = await GK.signOut(me.data.id); if (p) GK.say($('problem'), p); });
  refresh();
})();
