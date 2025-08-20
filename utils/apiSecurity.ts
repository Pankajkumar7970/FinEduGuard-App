import "react-native-get-random-values";
import { fetch as pinnedFetch } from "react-native-ssl-pinning";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import * as Crypto from "expo-crypto";
import { SECURITY_CONFIG, getSecurityHeaders } from "./securityConfig";
import { encryptionService } from "./encryption";
import * as CryptoJS from "crypto-js";
import sslPinningService from "./sslPinningService";

export interface SecureApiConfig {
  baseURL: string;
  timeout: number;
  enableSSL: boolean;
  enableEncryption: boolean;
  enableRateLimit: boolean;
}

export class SecureApiService {
  private static instance: SecureApiService;
  private apiClient: AxiosInstance;
  private requestCount: Map<string, number> = new Map();
  private lastRequestTime: Map<string, number> = new Map();

  private constructor() {
    this.apiClient = axios.create({
      baseURL: SECURITY_CONFIG.API.BASE_URL,
      timeout: SECURITY_CONFIG.API.TIMEOUT,
      headers: getSecurityHeaders(),
    });

    this.setupInterceptors();
  }

  public static getInstance(): SecureApiService {
    if (!SecureApiService.instance) {
      SecureApiService.instance = new SecureApiService();
    }
    return SecureApiService.instance;
  }

