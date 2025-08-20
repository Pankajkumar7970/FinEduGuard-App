import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { colors } from "../../utils/colors";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "outline";
}

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = "primary",
  // icon,
}: PrimaryButtonProps) {
  const getButtonStyle = () => {
    switch (variant) {
      case "secondary":
        return [styles.button, styles.secondaryButton];
      case "outline":
        return [styles.button, styles.outlineButton];
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "secondary":
        return [styles.buttonText, styles.secondaryText];
      case "outline":
        return [styles.buttonText, styles.outlineText];
      default:
        return [styles.buttonText, styles.primaryText];
    }
  };

  return (
    <TouchableOpacity
      style={[
        ...getButtonStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" ? colors.neutral.white : colors.primary.green
          }
          size="small"
        />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary.green,
  },
  secondaryButton: {
    backgroundColor: colors.primary.gold,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.primary.green,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: colors.neutral.white,
  },
  secondaryText: {
    color: colors.primary.darkGreen,
  },
  outlineText: {
    color: colors.primary.green,
  },
});
