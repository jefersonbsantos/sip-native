import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSipStore, ConnectionStatus } from "../store/sipStore";

export default function SipStatusFooter() {
  const connectionStatus = useSipStore((state) => state.connectionStatus);

  const getStatusStyle = (status: ConnectionStatus) => {
    switch (status) {
      case "Registrado":
        return styles.registered;
      case "Conectando":
      case "Configurando":
        return styles.connecting;
      case "Erro":
      case "Não Registrado":
        return styles.error;
      case "Desconectado":
      default:
        return styles.disconnected;
    }
  };

  return (
    <View style={styles.footerContainer}>
      <Text style={[styles.statusText, getStatusStyle(connectionStatus)]}>
        Status: {connectionStatus}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  disconnected: {
    color: "gray",
  },
  connecting: {
    color: "orange",
  },
  registered: {
    color: "green",
  },
  error: {
    color: "red",
  },
});
