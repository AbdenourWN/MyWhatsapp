import ZegoUIKitPrebuiltCallService from "@zegocloud/zego-uikit-prebuilt-call-rn";
import * as ZIM from "zego-zim-react-native";
import * as ZPNs from "zego-zpns-react-native";
import { APP_SIGN, APP_ID } from "@env";

export const onUserLogin = async (userID, userName) => {
  return ZegoUIKitPrebuiltCallService.init(
    APP_ID,
    APP_SIGN,
    userID,
    userName,
    [ZIM, ZPNs],
    {
      ringtoneConfig: {
        incomingCallFileName: "zego_incoming.mp3",
        outgoingCallFileName: "zego_outgoing.mp3",
      },
      androidNotificationConfig: {
        channelID: "ZegoUIKit",
        channelName: "ZegoUIKit",
      },
    }
  );
};

export const onUserLogout = () => {
  return ZegoUIKitPrebuiltCallService.uninit();
};
