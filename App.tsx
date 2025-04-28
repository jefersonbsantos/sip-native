import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import SipConfigurationForm from "./components/SipConfigurationForm";
import SipStatusFooter from "./components/SipStatusFooter";
import { usePjSipManager } from "./hooks/usePjSipManager";
import Dialpad from "./components/Dialpad";
import ContactList from "./components/ContactList";

export default function App() {
  usePjSipManager();

  return (
    // <SipProvider>
    <View style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Configuração SIP</Text>
        <SipConfigurationForm />

        <View style={styles.separator} />

        <Text style={styles.title}>Contatos</Text>
        <ContactList />

        <View style={styles.separator} />

        <Text style={styles.title}>Teclado</Text>
        <Dialpad />
      </ScrollView>
      <SipStatusFooter />
      <StatusBar style="auto" />
    </View>
    // </SipProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  separator: {
    height: 1,
    width: "80%",
    backgroundColor: "#ccc",
    marginVertical: 30,
  },
});
