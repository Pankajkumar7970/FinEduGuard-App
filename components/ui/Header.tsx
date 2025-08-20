import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../utils/colors";

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showBackButton?: boolean;
}

export default function Header({
  title,
  onBackPress,
  showBackButton = false,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      {showBackButton && (
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <ArrowLeft size={24} color={colors.primary.green} />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.neutral.white,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.primary.darkGreen,
  },
});
