import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";



// Define available tools
const tools = [
    {
        type: "function" as const,
        function: {
            name: "get_recent_transactions",
            description: "Get recent transactions/payments from the database.",
            parameters: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Number of days to look back (default 30)" },
                    limit: { type: "number", description: "Max number of records to return (default 10)" },
                },
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "get_clients_with_multiple_transactions",
            description: "Find clients who have made more than a specific number of transactions in a given period.",
            parameters: {
                type: "object",
                properties: {
                    min_transactions: { type: "number", description: "Minimum number of transactions (default 1)" },
                    start_date: { type: "string", description: "Start date YYYY-MM-DD" },
                    end_date: { type: "string", description: "End date YYYY-MM-DD" },
                },
                required: ["min_transactions"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "search_people",
            description: "Search for a specific person by name or email.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Name or email to search for" },
                },
                required: ["query"],
            },
        },
    },
];

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // 1. Call OpenAI with tools
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are the Barn Gym AI Assistant. You have read-only access to the gym's database via tools. 
          
          Guidelines:
          - Use 'get_recent_transactions' to see who paid recently.
          - Use 'get_clients_with_multiple_transactions' to find loyal members or lists of payers.
          - Use 'search_people' to find specific details about a person.
          - If the user asks for a specific list (e.g. "people who paid > 1 time"), use the tool, then format the output nicely as a list.
          - Amounts are stored in minor units (cents/pence). Divide by 100 to show currency (GBP).
          - Be helpful, concise, and professional.
          `,
                },
                ...messages,
            ],
            tools: tools,
            tool_choice: "auto",
        });

        const choice = response.choices[0];
        const message = choice.message;

        // 2. If no tool call, return the response
        if (!message.tool_calls || message.tool_calls.length === 0) {
            return NextResponse.json({ content: message.content });
        }

        // 3. Handle tool calls
        let toolResultContent = "";
        let tableData: any[] | null = null;
        let fileName = "";

        for (const toolCall of message.tool_calls) {
            const fnName = (toolCall as any).function.name;
            const args = JSON.parse((toolCall as any).function.arguments);

            if (fnName === "get_recent_transactions") {
                const days = args.days || 30;
                const limit = args.limit || 10;
                const date = new Date();
                date.setDate(date.getDate() - days);

                const txs = await prisma.transaction.findMany({
                    where: { occurredAt: { gte: date } },
                    take: limit,
                    orderBy: { occurredAt: "desc" },
                    include: { contact: true, lead: true },
                });

                const summary = txs.map(t =>
                    `- ${t.occurredAt.toISOString().split('T')[0]}: ${((t.amountMinor ?? 0) / 100).toFixed(2)} ${t.currency} by ${t.contact?.fullName || t.lead?.fullName || t.personName || 'Unknown'} (${t.status})`
                ).join("\n");

                toolResultContent += `\n[Tool Result for ${fnName}]:\n${summary || "No transactions found."}\n`;

                // Export data
                tableData = txs.map(t => ({
                    Date: t.occurredAt.toISOString().split('T')[0],
                    Amount: ((t.amountMinor ?? 0) / 100).toFixed(2),
                    Currency: t.currency,
                    Name: t.contact?.fullName || t.lead?.fullName || t.personName || 'Unknown',
                    Status: t.status,
                    Reference: t.reference
                }));
                fileName = `recent_transactions_${new Date().toISOString().split('T')[0]}.csv`;

            } else if (fnName === "get_clients_with_multiple_transactions") {
                const minCount = args.min_transactions || 1;

                let dateFilterCte = "";
                // Handle date ranges
                let startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1); // Default 1 year back

                if (args.start_date) {
                    startDate = new Date(args.start_date);
                }

                let endDate = new Date();
                if (args.end_date) {
                    endDate = new Date(args.end_date);
                    // Set to end of day if it looks like just a date
                    if (args.end_date.length <= 10) {
                        endDate.setHours(23, 59, 59, 999);
                    }
                }

                const results = await prisma.$queryRaw`
          SELECT 
            COALESCE(c."fullName", l."fullName", t."personName", 'Unknown') as name,
            COALESCE(c."email", l."email", 'Unknown') as email,
            COUNT(t.id) as count,
            SUM(t."amountMinor") as total
          FROM "Transaction" t
          LEFT JOIN "Contact" c ON t."contactId" = c.id
          LEFT JOIN "Lead" l ON t."leadId" = l.id
          WHERE t."occurredAt" >= ${startDate} AND t."occurredAt" <= ${endDate}
          GROUP BY COALESCE(c."fullName", l."fullName", t."personName", 'Unknown'), COALESCE(c."email", l."email", 'Unknown')
          HAVING COUNT(t.id) >= ${minCount}
          ORDER BY total DESC
          LIMIT 200;
        `;

                // @ts-ignore
                const list = results.map((r: any) => `- ${r.name} (${r.email}): ${Number(r.count)} transactions, Total £${(Number(r.total) / 100).toFixed(2)}`).join("\n");
                toolResultContent += `\n[Tool Result for ${fnName} (Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})]:\n${list || "No matching clients found."}\n`;

                // Export data
                // @ts-ignore
                tableData = results.map((r: any) => ({
                    Name: r.name,
                    Email: r.email,
                    TransactionCount: Number(r.count),
                    TotalSpent: (Number(r.total) / 100).toFixed(2)
                }));
                fileName = `clients_gt_${minCount}_txs_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;

            } else if (fnName === "search_people") {
                const q = args.query;
                const people = await prisma.contact.findMany({
                    where: {
                        OR: [
                            { fullName: { contains: q, mode: 'insensitive' } },
                            { email: { contains: q, mode: 'insensitive' } }
                        ]
                    },
                    take: 20,
                    include: { transactions: { take: 3, orderBy: { occurredAt: 'desc' } } }
                });

                const summary = people.map(p =>
                    `Name: ${p.fullName}, Email: ${p.email}, Status: ${p.status}, Recent Txs: ${p.transactions.length}`
                ).join("\n");
                toolResultContent += `\n[Tool Result for ${fnName}]:\n${summary || "No people found."}\n`;

                tableData = people.map(p => ({
                    Name: p.fullName,
                    Email: p.email,
                    Phone: p.phone,
                    Status: p.status,
                    Source: p.sourceTags.join(", "),
                    Joined: p.createdAt ? p.createdAt.toISOString().split('T')[0] : ""
                }));
                fileName = `search_results_${q}.csv`;
            }
        }

        // 4. Call OpenAI again with the tool results
        const secondResponse = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are the Barn Gym AI Assistant. Answer the user's question based on the tool results provided. Use a friendly tone.",
                },
                ...messages,
                message, // The tool call message
                {
                    role: "tool",
                    content: toolResultContent,
                    tool_call_id: message.tool_calls![0].id, // Simplified: usually match IDs but we assume sequential 
                } as ChatCompletionMessageParam
            ],
        });

        return NextResponse.json({
            content: secondResponse.choices[0].message.content,
            tableData,
            fileName
        });

    } catch (error) {
        console.error("Assistant Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
