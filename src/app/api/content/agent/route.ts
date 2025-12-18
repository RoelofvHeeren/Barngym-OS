
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { messages, templateId, duration } = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ ok: false, message: "Messages array is required" }, { status: 400 });
        }

        const durationContext = duration ? `The estimated duration for this video is ${duration}. Ensure the script length fits this timing.` : "";

        const systemPrompt = `
    You are an expert Content Producer for Barn Gym. 
    Your goal is to help users create video content ideas and scripts for Instagram Reels, TikToks, and YouTube Shorts.
    
    You are in a conversation with the user to refine the idea.
    ${durationContext}

    If the user request is just an initial idea, generate a full plan.
    If the user is asking for a revision ("make it shorter", "change the hook"), modify the previous plan accordingly.
    
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

    The script MUST adhere to this structure and MUST include timing estimates for EACH section:
    **Hook (3s)**
    [Script lines...]

    **Value / Body (Xs)** - Calculate X based on remaining time
    [Script lines...]

    **Call to Action (Xs)**
    [Script lines...]
    
    Use a tone that is professional yet approachable, fitting for a premium gym brand.
    `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
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
