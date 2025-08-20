import React from "react";
import { ActivityIndicator, View } from "react-native";

const Loader = () => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(250,250,250,0.2)",
      }}
    >
      <ActivityIndicator
        size="large"
        color="#000"
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      />
    </View>
  );
};

export default Loader;
