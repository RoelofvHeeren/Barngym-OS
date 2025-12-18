
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { prompt, templateId } = await req.json();

        if (!prompt) {
            return NextResponse.json({ ok: false, message: "Prompt is required" }, { status: 400 });
        }

        const systemPrompt = `
    You are an expert Content Producer for Barn Gym. 
    Your goal is to help users create video content ideas and scripts for Instagram Reels, TikToks, and YouTube Shorts.
    
    You must output valid JSON with the following structure:
    {
      "title": "Catchy Title",
      "goal": "Educational | Promotional | Authority",
      "platform": "INSTAGRAM_REEL",
      "scriptContent": "Markdown formatted script...",
      "brief": {
        "pacing": "Fast | Slow",
        "tone": "Energetic | Serious",
        "visuals": ["Shot description 1", "Shot description 2"]
      }
    }

    The script should adhere to this structure:
    1. Hook (3 seconds)
    2. Value / Body
    3. Call to Action
    
    Use a tone that is professional yet approachable, fitting for a premium gym brand.
    `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Create a video project plan for: "${prompt}"` }
            ],
            model: "gpt-4o", // Or gpt-3.5-turbo if cost concern, but 4o is better for creative
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (!content) {
            throw new Error("No content generated");
        }

        const generation = JSON.parse(content);

        return NextResponse.json({ ok: true, data: generation });

    } catch (error) {
        console.error("Agent Error:", error);
        return NextResponse.json({ ok: false, message: "Failed to generate content" }, { status: 500 });
    }
}
