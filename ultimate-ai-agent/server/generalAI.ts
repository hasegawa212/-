import { Router } from "express";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const router = Router();

function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function computeMetrics(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?。！？]+/).filter(Boolean).length;
  return {
    wordCount: words,
    sentenceCount: sentences,
    readabilityScore: sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0,
  };
}

// 1. POST /complete - AI Playground completion
router.post("/complete", async (req, res) => {
  try {
    const { messages, model, temperature, maxTokens, topP } = req.body;
    const start = Date.now();

    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens,
      top_p: topP,
    });

    const responseTime = Date.now() - start;
    const choice = completion.choices[0];

    res.json({
      content: choice?.message?.content || "",
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      model: completion.model,
      responseTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Completion failed" });
  }
});

// 2. POST /compare - Multi-model comparison
router.post("/compare", async (req, res) => {
  try {
    const { messages, models, temperature, maxTokens } = req.body;

    const results = await Promise.all(
      models.map(async (model: string) => {
        const start = Date.now();
        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens,
        });
        const responseTime = Date.now() - start;
        const choice = completion.choices[0];

        return {
          model: completion.model,
          content: choice?.message?.content || "",
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
          },
          responseTime,
        };
      })
    );

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Comparison failed" });
  }
});

// 3. POST /prompt-test - Prompt Studio test
router.post("/prompt-test", async (req, res) => {
  try {
    const { template, variables, systemPrompt, model } = req.body;
    const renderedPrompt = renderTemplate(template, variables || {});

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: renderedPrompt });

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages,
    });
    const responseTime = Date.now() - start;

    const content = completion.choices[0]?.message?.content || "";
    const metrics = computeMetrics(content);

    res.json({
      content,
      renderedPrompt,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      responseTime,
      metrics,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Prompt test failed" });
  }
});

// 4. POST /analyze-document - Document analysis
router.post("/analyze-document", async (req, res) => {
  try {
    const { content, action, customQuery, targetLanguage } = req.body;

    const actionPrompts: Record<string, string> = {
      summarize: "Provide a concise summary of the following document:",
      key_points: "Extract the key points from the following document as a bulleted list:",
      action_items: "Extract all action items and tasks from the following document as a list:",
      translate: `Translate the following document into ${targetLanguage || "English"}:`,
      simplify: "Rewrite the following document in simpler, easier-to-understand language:",
      sentiment: "Analyze the sentiment of the following document. Provide the overall sentiment (positive, negative, neutral) and explain why:",
      faq: "Generate a list of frequently asked questions (FAQ) and answers based on the following document:",
      custom: customQuery || "Analyze the following document:",
    };

    const prompt = actionPrompts[action] || actionPrompts.summarize;

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content },
      ],
    });
    const responseTime = Date.now() - start;

    res.json({
      result: completion.choices[0]?.message?.content || "",
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      responseTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Document analysis failed" });
  }
});

// 5. POST /generate-image - Image generation
router.post("/generate-image", async (req, res) => {
  try {
    const { prompt, style, size, quality } = req.body;
    const finalPrompt = style ? `${style} style: ${prompt}` : prompt;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      size: size || "1024x1024",
      quality: quality || "standard",
      n: 1,
    });

    res.json({
      url: response.data[0]?.url || null,
      revisedPrompt: response.data[0]?.revised_prompt || finalPrompt,
    });
  } catch (error: any) {
    res.json({
      url: null,
      revisedPrompt: req.body.prompt,
      mock: true,
    });
  }
});

// 6. POST /enhance-prompt - Prompt enhancement for images
router.post("/enhance-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at crafting detailed image generation prompts. Take the user's simple prompt and enhance it with vivid details about composition, lighting, colors, mood, artistic style, and technical aspects. Return only the enhanced prompt, no explanations.",
        },
        { role: "user", content: prompt },
      ],
    });

    res.json({
      enhanced: completion.choices[0]?.message?.content || prompt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Prompt enhancement failed" });
  }
});

