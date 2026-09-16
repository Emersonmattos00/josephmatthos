const AUTH_COOKIE = 'jm_auth_access';
const REFRESH_COOKIE = 'jm_auth_refresh';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  };
}

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

async function supabaseRequest(path, options) {
  const config = getConfig();
  if (!config.url || !config.anonKey) {
    const error = new Error('Supabase não configurado.');
    error.code = 'NOT_CONFIGURED';
    throw error;
  }
  const response = await fetch(config.url + path, {
    ...options,
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (error) { body = null; }
  return { response, body };
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (!key) return cookies;
    try { cookies[key] = decodeURIComponent(value); } catch (error) { cookies[key] = ''; }
    return cookies;
  }, {});
}

function getAccessToken(req) {
  const cookies = parseCookies(req.headers && (req.headers.cookie || req.headers.Cookie));
  return cookies[AUTH_COOKIE] || '';
}

function cookie(name, value, maxAge) {
  return name + '=' + encodeURIComponent(value || '') + '; Max-Age=' + maxAge + '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

function setAuthCookies(res, session) {
  res.setHeader('Set-Cookie', [
    cookie(AUTH_COOKIE, session.access_token, COOKIE_MAX_AGE),
    cookie(REFRESH_COOKIE, session.refresh_token, COOKIE_MAX_AGE)
  ]);
}

function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [cookie(AUTH_COOKIE, '', 0), cookie(REFRESH_COOKIE, '', 0)]);
}

async function getAuthUser(req) {
  const accessToken = getAccessToken(req);
  if (!accessToken) return null;
  const result = await supabaseRequest('/auth/v1/user', { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!result.response.ok || !result.body || !result.body.id) return null;
  return result.body;
}

module.exports = {
  clearAuthCookies,
  getAuthUser,
  sendJson,
  setAuthCookies,
  supabaseRequest
};
