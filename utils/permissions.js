import { Platform, Alert } from "react-native";
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from "react-native-permissions";

export async function ensurePermission(type) {
  let permissionsToCheck = [];

  switch (type) {
    case "location":
      permissionsToCheck = [
        Platform.OS === "android"
          ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
          : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      ];
      break;

    case "internet":
      return RESULTS.GRANTED; // INTERNET has no runtime permission

    case "microphone":
      permissionsToCheck = [
        Platform.OS === "android"
          ? PERMISSIONS.ANDROID.RECORD_AUDIO
          : PERMISSIONS.IOS.MICROPHONE,
      ];
      break;

    case "phone":
      if (Platform.OS === "android") {
        permissionsToCheck = [PERMISSIONS.ANDROID.READ_PHONE_STATE];
      } else {
        return RESULTS.UNAVAILABLE;
      }
      break;

    default:
      throw new Error(`Unknown permission type: ${type}`);
  }

  // Loop through all required permissions for the type
  for (const permission of permissionsToCheck) {
    if (!permission) continue;

    const status = await check(permission);

    if (status === RESULTS.DENIED) {
      const reqStatus = await request(permission);
      if (reqStatus !== RESULTS.GRANTED) return reqStatus;
    } else if (status === RESULTS.BLOCKED) {
      Alert.alert(
        "Permission Required",
        "Please enable the required permission in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: openSettings },
        ]
      );
      return status;
    }
  }

  return RESULTS.GRANTED;
}
