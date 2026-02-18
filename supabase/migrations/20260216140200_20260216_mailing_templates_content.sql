/*
  # Mailing Templates with Content and Media

  1. Default Mailing Templates
    - Welcome email (welcome)
    - Subscription expiry warning (expiry_warning)
    - Trial period ending (trial_ending)
    - Special discount offer (discount_offer)
    - Return inactive user (return_offer)
    - Feature announcement (feature_announcement)
    - Payment reminder (payment_reminder)

  2. Features
    - Ready-to-use HTML templates
    - Support for images and GIFs
    - Variable interpolation
    - Mobile responsive design
    - Professional styling
*/

INSERT INTO mailing_templates (name, description, segment, subject, html_content, image_url, gif_url, variables, is_active)
VALUES
  (
    'Приветственное письмо',
    'Отправляется новым пользователям после регистрации',
    'all',
    'Добро пожаловать в NoryxVPN! 🎉',
    '<html><body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">Добро пожаловать, {{username}}! 🎉</h1>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Спасибо, что выбрали NoryxVPN. Мы рады приветствовать вас в нашем сообществе быстрого и безопасного интернета.
  </p>
  <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
    <h3 style="color: #2c3e50;">Начните работу за 3 простых шага:</h3>
    <ol style="color: #555; font-size: 14px;">
      <li>Перейдите в личный кабинет</li>
      <li>Выберите подходящий тариф</li>
      <li>Подключитесь к VPN за 2 минуты</li>
    </ol>
  </div>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    <strong>Бонус:</strong> Используйте пробный период на 3 дня, чтобы полностью ознакомиться с сервисом.
  </p>
  <a href="https://noryx-vpn.com/cabinet" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Открыть личный кабинет</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Если у вас есть вопросы, пишите нам в поддержку: support@noryx-vpn.com
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/325153/pexels-photo-325153.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username"]'::jsonb,
    true
  ),
  (
    'Предупреждение об истечении подписки',
    'Отправляется за 24 часа до истечения подписки',
    'with_subscription',
    'Ваша подписка {{tariff_name}} заканчивается завтра! ⏰',
    '<html><body style="font-family: Arial, sans-serif; background-color: #fff3cd; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #ff9800;">
  <h1 style="color: #ff6b00; margin-bottom: 20px;">⏰ Внимание! Подписка заканчивается завтра</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">
    Привет, {{username}}!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Ваша подписка на тариф <strong>{{tariff_name}}</strong> истекает <strong>{{expiry_date}} в {{expiry_time}}</strong>.
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Продлите подписку прямо сейчас, чтобы не потерять доступ к высокоскоростному VPN!
  </p>
  <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="color: #555; margin: 0;">
      <strong>Текущий тариф:</strong> {{tariff_name}}<br/>
      <strong>Дата истечения:</strong> {{expiry_date}} {{expiry_time}}<br/>
      <strong>Статус:</strong> Активна
    </p>
  </div>
  <a href="https://noryx-vpn.com/cabinet" style="display: inline-block; background-color: #ff9800; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Продлить подписку</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Не требуется действие, если вы уже продлили подписку.
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/574077/pexels-photo-574077.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username", "tariff_name", "expiry_date", "expiry_time"]'::jsonb,
    true
  ),
  (
    'Пробный период заканчивается',
    'Отправляется при окончании пробного периода',
    'trial',
    'Твой пробный период заканчивается! Переходи на подписку 🚀',
    '<html><body style="font-family: Arial, sans-serif; background-color: #e8f4f8; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #17a2b8;">
  <h1 style="color: #17a2b8; margin-bottom: 20px;">🚀 Пора переходить на полную подписку!</h1>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Привет, {{username}}!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Ты использовал свой бесплатный пробный период. Надеемся, что VPN сервис тебе понравился!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Переходи на полную подписку и получи доступ к:
  </p>
  <ul style="color: #555; font-size: 15px;">
    <li>✓ Все серверы по всему миру</li>
    <li>✓ Безлимитный трафик</li>
    <li>✓ Скорость до 1 Гбит/с</li>
    <li>✓ 24/7 поддержка</li>
    <li>✓ Несколько одновременных подключений</li>
  </ul>
  <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <h4 style="color: #17a2b8; margin-top: 0;">Специальное предложение!</h4>
    <p style="color: #555; margin: 10px 0;">Первый месяц со скидкой 20% - используй код <strong>WELCOME20</strong></p>
  </div>
  <a href="https://noryx-vpn.com/tariffs" style="display: inline-block; background-color: #17a2b8; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Выбрать тариф</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Вопросы? Напиши нам: support@noryx-vpn.com
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/6475476/pexels-photo-6475476.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username"]'::jsonb,
    true
  ),
  (
    'Спецпредложение для неактивных пользователей',
    'Отправляется пользователям без активной подписки',
    'without_subscription',
    'Спецпредложение! Скидка {{discount}}% на все тарифы 🎁',
    '<html><body style="font-family: Arial, sans-serif; background-color: #fce4ec; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #e91e63;">
  <h1 style="color: #e91e63; margin-bottom: 20px;">🎁 Специальная скидка только для тебя!</h1>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Привет, {{username}}!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Мы заметили, что ты уходил. Поэтому приготовили для тебя эксклюзивное предложение:
  </p>
  <div style="background-color: #fce4ec; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
    <p style="color: #e91e63; font-size: 32px; font-weight: bold; margin: 0;">{{discount}}% СКИДКА</p>
    <p style="color: #555; font-size: 14px; margin: 10px 0;">На любой тариф! Действительно до {{expire_date}}</p>
  </div>
  <p style="color: #555; font-size: 15px;">
    <strong>Что получишь при подписке:</strong>
  </p>
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
    <p style="color: #555; margin: 8px 0;">🌍 500+ VPN серверов по всему миру</p>
    <p style="color: #555; margin: 8px 0;">⚡ Скорость до 1 Гбит/с</p>
    <p style="color: #555; margin: 8px 0;">🔒 Банковский уровень шифрования</p>
    <p style="color: #555; margin: 8px 0;">📱 Работает на всех устройствах</p>
  </div>
  <a href="https://noryx-vpn.com/tariffs" style="display: inline-block; background-color: #e91e63; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Активировать скидку</a>
  <p style="color: #555; font-size: 13px;">
    Код скидки: <strong style="font-family: monospace; background-color: #f0f0f0; padding: 5px 10px; border-radius: 3px;">{{discount_code}}</strong>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Срок действия скидки ограничен! Не пропусти выгодное предложение.
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/3808519/pexels-photo-3808519.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username", "discount", "expire_date", "discount_code"]'::jsonb,
    true
  ),
  (
    'Анонс новой функции',
    'Анонс новых возможностей сервиса',
    'all',
    'Новая функция в NoryxVPN! Теперь еще лучше 🌟',
    '<html><body style="font-family: Arial, sans-serif; background-color: #f0f9ff; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #0099ff;">
  <h1 style="color: #0099ff; margin-bottom: 20px;">🌟 Новое в NoryxVPN!</h1>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Привет, {{username}}!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Мы постоянно работаем над улучшением сервиса и рады представить новую функцию:
  </p>
  <div style="background-color: #f0f9ff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #0099ff;">
    <h3 style="color: #0099ff; margin-top: 0;">Выбор региона автоматически</h3>
    <p style="color: #555; font-size: 15px; line-height: 1.6;">
      Система автоматически выбирает оптимальный сервер для быстрого подключения. Просто включи VPN - и всё будет работать!
    </p>
  </div>
  <p style="color: #555; font-size: 15px;">
    <strong>Преимущества:</strong>
  </p>
  <ul style="color: #555; font-size: 14px;">
    <li>⚡ Максимальная скорость</li>
    <li>🎯 Оптимальное соединение</li>
    <li>🔄 Автоматическое переключение</li>
    <li>📍 Выбор региона вручную если нужно</li>
  </ul>
  <a href="https://noryx-vpn.com/cabinet" style="display: inline-block; background-color: #0099ff; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Попробовать сейчас</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Это лишь начало! Следите за обновлениями.
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/733857/pexels-photo-733857.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username"]'::jsonb,
    true
  ),
  (
    'Платёж успешно принят',
    'Потверждение после успешного платежа',
    'all',
    'Спасибо за оплату! 💳',
    '<html><body style="font-family: Arial, sans-serif; background-color: #e8f5e9; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #4caf50;">
  <h1 style="color: #4caf50; margin-bottom: 20px;">✓ Платёж принят!</h1>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Спасибо, {{username}}!
  </p>
  <p style="color: #555; font-size: 16px; line-height: 1.6;">
    Ваш платёж был успешно обработан. Подписка активирована!
  </p>
  <div style="background-color: #f1f1f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="color: #555; margin: 8px 0;"><strong>Тариф:</strong> {{tariff_name}}</p>
    <p style="color: #555; margin: 8px 0;"><strong>Сумма:</strong> {{amount}} {{currency}}</p>
    <p style="color: #555; margin: 8px 0;"><strong>Дата активации:</strong> {{activation_date}}</p>
    <p style="color: #555; margin: 8px 0;"><strong>Истекает:</strong> {{expiry_date}}</p>
  </div>
  <p style="color: #555; font-size: 15px;">
    Вы можете скачать VPN приложение и начать пользоваться сервисом прямо сейчас!
  </p>
  <a href="https://noryx-vpn.com/apps" style="display: inline-block; background-color: #4caf50; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Загрузить приложение</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">
    Необходимо воспользоваться поддержкой? Отправьте письмо на support@noryx-vpn.com
  </p>
</div>
</body></html>',
    'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg?auto=compress&cs=tinysrgb&w=600',
    '',
    '["username", "tariff_name", "amount", "currency", "activation_date", "expiry_date"]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;
