import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { usePjSipManager } from "../hooks/usePjSipManager";
import { useSipStore } from "../store/sipStore";

const { width } = Dimensions.get("window");
const buttonSize = width * 0.2;

const dialpadKeys = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "0",
  "#",
];

export default function Dialpad() {
  const [dialedNumber, setDialedNumber] = useState("");
  const {
    makeCall,
    hangupCall,
    answerCall,
    declineCall,
    toggleSpeaker,
    isSpeakerOn,
  } = usePjSipManager();
  const activeCall = useSipStore((state) => state.activeCall);
  const connectionStatus = useSipStore((state) => state.connectionStatus);

  const isCallActive = activeCall !== null;
  const isIncoming = activeCall?.state === "PJSIP_INV_STATE_INCOMING";
  const isCallConnected = activeCall?.state === "PJSIP_INV_STATE_CONFIRMED";

  const handleKeyPress = (key: string) => {
    setDialedNumber((prev) => prev + key);
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (dialedNumber) {
      makeCall(dialedNumber);
    }
  };

  const handleHangup = () => {
    hangupCall();
    setDialedNumber("");
  };

  const handleAnswer = () => {
    answerCall();
  };

  const handleDecline = () => {
    declineCall();
  };

  const handleToggleSpeaker = () => {
    toggleSpeaker();
  };

  const isCallButtonDisabled = useMemo(() => {
    return isCallActive || connectionStatus !== "Registrado" || !dialedNumber;
  }, [isCallActive, connectionStatus, dialedNumber]);

  const isHangupButtonDisabled = useMemo(() => {
    return !isCallActive || isIncoming;
  }, [isCallActive, isIncoming]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.display}
        value={
          isIncoming
            ? `Recebendo de: ${activeCall?.remoteUri}`
            : isCallConnected
            ? `${activeCall?.stateText} (${activeCall?.remoteUri})`
            : isCallActive
            ? `${activeCall?.stateText} (${activeCall?.remoteUri})`
            : dialedNumber
        }
        placeholder={!isCallActive ? "Digite o número" : ""}
        editable={false}
        placeholderTextColor="#aaa"
      />

      {!isCallActive && (
        <View style={styles.keypadContainer}>
          {dialpadKeys.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.keyButton}
              onPress={() => handleKeyPress(key)}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.keyButton, styles.actionKey]}
            onPress={handleBackspace}
            disabled={dialedNumber.length === 0}
          >
            <Text style={styles.keyText}>⌫</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.callButtonsContainer}>
        {isIncoming ? (
          <>
            <TouchableOpacity
              style={[styles.callButton, styles.callButtonAnswer]}
              onPress={handleAnswer}
            >
              <Text style={styles.callButtonText}>Atender</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callButton, styles.callButtonDecline]}
              onPress={handleDecline}
            >
              <Text style={styles.callButtonText}>Rejeitar</Text>
            </TouchableOpacity>
          </>
        ) : isCallConnected ? (
          <>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleToggleSpeaker}
            >
              <Text style={styles.callButtonText}>
                {isSpeakerOn ? "Speaker ON" : "Speaker OFF"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callButton, styles.callButtonHangup]}
              onPress={handleHangup}
            >
              <Text style={styles.callButtonText}>Desligar</Text>
            </TouchableOpacity>
          </>
        ) : isCallActive ? (
          <TouchableOpacity
            style={[styles.callButton, styles.callButtonHangup]}
            onPress={handleHangup}
          >
            <Text style={styles.callButtonText}>Cancelar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.callButton,
                styles.callButtonCall,
                isCallButtonDisabled ? styles.disabledButton : {},
              ]}
              onPress={handleCall}
              disabled={isCallButtonDisabled}
            >
              <Text style={styles.callButtonText}>Ligar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.callButton,
                styles.callButtonHangup,
                styles.disabledButton,
              ]}
              disabled={true}
            >
              <Text style={styles.callButtonText}>Desligar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isCallActive && !isIncoming && (
        <View style={styles.callStatusContainer}>
          <Text style={styles.callStatusText}>Chamada Ativa:</Text>
          <Text style={styles.callStatusInfo}>{activeCall.remoteUri}</Text>
          <Text style={styles.callStatusInfo}>
            Status: {activeCall.stateText || activeCall.state}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "90%",
    alignItems: "center",
    marginTop: 20,
  },
  display: {
    width: "100%",
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  keypadContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: buttonSize * 3 + 60,
  },
  keyButton: {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    margin: 10,
  },
  actionKey: {
    backgroundColor: "#d0d0d0",
  },
  keyText: {
    fontSize: 28,
    color: "#333",
  },
  callButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
    minHeight: 60,
  },
  callButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 120,
  },
  callButtonCall: {
    backgroundColor: "#28a745",
  },
  callButtonHangup: {
    backgroundColor: "#dc3545",
  },
  callButtonAnswer: {
    backgroundColor: "#28a745",
  },
  callButtonDecline: {
    backgroundColor: "#ffc107",
  },
  callButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.5,
  },
  callStatusContainer: {
    marginTop: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#007bff",
    borderRadius: 5,
    alignItems: "center",
    width: "100%",
  },
  callStatusText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#007bff",
  },
  callStatusInfo: {
    fontSize: 14,
    color: "#333",
  },
});
