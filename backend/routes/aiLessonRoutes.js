// backend/routes/aiLessonRoutes.js
import express from 'express';
import axios from 'axios';
import Class from '../models/Class.js';
import { auth } from '../middleware/auth.js';

const aiLessonRouter = express.Router();

// ============================================================
// CONFIG (env-overridable)
// ============================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_PROMPT_CHARS   = 2000;
const MIN_PROMPT_CHARS   = 10;
const REQUEST_TIMEOUT_MS = 30000;

// Rate limit: N generations per user per window
const RATE_LIMIT_MAX     = 10;
const RATE_LIMIT_WINDOW  = 15 * 60 * 1000; // 15 minutes

// ============================================================
// IN-MEMORY RATE LIMITER (per req.user.id)
// Note: per-instance only. Safe on single Render service.
// If you scale to multiple instances, move to Redis.
// ============================================================
const rateBuckets = new Map(); // key: userId string -> { count, resetAt }

function checkRateLimit(userId) {
  const key = String(userId);
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      remaining: 0
    };
  }
  bucket.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count };
}

// ============================================================
// SANITIZATION
// The student view (lesson.js) renders text content raw into the DOM.
// We escape HTML-significant chars in AI output so the AI can never
// inject markup, while preserving newlines for readability.
// ============================================================
function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Strip any control chars except newline and tab
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

// ============================================================
// PROMPT BUILDER
// Uses class context (category, level, learningOutcomes, requirements)
// plus instructor's natural-language prompt.
// ============================================================
function buildPrompt(classData, instructorPrompt, options) {
  const gradeLevel   = (options?.gradeLevel || '').toString().slice(0, 80);
  const depth        = ['short', 'standard', 'detailed'].includes(options?.depth)
                       ? options.depth : 'standard';
  const includeAssess = options?.includeAssessment !== false;

  const classContext = [
    `Class title: ${classData.title || 'Untitled'}`,
    classData.category ? `Subject area: ${classData.category}` : '',
    classData.level    ? `Class level: ${classData.level}` : '',
    classData.shortDescription ? `Class summary: ${classData.shortDescription}` : '',
    classData.learningOutcomes ? `Stated learning outcomes: ${classData.learningOutcomes}` : '',
    classData.requirements     ? `Prerequisites: ${classData.requirements}` : '',
    gradeLevel ? `Target student grade/level: ${gradeLevel}` : ''
  ].filter(Boolean).join('\n');

  const depthGuidance = {
    short:    'Keep explanations concise. Aim for 3-5 content items total.',
    standard: 'Provide clear, thorough explanations. Aim for 5-8 content items.',
    detailed: 'Provide in-depth explanations with examples. Aim for 7-12 content items.'
  }[depth];

  const assessmentGuidance = includeAssess
    ? 'Include a final content item titled "Assessment Questions" containing 5 questions, each with its answer and a brief explanation.'
    : 'Do not include assessment questions.';

  const systemPrompt = `You are an instructional designer for FISSK Online Academy, an e-learning platform.
You write structured lesson drafts in PLAIN TEXT. Never use HTML or Markdown.

${classContext}

Instructor's request:
"""${instructorPrompt}"""

Requirements:
- Language must be clear and appropriate for the stated class level${gradeLevel ? ' and grade ' + gradeLevel : ''}.
- ${depthGuidance}
- ${assessmentGuidance}
- Content items should follow a sensible teaching structure: e.g. Introduction, Learning Objectives, then lesson body sections, Key Terms, Summary.
- Every content item must have a short descriptive title and a plain-text body.
- Use \\n for paragraph breaks. Do not use HTML tags. Do not use markdown symbols like ** or ##.
- Return ONLY the JSON object described by the schema. No prose outside the JSON.`;

  return systemPrompt;
}

