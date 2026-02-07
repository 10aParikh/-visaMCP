import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import https from "https";
import fs from "fs";

export interface VisaClientConfig {
    userId: string;
    password: string;
    certPath: string;
    keyPath: string;
    caPath?: string;
    environment: "sandbox" | "production";
}

export class VisaClient {
    private client: AxiosInstance | null = null;
    private config: VisaClientConfig;
    private baseUrl: string;
    private initialized: boolean = false;

    constructor(config: VisaClientConfig) {
        this.config = config;
        this.baseUrl =
            config.environment === "sandbox"
                ? "https://sandbox.api.visa.com"
                : "https://api.visa.com";
    }

    private initialize(): void {
        if (this.initialized) return;

        // Check if certificate files exist
        if (!fs.existsSync(this.config.certPath)) {
            console.warn(`⚠️  Warning: Certificate file not found at ${this.config.certPath}`);
            console.warn(`   Please add your Visa certificates to the certs/ directory.`);
            console.warn(`   API calls will fail until certificates are configured.`);
            return;
        }

        if (!fs.existsSync(this.config.keyPath)) {
            console.warn(`⚠️  Warning: Key file not found at ${this.config.keyPath}`);
            return;
        }

        // Create HTTPS agent with mutual TLS (Two-Way SSL)
        const httpsAgent = new https.Agent({
            cert: fs.readFileSync(this.config.certPath),
            key: fs.readFileSync(this.config.keyPath),
            ca: this.config.caPath && fs.existsSync(this.config.caPath)
                ? fs.readFileSync(this.config.caPath)
                : undefined,
            rejectUnauthorized: true,
        });

        this.client = axios.create({
            baseURL: this.baseUrl,
            httpsAgent,
            auth: {
                username: this.config.userId,
                password: this.config.password,
            },
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });

        this.initialized = true;
        console.log(`✅ Visa API client initialized (${this.config.environment})`);
    }

    private getClient(): AxiosInstance {
        this.initialize();
        if (!this.client) {
            throw new Error(
                "Visa API client not initialized. Please configure your certificates in the certs/ directory."
            );
        }
        return this.client;
    }

    // ====================
    // Hello World / Test
    // ====================
    async helloWorld(): Promise<any> {
        const response = await this.getClient().get("/vdp/helloworld");
        return response.data;
    }

    // ====================
    // Foreign Exchange
    // ====================
    async getExchangeRate(
        sourceCurrencyCode: string,
        destinationCurrencyCode: string,
        sourceAmount: number
    ): Promise<any> {
        const response = await this.getClient().post(
            "/forexrates/v2/foreignexchangerates",
            {
                sourceCurrencyCode,
                destinationCurrencyCode,
                sourceAmount: sourceAmount.toString(),
            }
        );
        return response.data;
    }

    // ====================
    // ATM Locator
    // ====================
    async findNearbyAtms(
        latitude: number,
        longitude: number,
        distance: number = 5,
        distanceUnit: "km" | "mi" = "km"
    ): Promise<any> {
        const response = await this.getClient().post(
            "/globalatmlocator/v1/localatms/atmLocator",
            {
                wsRequestHeaderV2: {
                    requestTs: new Date().toISOString(),
                    applicationId: "VISA_MCP",
                },
                requestData: {
                    location: {
                        geocodes: {
                            latitude,
                            longitude,
                        },
                    },
                    options: {
                        range: {
                            distance,
                            distanceUnit,
                        },
                        findFilters: [],
                        sort: {
                            primary: "distance",
                            direction: "asc",
                        },
                    },
                },
            }
        );
        return response.data;
    }

    // ================================
    // Visa Subscription Manager (VSM)
    // ================================
    async vsmSearch(pan: string): Promise<any> {
        const response = await this.getClient().post(
            "/vsm/v1/search",
            { pan }
        );
        return response.data;
    }

    async vsmMerchantDetails(transactionId: string): Promise<any> {
        const response = await this.getClient().post(
            "/vsm/v1/merchantdetails",
            { transactionId }
        );
        return response.data;
    }

    async vsmAddMerchant(
        pan: string,
        merchantId: string,
        reason?: string
    ): Promise<any> {
        const response = await this.getClient().post("/vsm/v1/addmerchant", {
            pan,
            merchantId,
            reason: reason || "Subscription cancellation",
        });
        return response.data;
    }

    async vsmCancel(stopId: string): Promise<any> {
        const response = await this.getClient().post("/vsm/v1/cancel", { stopId });
        return response.data;
    }

    // ================================
    // Visa Stop Payment Service (VSPS)
    // ================================
    async vspsSearchInstructions(pan: string): Promise<any> {
        const response = await this.getClient().post(
            "/vsps/v1/stopinstructions/search",
            { pan }
        );
        return response.data;
    }

    async vspsSearchEligible(pan: string, days: number = 90): Promise<any> {
        const response = await this.getClient().post(
            "/vsps/v1/eligibletransactions/search",
            {
                pan,
                searchPeriodDays: days,
            }
        );
        return response.data;
    }

    async vspsAddStop(
        pan: string,
        level: "merchant" | "mcc" | "pan",
        merchantId?: string,
        mcc?: string
    ): Promise<any> {
        const payload: any = { pan, level };
        if (level === "merchant" && merchantId) {
            payload.merchantId = merchantId;
        } else if (level === "mcc" && mcc) {
            payload.mcc = mcc;
        }
        const response = await this.getClient().post(
            "/vsps/v1/stopinstructions/add",
            payload
        );
        return response.data;
    }

    async vspsCancelStop(stopId: string): Promise<any> {
        const response = await this.getClient().post(
            "/vsps/v1/stopinstructions/cancel",
            { stopId }
        );
        return response.data;
    }

    async vspsUpdateStop(stopId: string, updates: Record<string, any>): Promise<any> {
        const response = await this.getClient().post(
            "/vsps/v1/stopinstructions/update",
            { stopId, ...updates }
        );
        return response.data;
    }

    async vspsExtendStop(stopId: string, newEndDate: string): Promise<any> {
        const response = await this.getClient().post(
            "/vsps/v1/stopinstructions/extend",
            { stopId, newEndDate }
        );
        return response.data;
    }
}
