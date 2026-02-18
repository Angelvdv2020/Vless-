import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(articles || []);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки новостей' });
  }
});

export default router;
