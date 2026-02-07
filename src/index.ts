import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import cors from "cors";
import dotenv from "dotenv";
import { VisaClient } from "./visa-client.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize Visa Client
const visaClient = new VisaClient({
    userId: process.env.VISA_USER_ID || "",
    password: process.env.VISA_PASSWORD || "",
    certPath: process.env.VISA_CERT_PATH || "./certs/cert.pem",
    keyPath: process.env.VISA_KEY_PATH || "./certs/key.pem",
    caPath: process.env.VISA_CA_PATH,
    environment: (process.env.VISA_ENV as "sandbox" | "production") || "sandbox",
});

// Initialize MCP Server
const mcpServer = new McpServer({
    name: "VisaAPIAgent",
    version: "1.0.0",
});

// Helper to format tool responses
function formatResponse(data: any, error?: string) {
    if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error}` }] };
    }
    return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
}

// ====================
// CORE TOOLS
// ====================

mcpServer.tool(
    "hello_world",
    "Test Visa API connectivity - verifies credentials and connection",
    {},
    async () => {
        try {
            const data = await visaClient.helloWorld();
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "get_exchange_rate",
    "Get Visa foreign exchange rate for a currency pair",
    {
        sourceCurrency: z.string().describe("Source currency ISO code (e.g., USD)"),
        destinationCurrency: z.string().describe("Destination currency ISO code (e.g., EUR)"),
        sourceAmount: z.number().describe("Amount to convert"),
    },
    async ({ sourceCurrency, destinationCurrency, sourceAmount }) => {
        try {
            const data = await visaClient.getExchangeRate(
                sourceCurrency,
                destinationCurrency,
                sourceAmount
            );
            const rate = data.conversionRate || "N/A";
            const converted = data.destinationAmount || "N/A";
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Exchange Rate: ${rate}\n${sourceAmount} ${sourceCurrency} = ${converted} ${destinationCurrency}\n\nFull response:\n${JSON.stringify(data, null, 2)}`,
                    },
                ],
            };
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "find_nearby_atms",
    "Find Visa/Plus ATMs near a location",
    {
        latitude: z.number().describe("Latitude of search center"),
        longitude: z.number().describe("Longitude of search center"),
        distance: z.number().optional().describe("Search radius (default: 5km)"),
    },
    async ({ latitude, longitude, distance }) => {
        try {
            const data = await visaClient.findNearbyAtms(latitude, longitude, distance || 5);
            const atms = data.responseData?.atmList || [];
            const summary = atms
                .slice(0, 10)
                .map(
                    (atm: any, i: number) =>
                        `${i + 1}. ${atm.atmName || "ATM"} - ${atm.address?.street || "Unknown"}, ${atm.address?.city || ""} (${atm.distance || "?"} km)`
                )
                .join("\n");
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Found ${atms.length} ATMs nearby:\n\n${summary || "No ATMs found"}`,
                    },
                ],
            };
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

// ================================
// VISA SUBSCRIPTION MANAGER TOOLS
// ================================

mcpServer.tool(
    "vsm_search",
    "Search for all active stop instructions on a card (Visa Subscription Manager)",
    {
        pan: z.string().describe("Card number (PAN)"),
    },
    async ({ pan }) => {
        try {
            const data = await visaClient.vsmSearch(pan);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsm_merchant_details",
    "Get merchant details for a transaction (Visa Subscription Manager)",
    {
        transactionId: z.string().describe("Transaction ID to look up"),
    },
    async ({ transactionId }) => {
        try {
            const data = await visaClient.vsmMerchantDetails(transactionId);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsm_add_merchant",
    "Create a stop instruction for a merchant subscription (Visa Subscription Manager)",
    {
        pan: z.string().describe("Card number (PAN)"),
        merchantId: z.string().describe("Merchant identifier"),
        reason: z.string().optional().describe("Reason for stopping (optional)"),
    },
    async ({ pan, merchantId, reason }) => {
        try {
            const data = await visaClient.vsmAddMerchant(pan, merchantId, reason);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsm_cancel",
    "Cancel a stop instruction to restart merchant payments (Visa Subscription Manager)",
    {
        stopId: z.string().describe("Stop instruction ID to cancel"),
    },
    async ({ stopId }) => {
        try {
            const data = await visaClient.vsmCancel(stopId);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

// ================================
// VISA STOP PAYMENT SERVICE TOOLS
// ================================

mcpServer.tool(
    "vsps_search_instructions",
    "Get all active stop instruction IDs for a card (Visa Stop Payment Service)",
    {
        pan: z.string().describe("Card number (PAN)"),
    },
    async ({ pan }) => {
        try {
            const data = await visaClient.vspsSearchInstructions(pan);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsps_search_eligible",
    "Search for VSPS-eligible transactions on a card (30-180 days)",
    {
        pan: z.string().describe("Card number (PAN)"),
        days: z.number().optional().describe("Search period in days (30-180, default: 90)"),
    },
    async ({ pan, days }) => {
        try {
            const data = await visaClient.vspsSearchEligible(pan, days || 90);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsps_add_stop",
    "Create a stop instruction at Merchant, MCC, or PAN level",
    {
        pan: z.string().describe("Card number (PAN)"),
        level: z.enum(["merchant", "mcc", "pan"]).describe("Stop level: merchant, mcc, or pan"),
        merchantId: z.string().optional().describe("Merchant ID (required for merchant level)"),
        mcc: z.string().optional().describe("Merchant Category Code (required for mcc level)"),
    },
    async ({ pan, level, merchantId, mcc }) => {
        try {
            const data = await visaClient.vspsAddStop(pan, level, merchantId, mcc);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsps_cancel_stop",
    "Cancel a stop instruction to allow payments to resume",
    {
        stopId: z.string().describe("Stop instruction ID to cancel"),
    },
    async ({ stopId }) => {
        try {
            const data = await visaClient.vspsCancelStop(stopId);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsps_update_stop",
    "Update a merchant or MCC level stop instruction",
    {
        stopId: z.string().describe("Stop instruction ID to update"),
        merchantId: z.string().optional().describe("New merchant ID"),
        notes: z.string().optional().describe("Updated notes"),
    },
    async ({ stopId, merchantId, notes }) => {
        try {
            const updates: Record<string, any> = {};
            if (merchantId) updates.merchantId = merchantId;
            if (notes) updates.notes = notes;
            const data = await visaClient.vspsUpdateStop(stopId, updates);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

mcpServer.tool(
    "vsps_extend_stop",
    "Extend the end date of a stop instruction",
    {
        stopId: z.string().describe("Stop instruction ID to extend"),
        newEndDate: z.string().describe("New end date (YYYY-MM-DD format)"),
    },
    async ({ stopId, newEndDate }) => {
        try {
            const data = await visaClient.vspsExtendStop(stopId, newEndDate);
            return formatResponse(data);
        } catch (error: any) {
            return formatResponse(null, error.response?.data?.message || error.message);
        }
    }
);

// ================================
// DEDALUS REQUIRED ENDPOINTS
// ================================

// Store transports for message routing
const transports = new Map<string, SSEServerTransport>();

// Main MCP entry point (required for Dedalus validator)
app.get("/mcp", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = Date.now().toString();
    transports.set(sessionId, transport);

    res.on("close", () => {
        transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
});

// POST endpoint for client messages
app.post("/messages", async (req, res) => {
    // Handle incoming MCP messages
    res.sendStatus(200);
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", server: "VisaAPIAgent", version: "1.0.0" });
});

app.listen(PORT, () => {
    console.log(`🏦 Visa MCP Server running on port ${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
