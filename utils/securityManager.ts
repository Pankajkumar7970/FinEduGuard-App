import { encryptionService } from "./encryption";
import { deviceSecurityService, SecurityCheckResult } from "./deviceSecurity";
import { secureApiService } from "./apiSecurity";
import { appSecurityService } from "./appSecurity";
import { SECURITY_CONFIG } from "./securityConfig";
import sslPinningService from "./sslPinningService";

export interface SecurityStatus {
  isSecure: boolean;
  deviceSecurity: SecurityCheckResult;
  appSecurity: {
    copyPasteDisabled: boolean;
    screenshotsDisabled: boolean;
    backupDisabled: boolean;
  };
  encryptionEnabled: boolean;
  sslPinningEnabled: boolean;
  sslPinningStatus: {
    isEnabled: boolean;
    isInitialized: boolean;
    supportedPlatforms: string[];
    debugLogs: string[];
    totalLogs: number;
  };
  violations: string[];
}

export class SecurityManager {
  private static instance: SecurityManager;
  private isInitialized: boolean = false;

  public constructor() {}

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Initialize all security services
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("Initializing security manager...");

      // Initialize encryption service
      await encryptionService.initialize();
      console.log("✓ Encryption service initialized");

      // Initialize app security features
      await appSecurityService.initialize();
      console.log("✓ App security features initialized");

      // Initialize SSL pinning service
      if (SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        try {
          const sslPinningInitialized = await sslPinningService.initialize();
          if (sslPinningInitialized) {
            console.log("✓ SSL Pinning service initialized");
          } else {
            console.warn("⚠ SSL Pinning service initialization failed");
          }
        } catch (error) {
          console.warn("⚠ SSL Pinning service initialization error:", error);
        }
      } else {
        console.log("ℹ SSL Pinning disabled in configuration");
      }

      // Perform initial security check
      const securityCheck = await this.performSecurityCheck();
      if (!securityCheck.isSecure) {
        console.warn("Security violations detected:", securityCheck.violations);
        if (!__DEV__) {
          throw new Error("Device security check failed");
        }
      }

