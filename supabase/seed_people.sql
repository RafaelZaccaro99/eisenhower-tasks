DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'rafaelfernandozaccaro@gmail.com';

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: rafaelfernandozaccaro@gmail.com — faça login no app primeiro';
  END IF;

  -- Desabilita trigger para preservar o user_id explícito
  ALTER TABLE people DISABLE TRIGGER set_user_id_people;

  INSERT INTO people (name, "slackId", user_id) VALUES
    ('Fellipe Mengue',         'U0AS6LJRK4M', uid),
    ('Caio Pazin',             'U0ASDJYUB0U', uid),
    ('Samuel Almeida',         'U0ASML1HUKV', uid),
    ('Rafael Habermann',       'U0ASN8ZH623', uid),
    ('Raphael Zappacosta',     'U0ASZ41JFNU', uid),
    ('Tainá Roberta',          'U0AT0ARJ9GV', uid),
    ('Larissa Rosa',           'U0AT5KR3KQC', uid),
    ('Alessandro de Moraes',   'U0ATWABN2N4', uid),
    ('Júlia Sousa',            'U0AUGLJJ3AA', uid),
    ('Alexandre Martins',      'U0AV3MQ009Z', uid),
    ('Caio Lucchiari',         'U0B2K4N33SR', uid),
    ('Thiago Correa',          'U0B2X7XDYTH', uid),
    ('Arthur Santos',          'U0B39A1P1AR', uid),
    ('Giovani Luis',           'U0B3AKCLZDL', uid),
    ('Murilo Cozar',           'U0B3TV17DQS', uid),
    ('Lais Pazin',             'U0B4YFWU08P', uid),
    ('Leonardo Correa',        'U0B4ZSGHJSJ', uid),
    ('Rafael Ferretti Senice', 'U0B57JAJB7V', uid),
    ('Guilherme Correa',       'U0B57JB6H99', uid),
    ('Gabriella Jacobucci',    'U0B57JCHNHH', uid),
    ('Vitor Souza',            'U0B57JEC76F', uid),
    ('Bruno Souza',            'U0B5AHVS18D', uid),
    ('Bruno Zenatte',          'U0B5AJ0PDRB', uid),
    ('Tiago Ferrara (1)',      'U0B5BT1G9FG', uid),
    ('Bruna Magalhaes',        'U0B5BT6P5TQ', uid),
    ('Tiago Ferrara (2)',      'U0B5BT6TNNA', uid),
    ('Rafael Zaccaro',         'U0B5DV62H9Q', uid),
    ('Diego Henrique',         'U0B5DV755GS', uid),
    ('Pedro Bernegossi',       'U0B5FQB12D7', uid),
    ('Rian Zaccariotto',       'U0B5FQBPQ57', uid),
    ('Priscila Da Roz',        'U0B5HHRQT28', uid),
    ('Jacqueline Henkel',      'U0B5HHSNFMJ', uid),
    ('Leo Tischer',            'U0B5HHT81GU', uid),
    ('Claudinéia Santos',      'U0B5HHU5D44', uid),
    ('Larissa Silva',          'U0B6887MWTS', uid),
    ('Controladoria',          'U0B6G3RJ9QV', uid),
    ('Lucas Generoso',         'U0B72FE155E', uid),
    ('Brenda Shimamura',       'U0B7CJG81PX', uid),
    ('Jurídico',               'U0B7DPCP2N4', uid),
    ('Matheus Gonçalves',      'U0B7QGC5DCM', uid),
    ('Breno Cosmo',            'U0B7RRR8A8N', uid),
    ('Murilo Lucas',           'U0B8A92AWTA', uid),
    ('Angélica Malaman',       'U0B8ETRV1KM', uid),
    ('Isabela',                'U0B8N4NM7F1', uid),
    ('André Andolphi',         'U0B8PG0L873', uid),
    ('Victor Hugo',            'U0B8QQ28N12', uid),
    ('Gil Gomes',              'U0B9K63FQTG', uid),
    ('Isaac Araujo',           'U0B9V890A2J', uid),
    ('Gabriel Pazin',          'U0BCQFHC4AU', uid),
    ('Ícaro Camillo',          'U0BDN6J6WTC', uid)
  ON CONFLICT DO NOTHING;

  -- Reabilita trigger
  ALTER TABLE people ENABLE TRIGGER set_user_id_people;

  RAISE NOTICE 'Cadastro concluído: 50 pessoas inseridas para %', uid;
END $$;
