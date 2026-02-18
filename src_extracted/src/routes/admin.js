import { Router } from 'express';
import { supabase, requireAuth, requireAdmin } from '../supabase.js';
import { logger } from '../logger.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    const { data: userCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { data: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    const { data: totalPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed');

    const { data: mailings } = await supabase
      .from('mailings')
      .select('id', { count: 'exact', head: true });

    const totalRevenue = totalPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    res.json({
      users: userCount?.count || 0,
      activeSubscriptions: activeSubscriptions?.count || 0,
      totalRevenue,
      mailings: mailings?.count || 0,
    });
  } catch (err) {
    logger.error('Error fetching dashboard:', err);
    res.status(500).json({ error: 'Ошибка загрузки панели' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 50;

    const { data: users, count } = await supabase
      .from('profiles')
      .select('id, email, username, created_at, trial_used, balance', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    res.json({
      users,
      page,
      limit,
      total: count,
    });
  } catch (err) {
    logger.error('Error fetching users:', err);
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});

router.get('/users/:id/subscriptions', async (req, res) => {
  try {
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('*, tariff:tariffs(*)')
      .eq('user_id', req.params.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(subs || []);
  } catch (err) {
    logger.error('Error fetching user subscriptions:', err);
    res.status(500).json({ error: 'Ошибка загрузки подписок' });
  }
});

router.post('/users/:id/set-admin', async (req, res) => {
  try {
    const { is_admin } = req.body;

    const { error } = await supabase
      .from('profiles')
      .update({ role: is_admin ? 'admin' : 'user' })
      .eq('id', req.params.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Error setting admin role:', err);
    res.status(500).json({ error: 'Ошибка изменения роли' });
  }
});

router.get('/notifications/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const { data: notifications, error } = await supabase
      .from('notification_history')
      .select('*, user:profiles(id, email, username)')
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(notifications || []);
  } catch (err) {
    logger.error('Error fetching recent notifications:', err);
    res.status(500).json({ error: 'Ошибка загрузки уведомлений' });
  }
});

router.get('/notifications/stats', async (req, res) => {
  try {
    const { data: stats } = await supabase
      .from('notification_history')
      .select('type')
      .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const grouped = {};
    (stats || []).forEach(n => {
      grouped[n.type] = (grouped[n.type] || 0) + 1;
    });

    res.json(grouped);
  } catch (err) {
    logger.error('Error fetching notification stats:', err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

router.get('/mailings/stats', async (req, res) => {
  try {
    const { data: mailings, error } = await supabase
      .from('mailings')
      .select('id, template:mailing_templates(name), status, sent_count, failed_count, created_at');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const stats = {
      total: mailings?.length || 0,
      sent: mailings?.filter(m => m.status === 'sent').length || 0,
      scheduled: mailings?.filter(m => m.status === 'scheduled').length || 0,
      draft: mailings?.filter(m => m.status === 'draft').length || 0,
      totalSent: mailings?.reduce((sum, m) => sum + (m.sent_count || 0), 0) || 0,
      totalFailed: mailings?.reduce((sum, m) => sum + (m.failed_count || 0), 0) || 0,
    };

    res.json(stats);
  } catch (err) {
    logger.error('Error fetching mailing stats:', err);
    res.status(500).json({ error: 'Ошибка загрузки статистики' });
  }
});

router.get('/mailing-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 50;
    const mailingId = req.query.mailing_id;

    let query = supabase
      .from('mailing_history')
      .select('*, user:profiles(email, username)', { count: 'exact' })
      .order('sent_at', { ascending: false });

    if (mailingId) {
      query = query.eq('mailing_id', mailingId);
    }

    const { data, count } = await query
      .range(page * limit, (page + 1) * limit - 1);

    res.json({
      history: data || [],
      page,
      limit,
      total: count,
    });
  } catch (err) {
    logger.error('Error fetching mailing history:', err);
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});

router.post('/template-preview', async (req, res) => {
  try {
    const { html_content } = req.body;

    if (!html_content) {
      return res.status(400).json({ error: 'HTML контент не предоставлен' });
    }

    const previewUser = {
      username: 'Иван',
      email: 'ivan@example.com',
      tariff_name: 'Премиум',
      expiry_date: '15 февраля 2026',
      expiry_time: '12:30',
    };

    let rendered = html_content;
    for (const [key, value] of Object.entries(previewUser)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    res.json({
      preview: rendered,
      sampleData: previewUser,
    });
  } catch (err) {
    logger.error('Error previewing template:', err);
    res.status(500).json({ error: 'Ошибка предпросмотра' });
  }
});

router.post('/send-test-notification', async (req, res) => {
  try {
    const { user_id, template_type } = req.body;

    if (!user_id || !template_type) {
      return res.status(400).json({ error: 'Укажите пользователя и шаблон' });
    }

    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('type', template_type)
      .maybeSingle();

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    const testData = {
      username: 'Тестовый пользователь',
      tariff_name: 'Тестовый тариф',
      expiry_date: new Date().toLocaleDateString('ru-RU'),
      expiry_time: new Date().toLocaleTimeString('ru-RU'),
    };

    const message = interpolateTemplate(template.message, testData);
    const title = interpolateTemplate(template.subject, testData);

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type: template_type,
        title,
        message,
        data: JSON.stringify(testData),
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, message: 'Тестовое уведомление отправлено' });
  } catch (err) {
    logger.error('Error sending test notification:', err);
    res.status(500).json({ error: 'Ошибка отправки тестового уведомления' });
  }
});

function interpolateTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

export default router;