// 7. POST /generate-code - Code generation
router.post("/generate-code", async (req, res) => {
  try {
    const { description, language, framework, complexity } = req.body;

    const systemPrompt = [
      `You are an expert ${language} developer.`,
      framework ? `Use the ${framework} framework.` : "",
      complexity ? `Target complexity level: ${complexity}.` : "",
      "Generate clean, well-commented, production-ready code.",
      "Return the code in a code block, followed by a brief explanation of how it works.",
    ]
      .filter(Boolean)
      .join(" ");

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: description },
      ],
    });
    const responseTime = Date.now() - start;

    const fullResponse = completion.choices[0]?.message?.content || "";

    // Extract code block and explanation
    const codeMatch = fullResponse.match(/```[\w]*\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : fullResponse;
    const explanation = fullResponse.replace(/```[\w]*\n[\s\S]*?```/, "").trim();

    res.json({
      code,
      explanation: explanation || "Code generated successfully.",
      language,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Code generation failed" });
  }
});

// 8. POST /explain-code - Code explanation
router.post("/explain-code", async (req, res) => {
  try {
    const { code, language } = req.body;

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert ${language} developer. Explain the following code clearly and thoroughly. Cover what the code does, how it works, and any important patterns or concepts used.`,
        },
        { role: "user", content: code },
      ],
    });
    const responseTime = Date.now() - start;

    res.json({
      explanation: completion.choices[0]?.message?.content || "",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Code explanation failed" });
  }
});

// 9. POST /review-code - Code review
router.post("/review-code", async (req, res) => {
  try {
    const { code, language } = req.body;

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a senior ${language} developer performing a code review. Provide:
1. A detailed review of the code covering correctness, style, performance, and security.
2. A JSON array of specific suggestions for improvement.
3. A quality score from 1-10.

Format your response exactly as:
REVIEW:
<your review>

SUGGESTIONS:
["suggestion 1", "suggestion 2", ...]

SCORE:
<number>`,
        },
        { role: "user", content: code },
      ],
    });
    const responseTime = Date.now() - start;

    const fullResponse = completion.choices[0]?.message?.content || "";

    // Parse the structured response
    const reviewMatch = fullResponse.match(/REVIEW:\s*([\s\S]*?)(?=SUGGESTIONS:)/);
    const suggestionsMatch = fullResponse.match(/SUGGESTIONS:\s*(\[[\s\S]*?\])/);
    const scoreMatch = fullResponse.match(/SCORE:\s*(\d+)/);

    let suggestions: string[] = [];
    try {
      suggestions = suggestionsMatch ? JSON.parse(suggestionsMatch[1]) : [];
    } catch {
      suggestions = [];
    }

    res.json({
      review: reviewMatch ? reviewMatch[1].trim() : fullResponse,
      suggestions,
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : 5,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Code review failed" });
  }
});

// 10. POST /generate-tests - Test generation
router.post("/generate-tests", async (req, res) => {
  try {
    const { code, language, framework } = req.body;
    const testFramework = framework || (language === "python" ? "pytest" : "jest");

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert ${language} developer. Generate comprehensive unit tests for the provided code using the ${testFramework} testing framework. Include edge cases, error handling, and descriptive test names. Return only the test code.`,
        },
        { role: "user", content: code },
      ],
    });
    const responseTime = Date.now() - start;

    const fullResponse = completion.choices[0]?.message?.content || "";
    const codeMatch = fullResponse.match(/```[\w]*\n([\s\S]*?)```/);
    const tests = codeMatch ? codeMatch[1].trim() : fullResponse;

    res.json({
      tests,
      framework: testFramework,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Test generation failed" });
  }
});

// 11. POST /batch-process - Single item batch processing
router.post("/batch-process", async (req, res) => {
  try {
    const { template, item, model, temperature } = req.body;
    const rendered = renderTemplate(template, { item });

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [{ role: "user", content: rendered }],
      temperature: temperature ?? 0.7,
    });
    const responseTime = Date.now() - start;

    res.json({
      result: completion.choices[0]?.message?.content || "",
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      responseTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Batch processing failed" });
  }
});

export default router;
