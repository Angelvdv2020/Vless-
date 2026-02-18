import { Router } from 'express';
import { supabase, requireAuth } from '../supabase.js';
import { logger } from '../logger.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(notifications || []);
  } catch (err) {
    logger.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Ошибка загрузки уведомлений' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !notification) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    res.json(notification);
  } catch (err) {
    logger.error('Error fetching notification:', err);
    res.status(500).json({ error: 'Ошибка загрузки уведомления' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Ошибка удаления уведомления' });
  }
});

router.post('/mark-read/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Ошибка обновления уведомления' });
  }
});

async function sendNotificationToUser(userId, type, data = {}) {
  try {
    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      logger.warn(`No active template found for type: ${type}`);
      return;
    }

    const message = interpolateTemplate(template.message, data);
    const title = interpolateTemplate(template.subject, data);

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
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
          user_id: userId,
          type,
          message,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent',
        });
    }

    return !error;
  } catch (err) {
    logger.error(`Error sending notification to user ${userId}:`, err);
    return false;
  }
}

function interpolateTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

export { sendNotificationToUser, interpolateTemplate };
export default router;
