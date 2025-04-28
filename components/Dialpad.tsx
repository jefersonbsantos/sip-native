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
const buttonSize = width * 0.2; // Tamanho do botão baseado na largura da tela

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
  const { makeCall, hangupCall } = usePjSipManager();
  const activeCall = useSipStore((state) => state.activeCall);
  const connectionStatus = useSipStore((state) => state.connectionStatus);

  const handleKeyPress = (key: string) => {
    setDialedNumber((prev) => prev + key);
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (dialedNumber) {
      makeCall(dialedNumber);
      // Não limpar o número aqui, talvez o usuário precise ver durante a chamada
    }
  };

  const handleHangup = () => {
    hangupCall();
    setDialedNumber(""); // Limpar número ao desligar
  };

  // Determina se o botão de ligar deve estar ativo
  const isCallButtonDisabled = useMemo(() => {
    return (
      activeCall !== null || connectionStatus !== "Registrado" || !dialedNumber
    );
  }, [activeCall, connectionStatus, dialedNumber]);

  // Determina se o botão de desligar deve estar ativo
  const isHangupButtonDisabled = useMemo(() => {
    return activeCall === null;
  }, [activeCall]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.display}
        value={dialedNumber}
        placeholder="Digite o número"
        editable={false} // Apenas exibição
        placeholderTextColor="#aaa"
      />

      <View style={styles.keypadContainer}>
        {dialpadKeys.map((key) => (
          <TouchableOpacity
            key={key}
            style={styles.keyButton}
            onPress={() => handleKeyPress(key)}
            disabled={activeCall !== null} // Desabilitar teclado durante chamada
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
        {/* Adicionar botão de Backspace (pode ser um ícone) */}
        <TouchableOpacity
          style={[styles.keyButton, styles.actionKey]} // Estilo diferente
          onPress={handleBackspace}
          disabled={activeCall !== null || dialedNumber.length === 0}
        >
          <Text style={styles.keyText}>⌫</Text> {/* Ícone simples */}
        </TouchableOpacity>
      </View>

      <View style={styles.callButtonsContainer}>
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
            isHangupButtonDisabled ? styles.disabledButton : {},
          ]}
          onPress={handleHangup}
          disabled={isHangupButtonDisabled}
        >
          <Text style={styles.callButtonText}>Desligar</Text>
        </TouchableOpacity>
      </View>

      {/* Exibir status da chamada ativa */}
      {activeCall && (
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
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 15,
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  keypadContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: buttonSize * 3 + 40, // Largura baseada no tamanho dos botões
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
    backgroundColor: "#28a745", // Verde
  },
  callButtonHangup: {
    backgroundColor: "#dc3545", // Vermelho
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
