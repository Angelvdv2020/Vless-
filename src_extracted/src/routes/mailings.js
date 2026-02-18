import { Router } from 'express';
import { supabase, requireAuth, requireAdmin } from '../supabase.js';
import { logger } from '../logger.js';

const router = Router();

router.get('/templates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: templates, error } = await supabase
      .from('mailing_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(templates || []);
  } catch (err) {
    logger.error('Error fetching mailing templates:', err);
    res.status(500).json({ error: 'Ошибка загрузки шаблонов' });
  }
});

router.post('/templates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, segment, subject, html_content, image_url, gif_url, variables, preview_data } = req.body;

    if (!name || !subject || !html_content) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const { data: template, error } = await supabase
      .from('mailing_templates')
      .insert({
        name,
        description,
        segment: segment || 'all',
        subject,
        html_content,
        image_url: image_url || '',
        gif_url: gif_url || '',
        variables: variables || [],
        preview_data: preview_data || {},
        created_by: req.user.id,
      })
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(template);
  } catch (err) {
    logger.error('Error creating mailing template:', err);
    res.status(500).json({ error: 'Ошибка создания шаблона' });
  }
});

router.put('/templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, segment, subject, html_content, image_url, gif_url, variables, preview_data } = req.body;

    const { data: template, error } = await supabase
      .from('mailing_templates')
      .update({
        name,
        description,
        segment: segment || 'all',
        subject,
        html_content,
        image_url: image_url || '',
        gif_url: gif_url || '',
        variables: variables || [],
        preview_data: preview_data || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(template);
  } catch (err) {
    logger.error('Error updating mailing template:', err);
    res.status(500).json({ error: 'Ошибка обновления шаблона' });
  }
});

router.delete('/templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('mailing_templates')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting mailing template:', err);
    res.status(500).json({ error: 'Ошибка удаления шаблона' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: mailings, error } = await supabase
      .from('mailings')
      .select('*, template:mailing_templates(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(mailings || []);
  } catch (err) {
    logger.error('Error fetching mailings:', err);
    res.status(500).json({ error: 'Ошибка загрузки рассылок' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { template_id, segment, scheduled_at, filter_conditions } = req.body;

    if (!template_id || !segment) {
      return res.status(400).json({ error: 'Укажите шаблон и сегмент' });
    }

    const { data: mailing, error } = await supabase
      .from('mailings')
      .insert({
        template_id,
        segment,
        status: scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: scheduled_at || null,
        filter_conditions: filter_conditions || {},
        created_by: req.user.id,
      })
      .select('*, template:mailing_templates(*)')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(mailing);
  } catch (err) {
    logger.error('Error creating mailing:', err);
    res.status(500).json({ error: 'Ошибка создания рассылки' });
  }
});

router.post('/:id/send', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { dry_run } = req.body;

    const { data: mailing, error: mailingErr } = await supabase
      .from('mailings')
      .select('*, template:mailing_templates(*)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (mailingErr || !mailing) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    const recipients = await getSegmentRecipients(mailing.segment, mailing.filter_conditions);

    if (dry_run) {
      return res.json({
        dry_run: true,
        recipient_count: recipients.length,
        sample: recipients.slice(0, 5),
      });
    }

    const { error: updateErr } = await supabase
      .from('mailings')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    let sent = 0;
    let failed = 0;

    for (const user of recipients) {
      try {
        const rendered = renderTemplate(mailing.template.html_content, user);

        await supabase.from('mailing_history').insert({
          mailing_id: req.params.id,
          user_id: user.id,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent',
        });

        sent++;
      } catch (e) {
        logger.error(`Failed to send mailing to user ${user.id}:`, e.message);
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
      .eq('id', req.params.id);

    res.json({
      sent,
      failed,
      total: recipients.length,
    });
  } catch (err) {
    logger.error('Error sending mailing:', err);
    res.status(500).json({ error: 'Ошибка отправки рассылки' });
  }
});

async function getSegmentRecipients(segment, filters = {}) {
  try {
    let query = supabase.from('profiles').select('id, email, username');

    switch (segment) {
      case 'with_subscription':
        query = query.neq('subscriptions', null);
        break;
      case 'without_subscription':
        query = query.is('subscriptions', null);
        break;
      case 'trial':
        query = query.eq('trial_used', true);
        break;
      case 'no_trial':
        query = query.eq('trial_used', false);
        break;
      case 'inactive':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.lt('updated_at', thirtyDaysAgo.toISOString());
        break;
    }

    const { data: profiles, error } = await query.limit(10000);

    if (error) {
      logger.error('Error getting segment recipients:', error);
      return [];
    }

    return profiles || [];
  } catch (err) {
    logger.error('Error in getSegmentRecipients:', err);
    return [];
  }
}

function renderTemplate(template, user) {
  let result = template;
  result = result.replace(/{{username}}/g, user.username || user.email);
  result = result.replace(/{{email}}/g, user.email);
  result = result.replace(/{{user_id}}/g, user.id);
  return result;
}

export default router;
