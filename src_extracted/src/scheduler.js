import { supabase } from './supabase.js';
import { logger } from './logger.js';

const NOTIFICATION_WINDOWS = {
  subscription_expiry_24h: { hours: 24, exactHours: 23.5 },
  subscription_expiry_10h: { hours: 10, exactHours: 9.5 },
  subscription_expiry_0h: { hours: 0, exactHours: 0 },
  trial_expiry_24h: { hours: 24, exactHours: 23.5 },
  trial_expiry_10h: { hours: 10, exactHours: 9.5 },
  trial_expiry_0h: { hours: 0, exactHours: 0 },
};

export function startScheduler() {
  logger.info('Starting notification scheduler...');

  checkSubscriptionsExpiry();
  setInterval(checkSubscriptionsExpiry, 60 * 60 * 1000);

  processPendingMailings();
  setInterval(processPendingMailings, 5 * 60 * 1000);

  logger.info('Scheduler started');
}

async function checkSubscriptionsExpiry() {
  try {
    logger.debug('Checking subscriptions expiry...');

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*, tariff:tariffs(*), user:profiles(id, email, username)')
      .in('status', ['active', 'trial'])
      .order('expires_at', { ascending: true });

    if (error) {
      logger.error('Error fetching subscriptions:', error);
      return;
    }

    const now = new Date();

    for (const sub of subscriptions || []) {
      const expiryTime = new Date(sub.expires_at);
      const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);

      const notificationType = sub.status === 'trial' ? 'trial_expiry' : 'subscription_expiry';

      if (shouldSendNotification(hoursUntilExpiry, 24)) {
        await sendExpiryNotification(sub, `${notificationType}_24h`, '24 часа');
      } else if (shouldSendNotification(hoursUntilExpiry, 10)) {
        await sendExpiryNotification(sub, `${notificationType}_10h`, '10 часов');
      } else if (shouldSendNotification(hoursUntilExpiry, 0)) {
        await sendExpiryNotification(sub, `${notificationType}_0h`, 'прямо сейчас');
        await markSubscriptionExpired(sub.id);
      }
    }
  } catch (err) {
    logger.error('Error in checkSubscriptionsExpiry:', err);
  }
}

function shouldSendNotification(hoursUntilExpiry, hoursThreshold) {
  const tolerance = 0.5;
  const lowerBound = hoursThreshold - tolerance;
  const upperBound = hoursThreshold + tolerance;
  return hoursUntilExpiry <= upperBound && hoursUntilExpiry >= lowerBound;
}

async function sendExpiryNotification(subscription, notificationType, timeText) {
  try {
    const { data: existing } = await supabase
      .from('notification_history')
      .select('id')
      .eq('user_id', subscription.user.id)
      .eq('type', notificationType)
      .gte('sent_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (existing && existing.length > 0) {
      logger.debug(`Notification ${notificationType} already sent to user ${subscription.user.id}`);
      return;
    }

    const expiryDate = new Date(subscription.expires_at);
    const data = {
      username: subscription.user.username || subscription.user.email.split('@')[0],
      tariff_name: subscription.tariff?.name || 'Подписка',
      expiry_date: expiryDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }),
      expiry_time: expiryDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      time_text: timeText,
    };

    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('type', notificationType)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      logger.warn(`No template found for ${notificationType}`);
      return;
    }

    const message = interpolateTemplate(template.message, data);
    const title = interpolateTemplate(template.subject, data);

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: subscription.user.id,
        type: notificationType,
        title,
        message,
        data: JSON.stringify(data),
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    if (!error) {
      await supabase
        .from('notification_history')
        .insert({
          user_id: subscription.user.id,
          type: notificationType,
          message,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent',
        });

      logger.info(`Sent ${notificationType} notification to ${subscription.user.email}`);
    } else {
      logger.error(`Failed to send notification: ${error.message}`);
    }
  } catch (err) {
    logger.error(`Error sending expiry notification: ${err.message}`);
  }
}

async function markSubscriptionExpired(subscriptionId) {
  try {
    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('id', subscriptionId);

    logger.info(`Marked subscription ${subscriptionId} as expired`);
  } catch (err) {
    logger.error(`Error marking subscription as expired: ${err.message}`);
  }
}

async function processPendingMailings() {
  try {
    const now = new Date();

    const { data: mailings, error } = await supabase
      .from('mailings')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (error) {
      logger.error('Error fetching scheduled mailings:', error);
      return;
    }

    for (const mailing of mailings || []) {
      await sendMailing(mailing);
    }
  } catch (err) {
    logger.error('Error in processPendingMailings:', err);
  }
}

async function sendMailing(mailing) {
  try {
    logger.info(`Processing mailing ${mailing.id}...`);

    await supabase
      .from('mailings')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', mailing.id);

    const { data: template } = await supabase
      .from('mailing_templates')
      .select('*')
      .eq('id', mailing.template_id)
      .maybeSingle();

    if (!template) {
      logger.warn(`Template not found for mailing ${mailing.id}`);
      return;
    }

    const recipients = await getSegmentRecipients(mailing.segment, mailing.filter_conditions);

    let sent = 0;
    let failed = 0;

    for (const user of recipients) {
      try {
        const html = renderTemplate(template.html_content, user);

        await supabase.from('mailing_history').insert({
          mailing_id: mailing.id,
          user_id: user.id,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent',
        });

        sent++;
      } catch (e) {
        logger.error(`Failed to send mailing to ${user.email}:`, e.message);
        failed++;
      }
    }

    await supabase
      .from('mailings')
      .update({
        status: 'sent',
        completed_at: new Date().toISOString(),
        sent_count: sent,
        failed_count: failed,
      })
      .eq('id', mailing.id);

    logger.info(`Mailing ${mailing.id} completed. Sent: ${sent}, Failed: ${failed}`);
  } catch (err) {
    logger.error(`Error sending mailing: ${err.message}`);

    await supabase
      .from('mailings')
      .update({ status: 'paused' })
      .eq('id', mailing.id);
  }
}

async function getSegmentRecipients(segment, filters = {}) {
  try {
    let query = supabase.from('profiles').select('id, email, username');

    switch (segment) {
      case 'with_subscription':
        const { data: withSub } = await supabase
          .from('profiles')
          .select('id, email, username')
          .in(
            'id',
            supabase
              .from('subscriptions')
              .select('user_id')
              .eq('status', 'active')
          );
        return withSub || [];

      case 'without_subscription':
        const { data: withoutSub } = await supabase
          .from('profiles')
          .select('id, email, username')
          .not(
            'id',
            'in',
            `(${supabase.from('subscriptions').select('user_id').eq('status', 'active')})`
          );
        return withoutSub || [];

      case 'trial':
        const { data: trial } = await query.eq('trial_used', true);
        return trial || [];

      case 'inactive':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: inactive } = await query.lt('updated_at', thirtyDaysAgo.toISOString());
        return inactive || [];

      default:
        const { data: all } = await query.limit(100000);
        return all || [];
    }
  } catch (err) {
    logger.error('Error getting segment recipients:', err);
    return [];
  }
}

function interpolateTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

function renderTemplate(template, user) {
  let result = template;
  result = result.replace(/{{username}}/g, user.username || user.email.split('@')[0]);
  result = result.replace(/{{email}}/g, user.email || '');
  result = result.replace(/{{user_id}}/g, user.id || '');
  return result;
}