      this.isInitialized = true;
      console.log("✓ Security manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize security manager:", error);
      throw new Error("Security initialization failed");
    }
  }

  // Perform comprehensive security check
  public async performSecurityCheck(): Promise<SecurityStatus> {
    const violations: string[] = [];

    // Check device security
    const deviceSecurity = await deviceSecurityService.performSecurityCheck();
    if (!deviceSecurity.isSecure) {
      violations.push(...deviceSecurity.threats);
    }

    // Check app security
    const copyPasteDisabled = await appSecurityService.isCopyPasteDisabled();
    const screenshotsDisabled =
      await appSecurityService.isScreenshotsDisabled();
    const backupDisabled = await appSecurityService.isBackupDisabled();

    if (
      SECURITY_CONFIG.APP_SECURITY.COPY_PASTE_DISABLED &&
      !copyPasteDisabled
    ) {
      violations.push("Copy/paste is not disabled");
    }

    if (
      SECURITY_CONFIG.APP_SECURITY.SCREENSHOT_DISABLED &&
      !screenshotsDisabled
    ) {
      violations.push("Screenshots are not disabled");
    }

    if (SECURITY_CONFIG.APP_SECURITY.BACKUP_DISABLED && !backupDisabled) {
      violations.push("App backup is not disabled");
    }

    // Check encryption status
    const encryptionEnabled =
      SECURITY_CONFIG.DATA_PROTECTION.SENSITIVE_DATA_ENCRYPTION;
    const sslPinningEnabled = SECURITY_CONFIG.SSL_PINNING.ENABLED;

    // Get SSL pinning status
    const sslPinningStatus = this.getSSLPinningStatus();

    return {
      isSecure: violations.length === 0,
      deviceSecurity,
      appSecurity: {
        copyPasteDisabled,
        screenshotsDisabled,
        backupDisabled,
      },
      encryptionEnabled,
      sslPinningEnabled,
      sslPinningStatus,
      violations,
    };
  }

  // Get SSL pinning status
  public getSSLPinningStatus(): any {
    if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
      return {
        enabled: false,
        reason: "Disabled in configuration",
        isEnabled: false,
        isInitialized: false,
        supportedPlatforms: [],
        debugLogs: [],
        totalLogs: 0,
      };
    }

    try {
      const status = sslPinningService.getStatus();
      const debugLogs = sslPinningService.getDebugLogs();

      return {
        ...status,
        debugLogs: debugLogs.slice(-10), // Last 10 log entries
        totalLogs: debugLogs.length,
      };
    } catch (error) {
      console.error("Failed to get SSL pinning status:", error);
      return {
        enabled: false,
        reason: "Service error",
        isEnabled: false,
        isInitialized: false,
        supportedPlatforms: [],
        debugLogs: [],
        totalLogs: 0,
      };
    }
  }

  // Validate SSL certificate for a domain
  public async validateSSLCertificate(domain: string): Promise<any> {
    try {
      if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        return {
          valid: false,
          reason: "SSL Pinning disabled",
          domain,
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.isInitialized) {
        return {
          valid: false,
          reason: "Security manager not initialized",
          domain,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await sslPinningService.validateCertificate(domain);
      return {
        valid: result === "VALID",
        result,
        domain,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`SSL certificate validation failed for ${domain}`, error);
      return {
        valid: false,
        reason: error.message,
        domain,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Test SSL pinning functionality
  public async testSSLPinning(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        return {
          success: false,
          message: "SSL Pinning is disabled in configuration",
        };
      }

      if (!this.isInitialized) {
        return { success: false, message: "Security manager not initialized" };
      }

      // Test with a configured domain
      const configuredDomains = Object.keys(
        SECURITY_CONFIG.SSL_PINNING.CERTIFICATES
      );
      if (configuredDomains.length === 0) {
        return {
          success: false,
          message: "No domains configured for SSL pinning",
        };
      }

      const testDomain = configuredDomains[0];
      const result = await sslPinningService.validateCertificate(testDomain);

      if (result === "VALID") {
        return {
          success: true,
          message: `SSL Pinning test successful for ${testDomain}`,
        };
      } else {
        return {
          success: false,
          message: `SSL Pinning test failed for ${testDomain}: ${result}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `SSL Pinning test error: ${error.message}`,
      };
    }
  }

  // Get SSL pinning debug logs
  public getSSLPinningDebugLogs(): string[] {
    try {
      if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        return ["SSL Pinning is disabled"];
      }
      return sslPinningService.getDebugLogs();
    } catch (error) {
      return [`Error getting debug logs: ${error.message}`];
    }
  }

  // Clear SSL pinning debug logs
  public clearSSLPinningDebugLogs(): void {
    try {
      if (SECURITY_CONFIG.SSL_PINNING.ENABLED) {
        sslPinningService.clearDebugLogs();
      }
    } catch (error) {
      console.error("Failed to clear SSL pinning debug logs:", error);
    }
  }

  // Encrypt sensitive data
  public async encryptData(data: any): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }
    return await encryptionService.encryptSensitiveData(data);
  }

  // Decrypt sensitive data
  public async decryptData(encryptedData: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }
    return await encryptionService.decryptSensitiveData(encryptedData);
  }

  // Secure API request
  public async secureApiRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    data?: any
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }

    switch (method) {
      case "GET":
        return await secureApiService.secureGet<T>(url);
      case "POST":
        return await secureApiService.securePost<T>(url, data);
      case "PUT":
        return await secureApiService.securePut<T>(url, data);
      case "DELETE":
        return await secureApiService.secureDelete<T>(url);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  // Set authentication token
  public setAuthToken(token: string): void {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }
    secureApiService.setAuthToken(token);
  }

  // Clear authentication token
  public clearAuthToken(): void {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }
    secureApiService.clearAuthToken();
  }

  // Get device information
  public async getDeviceInfo(): Promise<Record<string, any>> {
    return await deviceSecurityService.getDeviceInfo();
  }

  // Show security warning
  public showSecurityWarning(message: string): void {
    appSecurityService.showSecurityWarning(message);
  }

  // Clear clipboard
  public async clearClipboard(): Promise<void> {
    return await appSecurityService.clearClipboard();
  }

  // Rotate encryption keys
  public async rotateEncryptionKeys(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }
    return await encryptionService.rotateKeys();
  }

  // Clear all security data (for logout)
  public async clearSecurityData(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Security manager not initialized");
    }

    try {
      // Clear encryption keys
      await encryptionService.clearKeys();

      // Clear auth token
      secureApiService.clearAuthToken();

      // Clear clipboard
      await appSecurityService.clearClipboard();

      console.log("Security data cleared successfully");
    } catch (error) {
      console.error("Failed to clear security data:", error);
      throw new Error("Failed to clear security data");
    }
  }

  // Validate security requirements
  public async validateSecurityRequirements(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check OWASP Top 10 compliance
    const owaspIssues = await this.checkOWASPCompliance();
    issues.push(...owaspIssues);

    // Check CERT-IN guidelines compliance
    const certinIssues = await this.checkCERTINCompliance();
    issues.push(...certinIssues);

    // Check custom security requirements
    const customIssues = await this.checkCustomSecurityRequirements();
    issues.push(...customIssues);

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Check OWASP Top 10 compliance
  private async checkOWASPCompliance(): Promise<string[]> {
    const issues: string[] = [];

    // A01:2021 – Broken Access Control
    if (!SECURITY_CONFIG.SESSION.MAX_SESSIONS) {
      issues.push("OWASP A01: Session management not properly configured");
    }

    // A02:2021 – Cryptographic Failures
    if (!SECURITY_CONFIG.ENCRYPTION.ALGORITHM.includes("AES-256")) {
      issues.push("OWASP A02: AES-256 encryption not properly configured");
    }
    if (!SECURITY_CONFIG.API?.ENCRYPTION?.ENABLED) {
      issues.push("OWASP A02: API request/response encryption not enabled");
    }

    // A04:2021 – Insecure Design
    if (!SECURITY_CONFIG.DEVICE_SECURITY.ROOT_DETECTION_ENABLED) {
      issues.push("OWASP A04: Root/jailbreak detection not enabled");
    }

    // A05:2021 – Security Misconfiguration
    if (!SECURITY_CONFIG.APP_SECURITY.BACKUP_DISABLED) {
      issues.push("OWASP A05: App backup not disabled");
    }
    if (!SECURITY_CONFIG.API?.RATE_LIMIT?.ENABLED) {
      issues.push("OWASP A05: API rate limiting not enabled");
    }

    // A06:2021 – Vulnerable and Outdated Components
    if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
      issues.push(
        "OWASP A06: SSL pinning not enabled (vulnerable to certificate attacks)"
      );
    }

    return issues;
  }

  // Check CERT-IN guidelines compliance
  private async checkCERTINCompliance(): Promise<string[]> {
    const issues: string[] = [];

    // Check for SSL pinning
    if (!SECURITY_CONFIG.SSL_PINNING.ENABLED) {
      issues.push("CERT-IN: SSL pinning not enabled");
    } else {
      // Check if SSL pinning is properly configured
      const sslStatus = this.getSSLPinningStatus();
      if (!sslStatus.isInitialized) {
        issues.push(
          "CERT-IN: SSL pinning enabled but not properly initialized"
        );
      }

      // Check if certificates are configured
      const configuredCerts = Object.keys(
        SECURITY_CONFIG.SSL_PINNING.CERTIFICATES
      );
      if (configuredCerts.length === 0) {
        issues.push(
          "CERT-IN: SSL pinning enabled but no certificates configured"
        );
      }
    }

    // Check for code obfuscation
    if (!SECURITY_CONFIG.OBFUSCATION.ENABLED) {
      issues.push("CERT-IN: Code obfuscation not enabled");
    }

    // Check for minimum permissions
    if (SECURITY_CONFIG.PERMISSIONS.REQUIRED.length === 0) {
      issues.push("CERT-IN: Required permissions not defined");
    }

    // Validate app.json permissions (best-effort)
    try {
      // Relative to utils/ -> ../app.json
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const appConfig = require("../app.json");
      const androidPerms: string[] =
        appConfig?.expo?.android?.permissions || [];
      const required = new Set(SECURITY_CONFIG.PERMISSIONS.REQUIRED);

      // Extra permissions present beyond required+optional
      const allowed = new Set([
        ...SECURITY_CONFIG.PERMISSIONS.REQUIRED,
        ...SECURITY_CONFIG.PERMISSIONS.OPTIONAL,
      ]);
      const extras = androidPerms.filter((p: string) => !allowed.has(p));
      if (extras.length > 0) {
        issues.push(
          `CERT-IN: App requests non-required permissions: ${extras.join(", ")}`
        );
      }
    } catch (e) {
      issues.push(
        "CERT-IN: Could not automatically verify Android permissions (app.json not accessible at runtime)"
      );
    }

    return issues;
  }

  // Check custom security requirements
  private async checkCustomSecurityRequirements(): Promise<string[]> {
    const issues: string[] = [];

    // Check for SHA-256 signing
    // This would require checking the actual app signature

    // Check for code minification
    if (!SECURITY_CONFIG.OBFUSCATION.MINIFY_ENABLED) {
      issues.push("Custom: Code minification not enabled");
    }

    // Check for source map disabling
    if (!SECURITY_CONFIG.OBFUSCATION.SOURCE_MAP_DISABLED) {
      issues.push("Custom: Source maps not disabled");
    }

    return issues;
  }

  // Get security configuration
  public getSecurityConfig(): typeof SECURITY_CONFIG {
    return SECURITY_CONFIG;
  }

  // Check if security manager is initialized
  public isSecurityInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();

// Utility functions
export const initializeSecurity = async (): Promise<void> => {
  return await securityManager.initialize();
};

export const performSecurityCheck = async (): Promise<SecurityStatus> => {
  return await securityManager.performSecurityCheck();
};

export const encryptData = async (data: any): Promise<string> => {
  return await securityManager.encryptData(data);
};

export const decryptData = async (encryptedData: string): Promise<any> => {
  return await securityManager.decryptData(encryptedData);
};

export const secureApiRequest = async <T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  data?: any
): Promise<T> => {
  return await securityManager.secureApiRequest<T>(method, url, data);
};

export const setAuthToken = (token: string): void => {
  securityManager.setAuthToken(token);
};

export const clearAuthToken = (): void => {
  securityManager.clearAuthToken();
};

export const getDeviceInfo = async (): Promise<Record<string, any>> => {
  return await securityManager.getDeviceInfo();
};

export const showSecurityWarning = (message: string): void => {
  securityManager.showSecurityWarning(message);
};

export const clearClipboard = async (): Promise<void> => {
  return await securityManager.clearClipboard();
};

export const rotateEncryptionKeys = async (): Promise<void> => {
  return await securityManager.rotateEncryptionKeys();
};

export const clearSecurityData = async (): Promise<void> => {
  return await securityManager.clearSecurityData();
};

export const validateSecurityRequirements = async (): Promise<{
  isValid: boolean;
  issues: string[];
}> => {
  return await securityManager.validateSecurityRequirements();
};

// New SSL pinning utility functions
export const getSSLPinningStatus = (): any => {
  return securityManager.getSSLPinningStatus();
};

export const validateSSLCertificate = async (domain: string): Promise<any> => {
  return await securityManager.validateSSLCertificate(domain);
};

export const testSSLPinning = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  return await securityManager.testSSLPinning();
};

export const getSSLPinningDebugLogs = (): string[] => {
  return securityManager.getSSLPinningDebugLogs();
};

export const clearSSLPinningDebugLogs = (): void => {
  securityManager.clearSSLPinningDebugLogs();
};
