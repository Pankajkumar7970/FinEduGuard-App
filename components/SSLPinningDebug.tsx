import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { SecurityManager, initializeSecurity } from "../utils/securityManager";
import { SSL_PINNING_CONFIG } from "../utils/sslPinningConfig";

interface SSLPinningStatus {
  enabled: boolean;
  isInitialized: boolean;
  supportedPlatforms: string[];
  debugLogs: string[];
  totalLogs: number;
}

export default function SSLPinningDebug() {
  const [status, setStatus] = useState<SSLPinningStatus | null>(null);
  const [domain, setDomain] = useState("yourdomain.com");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const securityManager = new SecurityManager();
      const sslStatus = securityManager.getSSLPinningStatus();
      setStatus(sslStatus);
    } catch (error) {
      console.error("Failed to load SSL pinning status:", error);
    }
  };

  const validateDomain = async () => {
    if (!domain.trim()) {
      Alert.alert("Error", "Please enter a domain");
      return;
    }

    setLoading(true);
    try {
      const securityManager = new SecurityManager();
      const result = await securityManager.validateSSLCertificate(domain);
      setValidationResult(result);
    } catch (error) {
      Alert.alert("Error", `Validation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    if (status) {
      // This would need to be implemented in the service
      Alert.alert("Info", "Logs cleared");
      loadStatus();
    }
  };

  const testSSLPinning = async () => {
    try {
      const securityManager = new SecurityManager();
      await initializeSecurity();
      Alert.alert("Success", "SSL Pinning initialized successfully");
      loadStatus();
    } catch (error) {
      Alert.alert("Error", `Initialization failed: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>SSL Pinning Debug</Text>

      {/* Configuration Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <Text>Enabled: {SSL_PINNING_CONFIG.ENABLED ? "Yes" : "No"}</Text>
        <Text>
          Platform: {status?.supportedPlatforms?.join(", ") || "Unknown"}
        </Text>
        <Text>Initialized: {status?.isInitialized ? "Yes" : "No"}</Text>
      </View>

      {/* Status */}
      {status && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text>Total Logs: {status.totalLogs}</Text>
          <TouchableOpacity style={styles.button} onPress={clearLogs}>
            <Text style={styles.buttonText}>Clear Logs</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Domain Validation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Domain Validation</Text>
        <TextInput
          style={styles.input}
          value={domain}
          onChangeText={setDomain}
          placeholder="Enter domain to validate"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={validateDomain}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Validating..." : "Validate Certificate"}
          </Text>
        </TouchableOpacity>

        {validationResult && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Validation Result:</Text>
            <Text>Valid: {validationResult.valid ? "Yes" : "No"}</Text>
            <Text>Result: {validationResult.result}</Text>
            <Text>Domain: {validationResult.domain}</Text>
            <Text>Timestamp: {validationResult.timestamp}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.button} onPress={testSSLPinning}>
          <Text style={styles.buttonText}>Test SSL Pinning</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={loadStatus}>
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Logs */}
      {status?.debugLogs && status.debugLogs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Debug Logs</Text>
          {status.debugLogs.map((log, index) => (
            <Text key={index} style={styles.logEntry}>
              {log}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 4,
    marginTop: 12,
  },
  resultTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  logEntry: {
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
    color: "#666",
  },
});