// ============================================================
// POST /api/lessons/generate
// ============================================================
aiLessonRouter.post('/generate', auth, async (req, res) => {
  try {
    // ---- 1. Config check ----
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not set');
      return res.status(500).json({
        success: false,
        message: 'AI service is not configured. Please contact support.'
      });
    }

    // ---- 2. Input validation ----
    const { classId, prompt, options } = req.body || {};

    if (!classId || typeof classId !== 'string') {
      return res.status(400).json({ success: false, message: 'classId is required' });
    }
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < MIN_PROMPT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Prompt must be at least ${MIN_PROMPT_CHARS} characters`
      });
    }
    if (trimmedPrompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Prompt must be under ${MAX_PROMPT_CHARS} characters`
      });
    }

    // ---- 3. Class + ownership check (mirrors POST /api/lessons) ----
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
    const userIdStr       = req.user.id ? req.user.id.toString() : '';
    const isInstructor    = instructorIdStr === userIdStr;
    const isAdmin         = req.user.user_type === 'admin';
    if (!isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the class instructor can generate lessons'
      });
    }

    // ---- 4. Rate limit ----
    const rl = checkRateLimit(req.user.id);
    if (!rl.allowed) {
      res.set('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        success: false,
        message: `Rate limit reached. Try again in ${rl.retryAfterSec} seconds.`
      });
    }

    // ---- 5. Build prompt ----
    const promptText = buildPrompt(classData, trimmedPrompt, options || {});

    // ---- 6. Call Gemini (structured JSON) ----
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title:       { type: 'string' },
            description: { type: 'string' },
            contentItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title:   { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['title', 'content']
              }
            }
          },
          required: ['title', 'description', 'contentItems']
        }
      }
    };

    let geminiResponse;
    try {
      geminiResponse = await axios.post(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        requestBody,
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.error?.message || err.message;

      console.error('Gemini API error:', status, detail);

      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return res.status(504).json({
          success: false,
          message: 'AI request timed out. Please try again.'
        });
      }
      if (status === 429) {
        return res.status(429).json({
          success: false,
          message: 'AI service is busy. Please try again in a moment.'
        });
      }
      if (status >= 400 && status < 500) {
        return res.status(502).json({
          success: false,
          message: 'AI request rejected. Please check your prompt and try again.'
        });
      }
      return res.status(502).json({
        success: false,
        message: 'AI service is unavailable. Please try again.'
      });
    }

    // ---- 7. Extract JSON text from Gemini response ----
    const candidate = geminiResponse.data?.candidates?.[0];
    const parts     = candidate?.content?.parts || [];
    const rawText   = parts.map(p => p.text || '').join('');

    if (!rawText) {
      console.error('Gemini returned empty content. Response:', JSON.stringify(geminiResponse.data).slice(0, 500));
      return res.status(502).json({
        success: false,
        message: 'AI returned an empty response. Please try again.'
      });
    }

    // ---- 8. Parse and validate ----
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('AI JSON parse failed. Raw:', rawText.slice(0, 500));
      return res.status(502).json({
        success: false,
        message: 'AI returned invalid content. Please try again.'
      });
    }

    const cleanTitle = sanitizeText(parsed.title).slice(0, 200);
    const cleanDesc  = sanitizeText(parsed.description).slice(0, 2000);
    const rawItems   = Array.isArray(parsed.contentItems) ? parsed.contentItems : [];

    if (!cleanTitle) {
      return res.status(502).json({
        success: false,
        message: 'AI returned incomplete content. Please try again.'
      });
    }
    if (rawItems.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'AI returned no content items. Please try again.'
      });
    }

    const cleanItems = [];
    for (const item of rawItems.slice(0, 20)) {
      const t = sanitizeText(item?.title).slice(0, 200);
      const c = sanitizeText(item?.content).slice(0, 20000);
      if (t && c) {
        cleanItems.push({ type: 'text', title: t, content: c });
      }
    }

    if (cleanItems.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'AI returned no usable content items. Please try again.'
      });
    }

    // ---- 9. Estimated time (matches frontend/backend math) ----
    const totalWords = cleanItems.reduce(
      (sum, it) => sum + it.content.split(/\s+/).filter(Boolean).length,
      0
    );
    const estimatedTime = Math.max(1, Math.ceil(totalWords / 100));

    // ---- 10. Return draft (no DB write) ----
    return res.json({
      success: true,
      draft: {
        title: cleanTitle,
        description: cleanDesc,
        contentItems: cleanItems,
        estimatedTime
      }
    });

  } catch (error) {
    console.error('AI lesson generate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong generating the lesson. Please try again.'
    });
  }
});

export default aiLessonRouter;