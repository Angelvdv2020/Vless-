import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { data: tariffs, error } = await supabase
      .from('tariffs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(tariffs || []);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки тарифов' });
  }
});

export default router;