  // Setup request and response interceptors (applies to Axios path)
  private setupInterceptors(): void {
    // Request interceptor
    this.apiClient.interceptors.request.use(
      async (config) => {
        const hdrs: Record<string, any> = {
          ...(config.headers as any),
          ...getSecurityHeaders(),
          "X-Request-ID": await this.generateRequestId(),
          "X-Timestamp": Date.now().toString(),
        };

        // Rate limiting
        if (SECURITY_CONFIG.API.RATE_LIMIT.ENABLED) {
          await this.checkRateLimit(config.url || "");
        }

        // Transport encryption ONLY when shared secret is set
        const sharedSecret =
          SECURITY_CONFIG.API.ENCRYPTION.SHARED_SECRET ||
          process.env.API_SHARED_SECRET;
        console.log("[TX] sharedSecret=", sharedSecret);

        if (SECURITY_CONFIG.API.ENCRYPTION.ENABLED && sharedSecret) {
          // Always request encrypted responses (even for GET)
          hdrs["X-Encrypted"] = "1";

          if (config.data) {
            const { payload, ivBase64 } = await this.encryptWithSharedSecret(
              typeof config.data === "string"
                ? config.data
                : JSON.stringify(config.data),
              sharedSecret
            );
            hdrs["X-IV"] = ivBase64;
            hdrs["Content-Type"] = "text/plain";
            config.data = payload;

            console.log(
              "[TX] encrypted=1",
              "iv.len=",
              ivBase64?.length,
              "ctype=",
              hdrs["Content-Type"],
              "body.sample=",
              String(config.data).slice(0, 60)
            );
          } else {
            console.log("[TX] encrypted=1", "no-body");
          }
        } else {
          console.log(
            "[TX] encrypted=0",
            "ctype=",
            (hdrs["Content-Type"] ||
              (config.headers as any)?.["Content-Type"]) ??
              "application/json"
          );
        }

        config.headers = hdrs as any;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.apiClient.interceptors.response.use(
      async (response) => {
        const sharedSecret =
          SECURITY_CONFIG.API.ENCRYPTION.SHARED_SECRET ||
          process.env.API_SHARED_SECRET;
        const isEncrypted = !!(
          response.headers &&
          ((response.headers["x-encrypted"] as any) === "1" ||
            (response.headers["X-Encrypted"] as any) === "1")
        );
        const ivHeader = (response.headers &&
          ((response.headers["x-iv"] as any) ||
            (response.headers["X-IV"] as any))) as string | undefined;

        console.log(
          "[RX] header.encrypted=",
          isEncrypted,
          "hasIV=",
          !!ivHeader,
          "data.type=",
          typeof response.data
        );

        if (
          SECURITY_CONFIG.API.ENCRYPTION.ENABLED &&
          sharedSecret &&
          isEncrypted &&
          typeof response.data === "string"
        ) {
          const beforeSample = String(response.data).slice(0, 60);
          response.data = await this.decryptWithSharedSecret(
            response.data,
            sharedSecret,
            ivHeader
          );
          console.log(
            "[RX] decrypted",
            "before.sample=",
            beforeSample,
            "after.type=",
            typeof response.data
          );
        } else {
          console.log("[RX] plaintext", "type=", typeof response.data);
        }

        if (response.headers["x-response-hash"]) {
          const isValid = await this.verifyResponseIntegrity(response);
          if (!isValid) {
            throw new Error("Response integrity check failed");
          }
        }

        return response;
      },
      async (error) => {
        try {
          const resp = error.response;
          const reqCfg = error.config || {};
          const headers = (resp && resp.headers) || {};
          const reqId =
            headers["x-request-id"] || reqCfg.headers?.["X-Request-ID"];
          const isEncrypted =
            headers["x-encrypted"] === "1" || headers["X-Encrypted"] === "1";
          const iv = headers["x-iv"] || headers["X-IV"];

          // Try to decrypt error body for clarity
          let decryptedError: any = null;
          const sharedSecret =
            SECURITY_CONFIG.API.ENCRYPTION.SHARED_SECRET ||
            process.env.API_SHARED_SECRET;
          if (sharedSecret && isEncrypted && typeof resp?.data === "string") {
            try {
              decryptedError = await this.decryptWithSharedSecret(
                resp.data,
                sharedSecret,
                iv
              );
            } catch {}
          }

          console.error("[CLIENT ERR]", {
            status: resp?.status,
            url: reqCfg?.baseURL ? reqCfg.baseURL + reqCfg.url : reqCfg.url,
            method: reqCfg?.method,
            reqId,
            isEncrypted,
            hasIV: !!iv,
            respType: typeof resp?.data,
            respDataSample:
              typeof resp?.data === "string"
                ? String(resp.data).slice(0, 120)
                : undefined,
            respJsonKeys:
              resp?.data && typeof resp.data === "object"
                ? Object.keys(resp.data)
                : undefined,
            decrypted: decryptedError,
          });
        } catch (e) {
          console.error("[CLIENT ERR] logging failure", e);
        }

        if (error.code === "CERTIFICATE_VERIFY_FAILED") {
          throw new Error("SSL certificate verification failed");
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limit exceeded");
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper: pinned fetch with optional transport encryption (used when SSL pinning enabled)
  private async doPinnedFetch<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    body?: any,
    extraHeaders?: Record<string, any>
  ): Promise<T> {
    try {
      // Build full URL from axios baseURL + relative url
      const base = (this.apiClient.defaults.baseURL || "").replace(/\/+$/, "");
      const path = url.startsWith("/") ? url : `/${url}`;
      const fullUrl = `${base}${path}`;

      // Extract domain for SSL pinning validation
      const domain = this.extractDomain(fullUrl);

      // Validate SSL certificate before making request
      if (SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        try {
          const validationResult = await sslPinningService.validateCertificate(
            domain
          );
          if (validationResult !== "VALID") {
            console.warn(
              `SSL certificate validation failed for ${domain}: ${validationResult}`
            );
            // Continue with request but log the warning
          }
        } catch (error) {
          console.warn(
            `SSL certificate validation error for ${domain}:`,
            error
          );
        }
      }

      // Pick cert names (without .cer) for current env
      const certs =
        (__DEV__
          ? SECURITY_CONFIG?.SSL_PINNING?.CERTIFICATES?.STAGING
          : SECURITY_CONFIG?.SSL_PINNING?.CERTIFICATES?.PRODUCTION) || [];

      // Compose headers
      const headers: Record<string, any> = {
        ...(extraHeaders || {}),
        ...getSecurityHeaders(),
        "X-Request-ID": await this.generateRequestId(),
        "X-Timestamp": Date.now().toString(),
      };

      // Carry over Authorization from axios defaults
      const authHeader =
        this.apiClient.defaults.headers.common["Authorization"];
      if (authHeader) headers["Authorization"] = authHeader;

      // Transport encryption
      const sharedSecret =
        SECURITY_CONFIG.API.ENCRYPTION.SHARED_SECRET ||
        process.env.API_SHARED_SECRET;

      let requestBody: string | undefined = undefined;

      if (SECURITY_CONFIG.API.ENCRYPTION.ENABLED && sharedSecret) {
        // Always request encrypted responses
        headers["X-Encrypted"] = "1";

        if (body !== undefined && body !== null) {
          const plaintext =
            typeof body === "string" ? body : JSON.stringify(body);
          const { payload, ivBase64 } = await this.encryptWithSharedSecret(
            plaintext,
            sharedSecret
          );
          headers["X-IV"] = ivBase64;
          headers["Content-Type"] = "text/plain";
          requestBody = payload;
        }
      } else if (body !== undefined && body !== null) {
        headers["Content-Type"] = "application/json";
        requestBody = typeof body === "string" ? body : JSON.stringify(body);
      }

      console.log(`[PINNED_FETCH] ${method} ${fullUrl}`, {
        hasBody: !!requestBody,
        isEncrypted: headers["X-Encrypted"] === "1",
        certsCount: certs.length,
        domain,
      });

      const res = await pinnedFetch(fullUrl, {
        method,
        headers,
        body: requestBody,
        timeoutInterval: SECURITY_CONFIG.SSL_PINNING.TIMEOUT || 10000,
        sslPinning: { certs },
      });

      const respText = res.bodyString ?? "";
      const isEncrypted =
        res.headers?.["x-encrypted"] === "1" ||
        res.headers?.["X-Encrypted"] === "1";
      const ivHeader = res.headers?.["x-iv"] || res.headers?.["X-IV"];

      console.log(`[PINNED_FETCH_RESPONSE] ${method} ${fullUrl}`, {
        status: res.status,
        isEncrypted,
        hasIV: !!ivHeader,
        responseLength: respText.length,
      });

      // Handle non-2xx statuses
      if (!res.status || res.status >= 400) {
        let decrypted: any = null;
        if (
          SECURITY_CONFIG.API.ENCRYPTION.ENABLED &&
          sharedSecret &&
          isEncrypted &&
          typeof respText === "string"
        ) {
          try {
            decrypted = await this.decryptWithSharedSecret(
              respText,
              sharedSecret,
              ivHeader
            );
          } catch {}
        }
        const msg =
          (decrypted && (decrypted.message || decrypted.error)) ||
          `API error ${res.status || ""}`;
        throw new Error(msg);
      }

      // Decrypt if server sent encrypted payload
      if (
        SECURITY_CONFIG.API.ENCRYPTION.ENABLED &&
        sharedSecret &&
        isEncrypted &&
        typeof respText === "string"
      ) {
        return (await this.decryptWithSharedSecret(
          respText,
          sharedSecret,
          ivHeader
        )) as T;
      }

      // Parse JSON if possible
      try {
        return JSON.parse(respText) as T;
      } catch {
        return respText as unknown as T;
      }
    } catch (error) {
      console.error(`[PINNED_FETCH_ERROR] ${method} ${url}:`, error);

      // Handle SSL pinning specific errors
      if (error.message?.includes("CERTIFICATE_VERIFY_FAILED")) {
        throw new Error(`SSL certificate verification failed for ${url}`);
      }

      throw error;
    }
  }

  // Extract domain from URL for SSL pinning validation
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // Fallback for malformed URLs
      const match = url.match(/https?:\/\/([^\/]+)/);
      return match ? match[1] : url;
    }
  }

  // Shared-secret AES-256-CBC helpers (IV from Expo RNG)
  private async encryptWithSharedSecret(
    plaintext: string,
    secret: string
  ): Promise<{ payload: string; ivBase64: string }> {
    try {
      const ivBytes = await Crypto.getRandomBytesAsync(16);
      const words: number[] = [];
      for (let i = 0; i < ivBytes.length; i += 4) {
        words.push(
          ((ivBytes[i] || 0) << 24) |
            ((ivBytes[i + 1] || 0) << 16) |
            ((ivBytes[i + 2] || 0) << 8) |
            (ivBytes[i + 3] || 0)
        );
      }
      const ivWordArray = CryptoJS.lib.WordArray.create(words, ivBytes.length);
      const keyWordArray = CryptoJS.SHA256(secret);
      const cipherParams = CryptoJS.AES.encrypt(plaintext, keyWordArray, {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      const payload = cipherParams.ciphertext.toString(CryptoJS.enc.Base64);
      const ivBase64 = CryptoJS.enc.Base64.stringify(ivWordArray);

      console.log("[CLIENT ENC]", {
        plainLen: plaintext.length,
        ivLen: ivBase64.length,
        ctSample: payload.slice(0, 80),
      });

      return { payload, ivBase64 };
    } catch (e: any) {
      console.error("[CLIENT ENC] failed", { msg: e?.message });
      throw e;
    }
  }

  private async decryptWithSharedSecret(
    ciphertextBase64: string,
    secret: string,
    ivBase64?: string
  ): Promise<any> {
    try {
      if (!ivBase64) throw new Error("Missing IV for shared-secret decryption");
      const keyWordArray = CryptoJS.SHA256(secret);
      const ivWordArray = CryptoJS.enc.Base64.parse(ivBase64);
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(ciphertextBase64) } as any,
        keyWordArray,
        {
          iv: ivWordArray,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      const text = CryptoJS.enc.Utf8.stringify(decrypted);

      console.log("[CLIENT DEC]", {
        hasIV: !!ivBase64,
        ctSample: String(ciphertextBase64 || "").slice(0, 80),
        outType: "string",
        outLen: text?.length ?? 0,
      });

      try {
        return JSON.parse(text);
      } catch {
        return text as any;
      }
    } catch (e: any) {
      console.error("[CLIENT DEC] failed", {
        msg: e?.message,
        hasIV: !!ivBase64,
        ctSample: String(ciphertextBase64 || "").slice(0, 120),
      });
      throw e;
    }
  }

  // Generate unique request ID
  private async generateRequestId(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      randomBytes.toString() + Date.now().toString(),
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
  }

  // Rate limiting implementation
  private async checkRateLimit(url: string): Promise<void> {
    const now = Date.now();
    const key = this.getRateLimitKey(url);

    if (this.lastRequestTime.has(key)) {
      const lastTime = this.lastRequestTime.get(key) || 0;
      if (now - lastTime > 60000) {
        this.requestCount.delete(key);
        this.lastRequestTime.delete(key);
      }
    }

    const currentCount = this.requestCount.get(key) || 0;
    if (currentCount >= SECURITY_CONFIG.API.RATE_LIMIT.REQUESTS_PER_MINUTE) {
      throw new Error("Rate limit exceeded");
    }

    this.requestCount.set(key, currentCount + 1);
    this.lastRequestTime.set(key, now);
  }

  private getRateLimitKey(url: string): string {
    const endpoint = url.split("?")[0].split("/").pop() || "default";
    return endpoint;
  }

  // Encrypt request data with device key (used for local storage, not transport)
  private async encryptRequestData(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    return await encryptionService.encrypt(jsonString);
  }

  // Decrypt response data with device key (used if your API actually returns encrypted blobs)
  private async decryptResponseData(encryptedData: string): Promise<any> {
    const decryptedString = await encryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  // Verify response integrity
  private async verifyResponseIntegrity(
    response: AxiosResponse
  ): Promise<boolean> {
    const expectedHash = response.headers["x-response-hash"];
    const responseData = JSON.stringify(response.data);
    const actualHash = await encryptionService.generateHash(responseData);
    return actualHash === expectedHash;
  }

  // Secure GET/POST/PUT/DELETE (prefer pinning when enabled)
  public async secureGet<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      if (SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return await this.doPinnedFetch<T>(
          "GET",
          url,
          undefined,
          config?.headers as any
        );
      }
      const response = await this.apiClient.get<T>(url, config);
      return response.data as unknown as T;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async securePost<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      if (SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return await this.doPinnedFetch<T>(
          "POST",
          url,
          data,
          config?.headers as any
        );
      }
      const response = await this.apiClient.post<T>(url, data, config);
      return response.data as unknown as T;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async securePut<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      if (SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return await this.doPinnedFetch<T>(
          "PUT",
          url,
          data,
          config?.headers as any
        );
      }
      const response = await this.apiClient.put<T>(url, data, config);
      return response.data as unknown as T;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  public async secureDelete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      if (SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return await this.doPinnedFetch<T>(
          "DELETE",
          url,
          undefined,
          config?.headers as any
        );
      }
      const response = await this.apiClient.delete<T>(url, config);
      return response.data as unknown as T;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  // Handle API errors
  private handleApiError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || "API request failed";
      switch (status) {
        case 401:
          return new Error("Authentication required");
        case 403:
          return new Error("Access forbidden");
        case 404:
          return new Error("Resource not found");
        case 429:
          return new Error("Rate limit exceeded");
        case 500:
          return new Error("Internal server error");
        default:
          return new Error(`API error: ${status} - ${message}`);
      }
    } else if (error.request) {
      return new Error("Network connection failed");
    } else {
      return new Error(error.message || "Unknown error occurred");
    }
  }

  // Get SSL pinning status for debugging
  public getSSLPinningStatus(): any {
    try {
      if (!SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return {
          enabled: false,
          reason: "SSL Pinning disabled in configuration",
        };
      }
      return sslPinningService.getStatus();
    } catch (error) {
      return {
        enabled: false,
        reason: `Error getting status: ${error.message}`,
      };
    }
  }

  // Test SSL pinning for a specific domain
  public async testSSLPinningForDomain(domain: string): Promise<any> {
    try {
      if (!SECURITY_CONFIG.SSL_PINNING?.ENABLED) {
        return { success: false, message: "SSL Pinning disabled" };
      }

      const result = await sslPinningService.validateCertificate(domain);
      return {
        success: result === "VALID",
        result,
        domain,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        domain,
        timestamp: new Date().toISOString(),
      };
    }
  }

  public setAuthToken(token: string): void {
    this.apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  public clearAuthToken(): void {
    delete this.apiClient.defaults.headers.common["Authorization"];
  }

  public updateBaseURL(baseURL: string): void {
    this.apiClient.defaults.baseURL = baseURL;
  }

  public getApiClient(): AxiosInstance {
    return this.apiClient;
  }
}

// Export singleton instance
export const secureApiService = SecureApiService.getInstance();

// Utility functions
export const secureGet = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  return await secureApiService.secureGet<T>(url, config);
};

export const securePost = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  return await secureApiService.securePost<T>(url, data, config);
};

export const securePut = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  return await secureApiService.securePost<T>(url, data, config);
};

export const secureDelete = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  return await secureApiService.secureDelete<T>(url, config);
};

export const setAuthToken = (token: string): void => {
  secureApiService.setAuthToken(token);
};

export const clearAuthToken = (): void => {
  secureApiService.clearAuthToken();
};

// New SSL pinning utility functions
export const getSSLPinningStatus = (): any => {
  return secureApiService.getSSLPinningStatus();
};

export const testSSLPinningForDomain = async (domain: string): Promise<any> => {
  return await secureApiService.testSSLPinningForDomain(domain);
};
