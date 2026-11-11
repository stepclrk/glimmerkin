GK.form(document.getElementById('signin'), async (fields) => {
  if (!fields.username || !fields.password) return 'Type your username and your password.';
  const res = await GK.api('POST', '/api/signin', { username: fields.username.trim(), password: fields.password });
  if (!res.ok) return res.data.message || 'Signing in did not work. Try again.';
  // A one-time password has to be replaced before anything else.
  location.assign(res.data.mustChangePassword ? '/account' : '/play');
});
