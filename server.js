const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const baseLikeCount = 128;
const contentKey = 'landing';
const defaultComments = [
  { id: 'sample-1', name: '성수동 카페 사장', text: '식자재 가격이 오른 시점을 자동으로 알려주는 기능이 가장 기대돼요.', time: '오늘 오전 9:42', mine: false },
  { id: 'sample-2', name: '분식집 운영 6년차', text: '거래명세서가 제각각이라 정리하기 힘든데 사진으로 된다면 바로 써보고 싶습니다.', time: '어제 오후 8:15', mine: false }
];

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname)));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : null;

const memory = { likes: new Set(), comments: [] };

async function initDatabase() {
  if (!pool) {
    console.warn('DATABASE_URL이 없어 메모리 저장 모드로 실행합니다. Railway에서는 PostgreSQL을 연결하세요.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(100) NOT NULL,
      name VARCHAR(20) NOT NULL,
      body VARCHAR(300) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS likes (
      id BIGSERIAL PRIMARY KEY,
      content_key VARCHAR(100) NOT NULL DEFAULT 'landing',
      visitor_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (content_key, visitor_id)
    );
  `);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validVisitorId(value) {
  return /^[a-zA-Z0-9_-]{8,100}$/.test(value || '');
}

function formatTime(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}

async function getFeedback(visitorId) {
  if (!pool) {
    const comments = [...memory.comments, ...defaultComments].map(comment => ({
      ...comment,
      mine: comment.visitorId ? comment.visitorId === visitorId : false
    }));
    return {
      likeCount: baseLikeCount + memory.likes.size,
      liked: memory.likes.has(visitorId),
      comments
    };
  }

  const [likes, liked, comments] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM likes WHERE content_key = $1', [contentKey]),
    pool.query('SELECT 1 FROM likes WHERE content_key = $1 AND visitor_id = $2 LIMIT 1', [contentKey, visitorId]),
    pool.query('SELECT id, visitor_id, name, body, created_at FROM comments ORDER BY created_at DESC LIMIT 100')
  ]);

  return {
    likeCount: baseLikeCount + likes.rows[0].count,
    liked: liked.rowCount > 0,
    comments: [
      ...comments.rows.map(row => ({
        id: String(row.id),
        name: row.name,
        text: row.body,
        time: formatTime(row.created_at),
        mine: row.visitor_id === visitorId
      })),
      ...defaultComments
    ]
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: pool ? 'postgres' : 'memory' });
});

app.get('/api/feedback', async (req, res) => {
  const visitorId = cleanText(req.query.visitorId, 100);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  try {
    res.json(await getFeedback(visitorId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '피드백을 불러오지 못했습니다.' });
  }
});

app.post('/api/likes/toggle', async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId, 100);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  try {
    let liked;
    if (!pool) {
      if (memory.likes.has(visitorId)) {
        memory.likes.delete(visitorId);
        liked = false;
      } else {
        memory.likes.add(visitorId);
        liked = true;
      }
    } else {
      const existing = await pool.query('SELECT id FROM likes WHERE content_key = $1 AND visitor_id = $2 LIMIT 1', [contentKey, visitorId]);
      if (existing.rowCount) {
        await pool.query('DELETE FROM likes WHERE id = $1', [existing.rows[0].id]);
        liked = false;
      } else {
        await pool.query('INSERT INTO likes (content_key, visitor_id) VALUES ($1, $2)', [contentKey, visitorId]);
        liked = true;
      }
    }
    const feedback = await getFeedback(visitorId);
    res.json({ liked, likeCount: feedback.likeCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '좋아요를 저장하지 못했습니다.' });
  }
});

app.post('/api/comments', async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId, 100);
  const name = cleanText(req.body?.name, 20) || '익명 사장님';
  const text = cleanText(req.body?.text, 300);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  if (!text) return res.status(400).json({ error: '댓글 내용을 입력해 주세요.' });
  try {
    if (!pool) {
      const comment = { id: `memory-${Date.now()}`, visitorId, name, text, time: '방금 전', mine: true };
      memory.comments.unshift(comment);
      return res.status(201).json(comment);
    }
    const result = await pool.query(
      'INSERT INTO comments (visitor_id, name, body) VALUES ($1, $2, $3) RETURNING id, name, body, created_at',
      [visitorId, name, text]
    );
    const row = result.rows[0];
    res.status(201).json({ id: String(row.id), name: row.name, text: row.body, time: formatTime(row.created_at), mine: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '댓글을 저장하지 못했습니다.' });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId || req.headers['x-visitor-id'], 100);
  const id = cleanText(req.params.id, 30);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  try {
    if (!pool) {
      const before = memory.comments.length;
      memory.comments = memory.comments.filter(comment => !(comment.id === id && comment.visitorId === visitorId));
      return res.json({ deleted: memory.comments.length < before });
    }
    const result = await pool.query('DELETE FROM comments WHERE id = $1 AND visitor_id = $2', [id, visitorId]);
    res.json({ deleted: result.rowCount > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '댓글을 삭제하지 못했습니다.' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDatabase()
  .then(() => app.listen(port, () => console.log(`MarginGuard running on port ${port}`)))
  .catch(error => {
    console.error('데이터베이스 초기화 실패:', error);
    process.exit(1);
  });
