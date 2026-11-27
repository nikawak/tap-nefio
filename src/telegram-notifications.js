export const telegramWebhookPath = '/webhooks/telegram-notifications';
export const telegramPairCode = /^[A-Za-z0-9_-]{32,43}$/;

function botOrigin(env) {
  try {
    const url = new URL(env.TAP_PUBLIC_ORIGIN);
    if (url.protocol === 'https:' && url.href === url.origin + '/') return url.origin;
  } catch { /* The provider is optional. */ }
  return '';
}

export function telegramNotificationsReady(env) {
  return !env.DEMO_MODE && !!botOrigin(env) && /^\d{4,}:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN || '') &&
    /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(env.TELEGRAM_BOT_USERNAME || '') &&
    /^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET || '');
}

export const telegramStartLink = (env, type, code) => `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${type}_${code}`;

async function botRequest(env, method, payload = {}) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) return { ok: true, value: data.result };
    return { ok: false, status: Number(data?.error_code) || response.status, retryAfter: Number(data?.parameters?.retry_after) || 0 };
  } catch {
    return { ok: false, status: 0, retryAfter: 0 };
  }
}

export async function configureTelegramWebhook(env) {
  const url = botOrigin(env) + telegramWebhookPath;
  const [bot, webhook] = await Promise.all([botRequest(env, 'getMe'), botRequest(env, 'getWebhookInfo')]);
  if (!bot.ok || !webhook.ok) return 'unavailable';
  if (bot.value?.username?.toLowerCase() !== env.TELEGRAM_BOT_USERNAME.toLowerCase()) return 'username';
  if (webhook.value?.url && webhook.value.url !== url) return 'conflict';
  // Reapply the secret so rotating it in the environment also updates Telegram.
  const saved = await botRequest(env, 'setWebhook', { url, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] });
  return saved.ok ? '' : 'unavailable';
}

async function notificationMessage(env, job, now) {
  const db = env.DB;
  if (job.kind === 'staff_booking' || job.kind === 'staff_feedback') {
    const site = await db.prepare(`SELECT s.slug, s.name, n.staff_chat_id FROM site_notifications n
      JOIN sites s ON s.id=n.site_id WHERE n.site_id=? AND n.staff_chat_id <> ''`).bind(job.site_id).first();
    if (!site) return null;
    const booking = job.kind === 'staff_booking';
    const title = booking ? 'Новая заявка на столик' : 'Новый приватный отзыв';
    const path = booking ? '/admin/bookings' : '/admin/feedback';
    const filters = new URLSearchParams({ site: site.slug, id: job.subject_id });
    return { chat_id: site.staff_chat_id, text: `${title} · ${site.name}\n${botOrigin(env)}${path}?${filters}`,
      link_preview_options: { is_disabled: true } };
  }

  const expected = job.kind === 'guest_reminder' ? 'confirmed' : job.kind.slice('guest_'.length);
  const booking = await db.prepare(`SELECT s.name, b.telegram_chat_id, b.visit_at FROM site_bookings b
    JOIN sites s ON s.id=b.site_id JOIN site_notifications n ON n.site_id=b.site_id
    WHERE b.site_id=? AND b.id=? AND n.guest_enabled=1 AND b.telegram_chat_id <> '' AND b.status=? AND b.visit_at>?`)
    .bind(job.site_id, job.subject_id, expected, now).first();
  if (!booking) return null;
  const heading = {
    guest_confirmed: 'Бронь столика подтверждена', guest_declined: 'Заведение отклонило заявку',
    guest_cancelled: 'Бронь столика отменена', guest_reminder: 'Напоминание о брони столика',
  }[job.kind];
  const when = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Minsk' })
    .format(new Date(booking.visit_at * 1000));
  return { chat_id: booking.telegram_chat_id, text: `${heading} · ${booking.name}\n${when} (Минск)` };
}

export async function deliverTelegramNotifications(env) {
  if (!telegramNotificationsReady(env)) return;
  const db = env.DB;
  const now = () => Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM telegram_notifications WHERE expires_at<=?').bind(now()).run();
  for (let processed = 0; processed < 10; processed++) {
    const time = now();
    const job = await db.prepare(`UPDATE telegram_notifications SET attempts=attempts+1, due_at=?+90
      WHERE rowid=(SELECT rowid FROM telegram_notifications WHERE done=0 AND due_at<=? AND expires_at>?
        ORDER BY due_at, rowid LIMIT 1) RETURNING site_id, subject_id, kind, attempts, expires_at`)
      .bind(time, time, time).first();
    if (!job) return;

    const message = await notificationMessage(env, job, now());
    const result = message ? await botRequest(env, 'sendMessage', message) : { ok: true };
    const retry = !result.ok && (result.status === 0 || result.status === 429 || result.status >= 500) && job.attempts < 5;
    const next = now() + Math.max(30 * 2 ** (job.attempts - 1), result.retryAfter || 0);
    const done = !retry || next >= job.expires_at;
    await db.prepare(`UPDATE telegram_notifications SET done=?, due_at=?
      WHERE site_id=? AND subject_id=? AND kind=? AND attempts=?`)
      .bind(Number(done), next, job.site_id, job.subject_id, job.kind, job.attempts).run();
    if (!result.ok && done) console.warn('Could not deliver Telegram notification', job.kind, result.status);
  }
}
