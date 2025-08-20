import { Platform } from "react-native";
import {
  SSL_PINNING_CONFIG,
  CertificateValidationResult,
  SSLPinningError,
} from "./sslPinningConfig";

// Import SSL pinning library
let SSLPinning: any;
if (Platform.OS === "android") {
  SSLPinning = require("react-native-ssl-pinning");
}

export class SSLPinningService {
  private static instance: SSLPinningService;
  private isInitialized: boolean = false;
  private debugLogs: string[] = [];

  private constructor() {}

  public static getInstance(): SSLPinningService {
    if (!SSLPinningService.instance) {
      SSLPinningService.instance = new SSLPinningService();
    }
    return SSLPinningService.instance;
  }

  /**
   * Initialize SSL pinning service
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!SSL_PINNING_CONFIG.ENABLED) {
        this.logDebug("SSL Pinning is disabled in configuration");
        return false;
      }

      if (Platform.OS !== "android") {
        this.logDebug("SSL Pinning only supported on Android");
        return false;
      }

      if (!SSLPinning) {
        this.logDebug("SSL Pinning library not available");
        return false;
      }

      this.isInitialized = true;
      this.logDebug("SSL Pinning service initialized successfully");
      return true;
    } catch (error) {
      this.logError("Failed to initialize SSL Pinning service", error);
      return false;
    }
  }

  /**
   * Validate SSL certificate for a given domain
   */
  public async validateCertificate(
    domain: string
  ): Promise<CertificateValidationResult> {
    try {
      if (!this.isInitialized) {
        this.logDebug("SSL Pinning service not initialized");
        return CertificateValidationResult.NETWORK_ERROR;
      }

      this.logDebug(`Validating certificate for domain: ${domain}`);

      const domainConfig = this.getDomainConfig(domain);
      if (!domainConfig) {
        this.logDebug(
          `No SSL pinning configuration found for domain: ${domain}`
        );
        return CertificateValidationResult.VALID; // Skip pinning for unconfigured domains
      }

      const result = await this.performCertificateValidation(
        domain,
        domainConfig
      );
      this.logDebug(`Certificate validation result for ${domain}: ${result}`);

      return result;
    } catch (error) {
      this.logError(`Certificate validation failed for ${domain}`, error);
      return CertificateValidationResult.NETWORK_ERROR;
    }
  }

  /**
   * Perform SSL pinning for a request
   */
  public async performSSLPinning(
    url: string,
    method: string = "GET",
    headers: Record<string, string> = {},
    body?: any
  ): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error("SSL Pinning service not initialized");
      }

      const domain = this.extractDomain(url);
      this.logDebug(`Performing SSL pinning for request to: ${domain}`);

      // Validate certificate before making request
      const validationResult = await this.validateCertificate(domain);
      if (validationResult !== CertificateValidationResult.VALID) {
        throw new Error(
          `SSL Certificate validation failed: ${validationResult}`
        );
      }

      // Make the request with SSL pinning
      const response = await SSLPinning.fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        sslPinning: {
          certs: this.getCertificatesForDomain(domain),
        },
      });

      this.logDebug(`SSL pinned request successful to: ${domain}`);
      return response;
    } catch (error) {
      this.logError(`SSL pinned request failed to: ${url}`, error);
      throw this.createSSLPinningError(error);
    }
  }

  /**
   * Get SSL pinning status
   */
  public getStatus(): {
    isEnabled: boolean;
    isInitialized: boolean;
    supportedPlatforms: string[];
  } {
    return {
      isEnabled: SSL_PINNING_CONFIG.ENABLED,
      isInitialized: this.isInitialized,
      supportedPlatforms: ["android"],
    };
  }

  /**
   * Get debug logs
   */
  public getDebugLogs(): string[] {
    return [...this.debugLogs];
  }

  /**
   * Clear debug logs
   */
  public clearDebugLogs(): void {
    this.debugLogs = [];
  }

  /**
   * Private methods
   */
  private getDomainConfig(domain: string): any {
    const configs = Object.values(SSL_PINNING_CONFIG.CERTIFICATES);
    return configs.find(
      (config) =>
        domain === config.domain || domain.endsWith("." + config.domain)
    );
  }

  private getCertificatesForDomain(domain: string): string[] {
    const config = this.getDomainConfig(domain);
    if (!config) return [];

    const certs = [config.fingerprint];
    if (SSL_PINNING_CONFIG.VALIDATION.ALLOW_BACKUP_CERTS && config.backup) {
      certs.push(config.backup);
    }
    return certs;
  }

  private async performCertificateValidation(
    domain: string,
    config: any
  ): Promise<CertificateValidationResult> {
    try {
      // Check certificate age if configured
      if (SSL_PINNING_CONFIG.VALIDATION.MAX_CERT_AGE_DAYS > 0) {
        // This would require additional implementation to check certificate dates
        // For now, we'll assume valid if we can connect
      }

      // Test connection with SSL pinning
      const testUrl = `https://${domain}`;
      await SSLPinning.fetch(testUrl, {
        method: "HEAD",
        sslPinning: {
          certs: this.getCertificatesForDomain(domain),
        },
      });

      return CertificateValidationResult.VALID;
    } catch (error) {
      this.logError(`Certificate validation failed for ${domain}`, error);

      if (error.message?.includes("CERTIFICATE_VERIFY_FAILED")) {
        return CertificateValidationResult.INVALID_FINGERPRINT;
      }

      if (error.message?.includes("timeout")) {
        return CertificateValidationResult.TIMEOUT;
      }

      return CertificateValidationResult.NETWORK_ERROR;
    }
  }

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

  private createSSLPinningError(originalError: any): Error {
    let errorType = SSLPinningError.UNKNOWN_ERROR;
    let message = "SSL Pinning failed";

    if (originalError.message?.includes("CERTIFICATE_VERIFY_FAILED")) {
      errorType = SSLPinningError.CERTIFICATE_MISMATCH;
      message =
        "SSL Certificate verification failed - possible man-in-the-middle attack";
    } else if (originalError.message?.includes("timeout")) {
      errorType = SSLPinningError.TIMEOUT;
      message = "SSL Pinning validation timeout";
    } else if (originalError.message?.includes("network")) {
      errorType = SSLPinningError.NETWORK_ERROR;
      message = "Network error during SSL validation";
    }

    const error = new Error(message);
    (error as any).sslPinningErrorType = errorType;
    (error as any).originalError = originalError;

    return error;
  }

  private logDebug(message: string, data?: any): void {
    if (SSL_PINNING_CONFIG.DEBUG.LOG_PINNING_ATTEMPTS) {
      const logEntry = `[SSL_PINNING_DEBUG] ${new Date().toISOString()}: ${message}${
        data ? ` | Data: ${JSON.stringify(data)}` : ""
      }`;
      this.debugLogs.push(logEntry);
      console.log(logEntry);
    }
  }

  private logError(message: string, error?: any): void {
    if (SSL_PINNING_CONFIG.DEBUG.LOG_ERROR_DETAILS) {
      const logEntry = `[SSL_PINNING_ERROR] ${new Date().toISOString()}: ${message}${
        error ? ` | Error: ${error.message || error}` : ""
      }`;
      this.debugLogs.push(logEntry);
      console.error(logEntry);
    }
  }
}

export default SSLPinningService.getInstance();
